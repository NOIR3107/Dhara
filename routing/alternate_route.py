"""
alternate_route.py — Module 3: Blocked-Road Rerouting
=======================================================
Consumes closure probabilities (edge_id → float, 0-1) from Shriti's model
and field reports from field_reports.py, identifies blocked edges above the
configured threshold, removes them from the graph, and re-runs routing.

The "no_route_available" status is a FIRST-CLASS explicit result —
never an exception, never a silent fallback to a blocked route.
This is the signal that a village/node is CUT OFF, and must be treated
distinctly by all downstream consumers (alerts.py, automation.py, Bhoomika's UI).

Output structure:
{
    "status":        "rerouted" | "no_route_available",
    "route":         RouteResult | None,
    "blocked_edges": [edge_id, ...],
    "reason":        "plain-English explanation string"
}
"""

from __future__ import annotations

from typing import Dict, List, Optional

import networkx as nx

import config
import routing
from routing import RouteResult


# ---------------------------------------------------------------------------
# Type alias
# ---------------------------------------------------------------------------
AlternateResult = Dict


# ---------------------------------------------------------------------------
# Core function
# ---------------------------------------------------------------------------

def find_alternate(
    graph: nx.MultiDiGraph,
    origin: str,
    destination: str,
    closure_probs: Dict[str, float],
) -> AlternateResult:
    """
    Find the best available route given that some edges may be blocked.

    Args:
        graph         : The current road network graph (from graph.get_graph())
        origin        : Start node ID
        destination   : End node ID
        closure_probs : Dict mapping edge osmid → closure probability (0.0–1.0)
                        Produced by Shriti's model + field_reports.py adjustment.
                        Edges at or above config.CLOSURE_THRESHOLD are treated as blocked.

    Returns:
        AlternateResult dict with status, route (or None), blocked_edges, and reason.
    """
    # Step 1: Identify blocked edges
    blocked_edges = _identify_blocked_edges(closure_probs)

    if not blocked_edges:
        # No edges are blocked — just find the normal route
        route = routing.find_route(graph, origin, destination, use_cache=True)
        if route is None:
            return _no_route_result(
                origin, destination, blocked_edges,
                reason=f"No route exists between {origin} and {destination} "
                       f"even without any blocked edges. "
                       f"Nodes may be in disconnected graph components."
            )
        return {
            "status":        "rerouted",
            "route":         route,
            "blocked_edges": [],
            "reason":        (
                f"No edges above closure threshold "
                f"({config.CLOSURE_THRESHOLD:.0%}). "
                f"Normal route used: {_summarise_path(route)}."
            ),
        }

    # Step 2: Build subgraph with blocked edges removed
    subgraph = _remove_blocked_edges(graph, blocked_edges)

    # Step 3: Attempt routing on the subgraph
    # Bypass cache — subgraph is a transient computation
    route = routing.find_route(subgraph, origin, destination, use_cache=False)

    if route is None:
        # Destination is completely unreachable after removing blocked edges
        # This is an explicit CUT-OFF state — not an error
        return _no_route_result(
            origin, destination, blocked_edges,
            reason=(
                f"All routes between {origin} and {destination} pass through "
                f"{len(blocked_edges)} blocked segment(s) "
                f"(closure probability ≥ {config.CLOSURE_THRESHOLD:.0%}): "
                f"{', '.join(blocked_edges[:5])}{'...' if len(blocked_edges) > 5 else ''}. "
                f"No viable alternative exists — village/node may be CUT OFF."
            )
        )

    # Step 4: Reroute found
    return {
        "status":        "rerouted",
        "route":         route,
        "blocked_edges": blocked_edges,
        "reason":        (
            f"{len(blocked_edges)} edge(s) blocked "
            f"(closure probability ≥ {config.CLOSURE_THRESHOLD:.0%}): "
            f"{', '.join(blocked_edges[:5])}{'...' if len(blocked_edges) > 5 else ''}. "
            f"Alternate route found: {_summarise_path(route)}."
        ),
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _identify_blocked_edges(closure_probs: Dict[str, float]) -> List[str]:
    """
    Return a list of edge osmids whose closure probability meets or exceeds
    config.CLOSURE_THRESHOLD. Order is deterministic (sorted) for consistent output.
    """
    threshold = config.CLOSURE_THRESHOLD
    return sorted(
        edge_id
        for edge_id, prob in closure_probs.items()
        if prob >= threshold
    )


def _remove_blocked_edges(
    graph: nx.MultiDiGraph,
    blocked_edge_ids: List[str],
) -> nx.MultiDiGraph:
    """
    Return a view of the graph with all blocked edges removed.
    Uses nx.restricted_view / edge filtering — does NOT mutate the original graph.

    The returned subgraph is a new MultiDiGraph (copy) to ensure routing.py
    can operate on it without side effects.
    """
    blocked_set = set(blocked_edge_ids)
    # Build list of (u, v, key) tuples to remove
    edges_to_remove = [
        (u, v, key)
        for u, v, key, data in graph.edges(keys=True, data=True)
        if str(data.get("osmid", "")) in blocked_set
    ]

    # Work on a copy — never mutate the live graph
    subgraph = graph.copy()
    subgraph.remove_edges_from(edges_to_remove)
    return subgraph


def _summarise_path(route: RouteResult) -> str:
    """Build a short human-readable path summary for reason strings."""
    path = route.get("path", [])
    if len(path) <= 4:
        return " → ".join(path)
    return f"{path[0]} → ... ({len(path) - 2} intermediate nodes) ... → {path[-1]}"


def _no_route_result(
    origin: str,
    destination: str,
    blocked_edges: List[str],
    reason: str,
) -> AlternateResult:
    """
    Construct the explicit 'no_route_available' result.
    This is a distinct status value — not None, not an exception.
    Consumers (alerts.py, automation.py) must check for this status explicitly.
    """
    return {
        "status":        "no_route_available",
        "route":         None,
        "blocked_edges": blocked_edges,
        "reason":        reason,
    }


# ---------------------------------------------------------------------------
# Aggregate route risk (used by alerts.py for high_risk_corridor)
# ---------------------------------------------------------------------------

def compute_route_risk(route: RouteResult, closure_probs: Dict[str, float]) -> float:
    """
    Compute the aggregate risk for a route as the mean closure probability
    across all its edges.

    Returns 0.0 if the route has no edges or no probability data.
    This value is consumed by alerts.check_high_risk_corridor().
    """
    edge_ids = routing.get_route_edge_ids(route)
    if not edge_ids:
        return 0.0
    probs = [closure_probs.get(eid, 0.0) for eid in edge_ids]
    return sum(probs) / len(probs)
