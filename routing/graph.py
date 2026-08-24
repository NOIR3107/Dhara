"""
graph.py — Module 1: Road Network Graph
========================================
Builds and maintains a NetworkX MultiDiGraph representing the NER road network.

Design rules enforced here:
- District data is ALWAYS loaded from files (GeoJSON) or OpenStreetMap — never embedded.
- Travel-time cost is derived from road class and base speed assumptions (config.py) —
  never from a named road like "NH-150 goes at 50 km/h".
- add_district() is the single entry point for the live-district-addition requirement;
  a judge can call it at runtime with a new GeoJSON path and the graph updates immediately.
- get_graph() returns the combined graph that routing.py consumes directly.
"""

import json
import math
import os
from typing import Optional

import networkx as nx

import config

# ---------------------------------------------------------------------------
# Module-level combined graph (all loaded districts merged here)
# ---------------------------------------------------------------------------
_combined_graph: nx.MultiDiGraph = nx.MultiDiGraph()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _coord_to_node_id(lon: float, lat: float) -> str:
    """
    Convert a (lon, lat) coordinate pair to a stable string node ID.
    Rounded to 6 decimal places (~11 cm precision) so that shared
    junction coordinates across features snap to the same node.
    """
    return f"{round(lon, 6)},{round(lat, 6)}"


def _get_base_speed(highway_class: str) -> float:
    """
    Return the base travel speed (km/h) for a given OSM highway class.
    Falls back to config.BASE_SPEED_KMPH["default"] for unknown classes.
    """
    return config.BASE_SPEED_KMPH.get(highway_class, config.BASE_SPEED_KMPH["default"])


def _compute_travel_time_min(length_m: float, highway_class: str) -> float:
    """
    Derive edge travel time in minutes from:
        travel_time = (length_m / 1000) / speed_kmph * 60
    This is the primary weight used by routing.py.
    """
    speed_kmph = _get_base_speed(highway_class)
    if speed_kmph <= 0:
        return float("inf")
    length_km = length_m / 1000.0
    return (length_km / speed_kmph) * 60.0


def _haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """
    Great-circle distance between two (lon, lat) points in kilometres.
    Used as a fallback when length_m is not present in feature properties.
    """
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _namespace_graph(G: nx.MultiDiGraph, district_id: str) -> nx.MultiDiGraph:
    """
    Prefix every node ID with '{district_id}::' to guarantee that two district
    graphs can never have colliding node IDs, even if they were loaded from
    identical GeoJSON files or cover overlapping coordinates.

    This is the fix for the live-test bug:
        copy valley_district.geojson test_district.geojson
        seed_district.py --geojson test_district.geojson --name Test
        → "+0 nodes, +0 edges" because nx.compose treated identical
          coordinate-based node IDs as the same nodes.

    After namespacing:
        "94.0,27.0"  →  "hill_tbd::94.0,27.0"
        "94.0,27.0"  →  "test_district::94.0,27.0"   (different node!)

    Edge osmid ATTRIBUTES are intentionally left unchanged — they are
    metadata used by closure_probs lookups and must match Shriti's model output.
    The edge KEY in the graph (u, v, key) is unique because u and v are now
    district-namespaced, so there is no edge-key collision either.

    Node district attributes and edge district attributes are updated to
    district_id after relabelling.
    """
    mapping = {node: f"{district_id}::{node}" for node in G.nodes()}
    G_relabeled = nx.relabel_nodes(G, mapping)
    # Update node-level district attribute so queries like
    # [n for n,d in G.nodes(data=True) if d['district']==district_id] work correctly.
    for node in G_relabeled.nodes():
        G_relabeled.nodes[node]["district"] = district_id
    return G_relabeled


# ---------------------------------------------------------------------------
# GeoJSON loader
# ---------------------------------------------------------------------------

def load_graph_from_geojson(path: str) -> nx.MultiDiGraph:
    """
    Parse a GeoJSON FeatureCollection of LineString road features into a
    NetworkX MultiDiGraph.

    Expected feature properties (all optional except osmid):
        osmid               : unique edge identifier (str or int)
        name                : road name for display (str)
        highway             : OSM highway class (str)
        surface             : road surface type (str)
        lanes               : number of lanes (int)
        length_m            : road segment length in metres (float)
        is_night_restricted : bool — night-time travel multiplier applies
        is_chokepoint       : bool — structural congestion proxy flag
        is_single_lane_bridge : bool — additional congestion proxy flag
        district_id         : slug matching config.OPERATING_DISTRICTS district_id

    Each LineString's first and last coordinates become graph nodes.
    Edges are added in BOTH directions (undirected road semantics)
    unless the feature has one_way=true.

    Returns a MultiDiGraph with edge attribute 'weight' = travel_time_min.
    """
    if not os.path.exists(path):
        raise FileNotFoundError(f"GeoJSON file not found: {path}")

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if data.get("type") != "FeatureCollection":
        raise ValueError(f"Expected GeoJSON FeatureCollection, got: {data.get('type')}")

    G = nx.MultiDiGraph()

    for feature in data.get("features", []):
        geom = feature.get("geometry", {})
        if geom.get("type") != "LineString":
            continue  # skip non-road geometries

        coords = geom["coordinates"]
        if len(coords) < 2:
            continue

        props = feature.get("properties", {})
        osmid     = str(props.get("osmid", f"edge_{id(feature)}"))
        highway   = str(props.get("highway", "unclassified"))
        surface   = str(props.get("surface", "unknown"))
        lanes     = int(props.get("lanes", 1))
        name      = str(props.get("name", "Unnamed Road"))
        district  = str(props.get("district_id", "unknown"))
        one_way   = bool(props.get("one_way", False))
        is_night_restricted  = bool(props.get("is_night_restricted", False))
        is_chokepoint        = bool(props.get("is_chokepoint", False))
        is_single_lane_bridge = bool(props.get("is_single_lane_bridge", False))

        # Length: use explicit property if available, else compute from coordinates
        if "length_m" in props and props["length_m"]:
            length_m = float(props["length_m"])
        else:
            # Sum up segment lengths along the LineString
            length_m = 0.0
            for i in range(len(coords) - 1):
                lon1, lat1 = coords[i][0], coords[i][1]
                lon2, lat2 = coords[i + 1][0], coords[i + 1][1]
                length_m += _haversine_km(lon1, lat1, lon2, lat2) * 1000.0

        travel_time_min = _compute_travel_time_min(length_m, highway)
        length_km = length_m / 1000.0

        # First and last coordinate become the junction nodes
        start_coord = coords[0]
        end_coord   = coords[-1]
        u = _coord_to_node_id(start_coord[0], start_coord[1])
        v = _coord_to_node_id(end_coord[0],   end_coord[1])

        # Add nodes with coordinate metadata
        if u not in G:
            G.add_node(u, lon=start_coord[0], lat=start_coord[1], district=district)
        if v not in G:
            G.add_node(v, lon=end_coord[0], lat=end_coord[1], district=district)

        edge_attrs = {
            "osmid":                osmid,
            "name":                 name,
            "highway":              highway,
            "surface":              surface,
            "lanes":                lanes,
            "length_m":             length_m,
            "length_km":            length_km,
            "travel_time_min":      travel_time_min,
            "weight":               travel_time_min,  # primary routing weight
            "district":             district,
            "is_night_restricted":  is_night_restricted,
            "is_chokepoint":        is_chokepoint,
            "is_single_lane_bridge": is_single_lane_bridge,
        }

        # Forward direction
        G.add_edge(u, v, key=osmid, **edge_attrs)
        # Reverse direction (unless explicitly one-way)
        if not one_way:
            G.add_edge(v, u, key=f"{osmid}_rev", **edge_attrs)

    return G


# ---------------------------------------------------------------------------
# OSMnx loader (present and functional; not called by default)
# ---------------------------------------------------------------------------

def load_graph_from_osmnx(place_name: str, network_type: str = "drive") -> nx.MultiDiGraph:
    """
    Pull a real road network from OpenStreetMap via OSMnx.

    This function is available and tested but NOT called by default.
    To switch from synthetic GeoJSON to live OSM data, set
    config.GRAPH_DATA_SOURCE = "osmnx" and ensure district place_query
    fields are confirmed.

    Adds the same computed attributes (travel_time_min, weight, district, etc.)
    as load_graph_from_geojson so that all downstream modules are data-source agnostic.
    """
    try:
        import osmnx as ox
    except ImportError:
        raise ImportError(
            "osmnx is required for load_graph_from_osmnx. "
            "Install it: pip install osmnx"
        )

    G_raw = ox.graph_from_place(place_name, network_type=network_type)
    G = nx.MultiDiGraph()

    for node_id, data in G_raw.nodes(data=True):
        G.add_node(str(node_id), lon=data.get("x", 0.0), lat=data.get("y", 0.0), district=place_name)

    for u, v, key, data in G_raw.edges(keys=True, data=True):
        osmid   = str(data.get("osmid", key))
        highway = data.get("highway", "unclassified")
        if isinstance(highway, list):
            highway = highway[0]  # OSMnx may return a list for complex tags
        surface = data.get("surface", "unknown")
        lanes   = data.get("lanes", 1)
        if isinstance(lanes, list):
            try:
                lanes = int(lanes[0])
            except (ValueError, TypeError):
                lanes = 1
        else:
            try:
                lanes = int(lanes)
            except (ValueError, TypeError):
                lanes = 1

        length_m = float(data.get("length", 0.0))
        travel_time_min = _compute_travel_time_min(length_m, highway)

        edge_attrs = {
            "osmid":                osmid,
            "name":                 data.get("name", "Unnamed Road"),
            "highway":              highway,
            "surface":              surface,
            "lanes":                lanes,
            "length_m":             length_m,
            "length_km":            length_m / 1000.0,
            "travel_time_min":      travel_time_min,
            "weight":               travel_time_min,
            "district":             place_name,
            "is_night_restricted":  False,  # Not in OSM tags; can be post-processed
            "is_chokepoint":        False,
            "is_single_lane_bridge": lanes == 1 and data.get("bridge", "no") == "yes",
        }
        G.add_edge(str(u), str(v), key=osmid, **edge_attrs)

    return G


# ---------------------------------------------------------------------------
# District management
# ---------------------------------------------------------------------------

def add_district(
    graph: nx.MultiDiGraph,
    path_or_place: str,
    district_id: Optional[str] = None,
) -> nx.MultiDiGraph:
    """
    Load a new district's road network and merge it into an existing graph.

    This is the entry point for the live-district-addition requirement.
    A judge can call:
        python seed_district.py --geojson new_district.geojson --name "Nagaland-Mon"
    which calls add_district() — zero code changes required.

    Args:
        graph        : The existing combined graph to merge into.
        path_or_place: A file path (GeoJSON) or an OSMnx place name string,
                       depending on config.GRAPH_DATA_SOURCE.
        district_id  : Optional override for district_id tagging.

    Returns:
        The combined graph with the new district merged in.
    """
    if config.GRAPH_DATA_SOURCE == "osmnx" or (
        not os.path.exists(path_or_place) and not path_or_place.endswith(".geojson")
    ):
        new_G = load_graph_from_osmnx(path_or_place)
    else:
        new_G = load_graph_from_geojson(path_or_place)

    # Namespace node IDs with district_id prefix so that loading the same
    # GeoJSON under a different district name NEVER silently overwrites the
    # existing district's nodes via nx.compose (the live-test bug fix).
    if district_id:
        new_G = _namespace_graph(new_G, district_id)  # sets node district attrs too
        # Also update edge district attributes
        for u, v, key in new_G.edges(keys=True):
            new_G[u][v][key]["district"] = district_id

    combined = nx.compose(graph, new_G)
    return combined


# ---------------------------------------------------------------------------
# Module initialisation: load configured districts at import time
# ---------------------------------------------------------------------------

def _load_configured_districts() -> nx.MultiDiGraph:
    """
    Load all districts specified in config.OPERATING_DISTRICTS.
    Called once at module import. Returns the combined graph.
    """
    G = nx.MultiDiGraph()
    for district in config.OPERATING_DISTRICTS:
        did = district["district_id"]
        if config.GRAPH_DATA_SOURCE == "osmnx":
            place = district["place_query"]
            try:
                district_G = load_graph_from_osmnx(place)
            except Exception as e:
                print(f"[graph.py] WARNING: OSMnx load failed for {place}: {e}")
                continue
        else:
            path = config.GEOJSON_PATHS.get(did)
            if not path or not os.path.exists(path):
                print(f"[graph.py] WARNING: GeoJSON not found for district '{did}': {path}")
                continue
            district_G = load_graph_from_geojson(path)

        # Namespace node IDs — consistent with add_district() so the module-level
        # combined graph always uses prefixed node IDs regardless of load path.
        district_G = _namespace_graph(district_G, did)  # sets node district attrs
        # Tag all edges with district_id from config (in case GeoJSON doesn't include it)
        for u, v, key in district_G.edges(keys=True):
            district_G[u][v][key]["district"] = did

        G = nx.compose(G, district_G)
        print(f"[graph.py] Loaded district '{did}': {district_G.number_of_nodes()} nodes, "
              f"{district_G.number_of_edges()} edges")

    return G


# Load on import
_combined_graph = _load_configured_districts()


def get_graph() -> nx.MultiDiGraph:
    """
    Return the current combined road network graph.
    This is the object routing.py consumes directly.
    Any call to add_district() should update this module-level graph.
    """
    return _combined_graph


def reload_with_new_district(path_or_place: str, district_id: Optional[str] = None) -> nx.MultiDiGraph:
    """
    Public entry point used by seed_district.py to add a district at runtime.
    Updates the module-level _combined_graph and returns it.
    """
    global _combined_graph
    _combined_graph = add_district(_combined_graph, path_or_place, district_id)
    return _combined_graph


def get_edge_by_osmid(graph: nx.MultiDiGraph, osmid: str):
    """
    Find and return the (u, v, key, data) tuple for the edge with the given osmid.
    Returns None if not found.
    """
    for u, v, key, data in graph.edges(keys=True, data=True):
        if str(data.get("osmid", "")) == osmid:
            return u, v, key, data
    return None


def list_districts(graph: nx.MultiDiGraph) -> list:
    """
    Return a sorted list of district_id values present in the graph.
    """
    districts = set()
    for _, _, data in graph.edges(data=True):
        d = data.get("district")
        if d:
            districts.add(d)
    return sorted(districts)
