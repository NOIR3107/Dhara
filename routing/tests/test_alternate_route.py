"""
tests/test_alternate_route.py — Module 3: Blocked-road rerouting
Critical edge cases tested explicitly:
    1. A blocked edge triggers rerouting to a valid alternate.
    2. A fully cut-off village returns "no_route_available" (not crash, not None route).
"""
import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import networkx as nx
import graph as graph_module
import routing
import alternate_route
import config


# ---------------------------------------------------------------------------
# Fixture: a small, fully controlled graph for deterministic testing
# ---------------------------------------------------------------------------

@pytest.fixture
def controlled_graph():
    """
    Topology:
        A --e1--> B --e2--> C
                  |          |
                 e3          e4
                  |          |
                  D ---------+  (D is the isolated leaf — only e3 connects it)

    To cut off D: block e3.
    To force rerouting A→C: block e2, use A→B→D→C alternative (won't exist here — just block e2).

    Simplified linear + spur for the test:
        A --e1(10min)--> B --e2(10min)--> C
                              \
                               e_spur(15min)--> D  (D is a leaf; only reachable via e_spur)
    """
    G = nx.MultiDiGraph()
    nodes = {
        "A": {"lon": 0.0, "lat": 0.0},
        "B": {"lon": 1.0, "lat": 0.0},
        "C": {"lon": 2.0, "lat": 0.0},
        "D": {"lon": 1.5, "lat": 1.0},  # leaf node
    }
    for n, attrs in nodes.items():
        G.add_node(n, **attrs, district="test")

    edges = [
        ("A", "B", "e1", 10.0, 8.0),
        ("B", "A", "e1_rev", 10.0, 8.0),
        ("B", "C", "e2", 10.0, 8.0),
        ("C", "B", "e2_rev", 10.0, 8.0),
        ("A", "C", "e_direct", 22.0, 18.0),   # longer direct route A→C
        ("C", "A", "e_direct_rev", 22.0, 18.0),
        # D is ONLY reachable via e_spur from B
        ("B", "D", "e_spur", 15.0, 12.0),
        ("D", "B", "e_spur_rev", 15.0, 12.0),
    ]
    for u, v, osmid, time_min, dist_km in edges:
        G.add_edge(u, v, key=osmid, osmid=osmid, name=f"Road {osmid}",
                   highway="secondary", surface="paved",
                   travel_time_min=time_min, weight=time_min,
                   length_km=dist_km, length_m=dist_km * 1000,
                   district="test", is_night_restricted=False,
                   is_chokepoint=False, is_single_lane_bridge=False)
    return G


class TestAlternateRoute:
    def test_no_blocked_edges_returns_rerouted(self, controlled_graph):
        """When nothing is blocked, status should be 'rerouted' with the normal route."""
        result = alternate_route.find_alternate(controlled_graph, "A", "C", {})
        assert result["status"] == "rerouted"
        assert result["route"] is not None
        assert result["blocked_edges"] == []

    def test_blocked_edge_triggers_reroute(self, controlled_graph):
        """Blocking e2 (the direct B→C edge) forces rerouting via e_direct."""
        closure_probs = {"e2": config.CLOSURE_THRESHOLD, "e2_rev": config.CLOSURE_THRESHOLD}
        result = alternate_route.find_alternate(controlled_graph, "A", "C", closure_probs)

        assert result["status"] == "rerouted"
        assert result["route"] is not None
        assert "e2" in result["blocked_edges"]
        # The alternate route must NOT use e2
        route_edge_ids = routing.get_route_edge_ids(result["route"])
        assert "e2" not in route_edge_ids

    def test_cut_off_village_returns_no_route_available(self, controlled_graph):
        """
        CRITICAL TEST: When e_spur (the only path to D) is blocked,
        the result must be status='no_route_available', not a crash or None.
        """
        closure_probs = {
            "e_spur":     config.CLOSURE_THRESHOLD,
            "e_spur_rev": config.CLOSURE_THRESHOLD,
        }
        result = alternate_route.find_alternate(controlled_graph, "A", "D", closure_probs)

        assert result["status"] == "no_route_available", (
            f"Expected 'no_route_available' for a cut-off village, got: {result['status']}"
        )
        assert result["route"] is None, "route must be None when no route is available"
        assert len(result["blocked_edges"]) > 0
        assert isinstance(result["reason"], str)
        assert len(result["reason"]) > 0

    def test_no_route_available_is_not_an_exception(self, controlled_graph):
        """The cut-off state must never raise an exception."""
        closure_probs = {"e_spur": 1.0, "e_spur_rev": 1.0}
        try:
            result = alternate_route.find_alternate(controlled_graph, "A", "D", closure_probs)
            assert result is not None
        except Exception as e:
            pytest.fail(f"find_alternate raised an exception for a cut-off village: {e}")

    def test_blocked_edges_identified_correctly(self, controlled_graph):
        """Edges at exactly the threshold must be treated as blocked."""
        closure_probs = {
            "e1":     config.CLOSURE_THRESHOLD,       # exactly at threshold → blocked
            "e2":     config.CLOSURE_THRESHOLD - 0.01, # just below → NOT blocked
        }
        blocked = alternate_route._identify_blocked_edges(closure_probs)
        assert "e1" in blocked
        assert "e2" not in blocked

    def test_original_graph_not_mutated(self, controlled_graph):
        """Removing blocked edges must work on a copy — original must be unchanged."""
        original_edges = controlled_graph.number_of_edges()
        closure_probs = {"e1": 1.0, "e1_rev": 1.0}
        alternate_route.find_alternate(controlled_graph, "A", "C", closure_probs)
        assert controlled_graph.number_of_edges() == original_edges

    def test_reason_string_is_nonempty(self, controlled_graph):
        closure_probs = {"e2": 0.9, "e2_rev": 0.9}
        result = alternate_route.find_alternate(controlled_graph, "A", "C", closure_probs)
        assert isinstance(result["reason"], str)
        assert len(result["reason"]) > 10

    def test_compute_route_risk_all_zeros(self, controlled_graph):
        route = routing.find_route(controlled_graph, "A", "C")
        if route:
            risk = alternate_route.compute_route_risk(route, {})
            assert risk == 0.0

    def test_compute_route_risk_nonzero(self, controlled_graph):
        route = routing.find_route(controlled_graph, "A", "C")
        if route:
            probs = {e["osmid"]: 0.5 for e in route["edges"]}
            risk = alternate_route.compute_route_risk(route, probs)
            assert 0.0 < risk <= 1.0


class TestAlternateRouteWithRealGraph:
    """Tests using the actual placeholder GeoJSON data."""

    @pytest.fixture
    def real_graph(self):
        path = os.path.join(
            os.path.dirname(__file__), "..", "data", "districts", "hill_district.geojson"
        )
        return graph_module.load_graph_from_geojson(path)

    def test_high_probability_blocks_edge(self, real_graph):
        """Setting all edges to high probability should return no_route_available
        for a node only reachable through a single path."""
        # Block all edges — everything unreachable
        all_osmids = {
            data["osmid"]: 1.0
            for u, v, key, data in real_graph.edges(keys=True, data=True)
        }
        nodes = list(real_graph.nodes())
        if len(nodes) >= 2:
            result = alternate_route.find_alternate(real_graph, nodes[0], nodes[-1], all_osmids)
            # With all edges blocked, should be no_route_available
            assert result["status"] == "no_route_available"

    def test_zero_probability_no_blocking(self, real_graph):
        """With all probabilities at 0, no edges should be blocked."""
        nodes = list(real_graph.nodes())
        if len(nodes) >= 2:
            all_osmids = {
                data["osmid"]: 0.0
                for u, v, key, data in real_graph.edges(keys=True, data=True)
            }
            result = alternate_route.find_alternate(real_graph, nodes[0], nodes[1], all_osmids)
            assert result["blocked_edges"] == []
