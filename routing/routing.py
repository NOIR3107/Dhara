"""
routing.py — Module 2: Route Finding
======================================
Finds shortest / cheapest routes between nodes in the NER road network.

Uses NetworkX's built-in shortest_path (Dijkstra) and astar_path algorithms —
no hand-rolled solver. Routes are cached in an LRU-style in-memory store keyed
by (origin, destination). Cache is invalidated whenever the underlying graph
changes (e.g. a road becomes blocked by alternate_route.py).

Route output structure (consumed by all downstream modules):
{
    "origin":             node_id (str),
    "destination":        node_id (str),
    "path":               [node_id, ...],
    "total_time_minutes": float,
    "total_distance_km":  float,
    "edges":              [ {osmid, name, highway, length_km, travel_time_min, district}, ... ]
}
"""

from __future__ import annotations

from functools import lru_cache
from typing import Dict, List, Optional, Tuple

import networkx as nx

# ---------------------------------------------------------------------------
# Type alias for a route result dict
# ---------------------------------------------------------------------------
RouteResult = Dict


# ---------------------------------------------------------------------------
# Route Cache
# ---------------------------------------------------------------------------

class RouteCache:
    """
    Simple in-memory cache for (origin, destination) → RouteResult.
    Invalidated on graph mutations to prevent stale routes.

    For the placeholder 10-20 node graph, all-pairs routes are pre-computed.
    For larger real-world graphs (OSMnx), pre-computation is limited to
    district capitals and key waypoints.
    """

    def __init__(self):
        self._cache: Dict[Tuple[str, str], RouteResult] = {}
        self._valid = True

    def get(self, origin: str, destination: str) -> Optional[RouteResult]:
        if not self._valid:
            return None
        return self._cache.get((origin, destination))

    def set(self, origin: str, destination: str, result: RouteResult):
        self._cache[(origin, destination)] = result

    def invalidate(self):
        """Call this whenever the graph changes (edge blocked/restored)."""
        self._cache.clear()
        self._valid = False
        # Re-enable for future lookups after clearing
        self._valid = True

    def size(self) -> int:
        return len(self._cache)


# Module-level cache instance
_route_cache = RouteCache()


def invalidate_cache():
    """Public entry point — call whenever the graph is mutated."""
    _route_cache.invalidate()


# ---------------------------------------------------------------------------
# Route building helpers
# ---------------------------------------------------------------------------

def _build_route_result(
    graph: nx.MultiDiGraph,
    path: List[str],
    origin: str,
    destination: str,
) -> RouteResult:
    """
    Given a list of node IDs (the path), build the full RouteResult dict by
    summing edge attributes along the path.
    """
    total_time_min = 0.0
    total_distance_km = 0.0
    edges_info = []

    for i in range(len(path) - 1):
        u = path[i]
        v = path[i + 1]

        # Pick the minimum-weight edge among parallel edges (MultiDiGraph)
        edge_data = _best_edge_data(graph, u, v)

        travel_time_min = edge_data.get("travel_time_min", edge_data.get("weight", 0.0))
        length_km       = edge_data.get("length_km", edge_data.get("length_m", 0.0) / 1000.0)

        total_time_min    += travel_time_min
        total_distance_km += length_km

        edges_info.append({
            "osmid":            str(edge_data.get("osmid", f"{u}-{v}")),
            "name":             edge_data.get("name", "Unnamed Road"),
            "highway":          edge_data.get("highway", "unclassified"),
            "surface":          edge_data.get("surface", "unknown"),
            "length_km":        round(length_km, 3),
            "travel_time_min":  round(travel_time_min, 2),
            "district":         edge_data.get("district", "unknown"),
            "is_night_restricted":   edge_data.get("is_night_restricted", False),
            "is_single_lane_bridge": edge_data.get("is_single_lane_bridge", False),
            "is_chokepoint":         edge_data.get("is_chokepoint", False),
        })

    return {
        "origin":             origin,
        "destination":        destination,
        "path":               path,
        "total_time_minutes": round(total_time_min, 2),
        "total_distance_km":  round(total_distance_km, 3),
        "edges":              edges_info,
    }


def _best_edge_data(graph: nx.MultiDiGraph, u: str, v: str) -> dict:
    """
    For a MultiDiGraph, return the data dict of the edge with the lowest weight
    between u and v. This ensures routing on the cheapest parallel edge.
    """
    edges = graph[u][v]
    best_key = min(edges, key=lambda k: edges[k].get("weight", float("inf")))
    return edges[best_key]


# ---------------------------------------------------------------------------
# A* heuristic (geographic distance as lower bound)
# ---------------------------------------------------------------------------

def _astar_heuristic(graph: nx.MultiDiGraph):
    """
    Returns a heuristic function for A* that estimates travel time from a node
    to the goal using straight-line geographic distance.

    h(u, goal) = haversine_km(u, goal) / max_speed_kmph * 60
    This is always ≤ actual travel time, so A* remains admissible.
    """
    import math

    max_speed_kmph = max(config_speeds.values()) if config_speeds else 80.0

    def heuristic(u: str, goal: str) -> float:
        try:
            u_data    = graph.nodes[u]
            goal_data = graph.nodes[goal]
            lon1, lat1 = u_data.get("lon", 0), u_data.get("lat", 0)
            lon2, lat2 = goal_data.get("lon", 0), goal_data.get("lat", 0)

            R = 6371.0
            phi1, phi2 = math.radians(lat1), math.radians(lat2)
            dphi    = math.radians(lat2 - lat1)
            dlambda = math.radians(lon2 - lon1)
            a = (math.sin(dphi / 2) ** 2
                 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2)
            dist_km = R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            return (dist_km / max_speed_kmph) * 60.0
        except Exception:
            return 0.0

    return heuristic


# Load speed config for heuristic
try:
    import config as _cfg
    config_speeds = _cfg.BASE_SPEED_KMPH
except ImportError:
    config_speeds = {"default": 25}


# ---------------------------------------------------------------------------
# Core route-finding function
# ---------------------------------------------------------------------------

def find_route(
    graph: nx.MultiDiGraph,
    origin: str,
    destination: str,
    weight: str = "weight",
    use_cache: bool = True,
    use_astar: bool = False,
) -> Optional[RouteResult]:
    """
    Find the shortest (cheapest travel-time) route from origin to destination.

    Args:
        graph       : NetworkX MultiDiGraph (from graph.get_graph() or a subgraph)
        origin      : Start node ID (string)
        destination : End node ID (string)
        weight      : Edge attribute to minimise (default: "weight" = travel_time_min)
        use_cache   : Whether to check/populate the route cache
        use_astar   : Use A* instead of Dijkstra (faster on large graphs with geo coords)

    Returns:
        RouteResult dict, or None if no path exists.

    The cache is keyed on (origin, destination) for the default graph.
    Routes on subgraphs (e.g. from alternate_route.py with blocked edges removed)
    bypass the cache (use_cache=False) since they are transient computations.
    """
    if origin not in graph:
        raise ValueError(f"Origin node not in graph: {origin}")
    if destination not in graph:
        raise ValueError(f"Destination node not in graph: {destination}")

    if origin == destination:
        return {
            "origin":             origin,
            "destination":        destination,
            "path":               [origin],
            "total_time_minutes": 0.0,
            "total_distance_km":  0.0,
            "edges":              [],
        }

    # Check cache
    if use_cache:
        cached = _route_cache.get(origin, destination)
        if cached is not None:
            return cached

    # Pathfinding
    try:
        if use_astar:
            h = _astar_heuristic(graph)
            path = nx.astar_path(graph, origin, destination, heuristic=h, weight=weight)
        else:
            path = nx.shortest_path(graph, origin, destination, weight=weight)
    except nx.NetworkXNoPath:
        return None
    except nx.NodeNotFound as e:
        raise ValueError(f"Node not found during pathfinding: {e}")

    result = _build_route_result(graph, path, origin, destination)

    if use_cache:
        _route_cache.set(origin, destination, result)

    return result


# ---------------------------------------------------------------------------
# Cache pre-population
# ---------------------------------------------------------------------------

def precompute_routes(graph: nx.MultiDiGraph, node_limit: int = 50):
    """
    Pre-compute routes for all node pairs (up to node_limit nodes).
    For the 10-20 node placeholder graph, this covers all pairs.
    For larger real-world graphs, set node_limit to cover only key nodes.

    Routes resolve in <2 seconds from cache for any pre-computed A→B pair.
    Cache is invalidated by invalidate_cache() whenever the graph changes.
    """
    nodes = list(graph.nodes())
    if len(nodes) > node_limit:
        nodes = nodes[:node_limit]
        print(f"[routing.py] precompute_routes: limiting to {node_limit} nodes "
              f"(graph has {graph.number_of_nodes()} total)")

    computed = 0
    skipped  = 0
    for i, origin in enumerate(nodes):
        for destination in nodes:
            if origin == destination:
                continue
            if _route_cache.get(origin, destination) is not None:
                skipped += 1
                continue
            result = find_route(graph, origin, destination, use_cache=True)
            if result:
                computed += 1

    print(f"[routing.py] precompute_routes: {computed} routes computed, "
          f"{skipped} already cached, {graph.number_of_nodes()} nodes total")


# ---------------------------------------------------------------------------
# Utility: extract all edge osmids from a route
# ---------------------------------------------------------------------------

def get_route_edge_ids(route: RouteResult) -> List[str]:
    """Return a list of osmid strings for all edges in the route."""
    return [e["osmid"] for e in route.get("edges", [])]
