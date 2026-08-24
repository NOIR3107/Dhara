"""
tests/test_routing.py — Module 2: Route finding and cache
"""
import os
import sys
import time
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import graph as graph_module
import routing


@pytest.fixture(scope="module")
def loaded_graph():
    path = os.path.join(os.path.dirname(__file__), "..", "data", "districts", "hill_district.geojson")
    return graph_module.load_graph_from_geojson(path)


@pytest.fixture(scope="module")
def graph_nodes(loaded_graph):
    return list(loaded_graph.nodes())


class TestFindRoute:
    def test_route_exists_between_connected_nodes(self, loaded_graph, graph_nodes):
        origin = graph_nodes[0]
        dest   = graph_nodes[-1]
        result = routing.find_route(loaded_graph, origin, dest)
        # May or may not be connected — check structure if not None
        if result is not None:
            assert "origin"             in result
            assert "destination"        in result
            assert "path"               in result
            assert "total_time_minutes" in result
            assert "total_distance_km"  in result
            assert "edges"              in result
            assert result["origin"]      == origin
            assert result["destination"] == dest
            assert len(result["path"])   >= 2
            assert result["total_time_minutes"] > 0
            assert result["total_distance_km"]  > 0

    def test_route_same_origin_destination(self, loaded_graph, graph_nodes):
        node = graph_nodes[0]
        result = routing.find_route(loaded_graph, node, node)
        assert result is not None
        assert result["total_time_minutes"] == 0.0
        assert result["total_distance_km"]  == 0.0
        assert result["path"] == [node]

    def test_route_invalid_origin_raises(self, loaded_graph, graph_nodes):
        with pytest.raises(ValueError):
            routing.find_route(loaded_graph, "NONEXISTENT_NODE_XYZ", graph_nodes[0])

    def test_route_invalid_dest_raises(self, loaded_graph, graph_nodes):
        with pytest.raises(ValueError):
            routing.find_route(loaded_graph, graph_nodes[0], "NONEXISTENT_NODE_XYZ")

    def test_route_edges_match_path(self, loaded_graph, graph_nodes):
        """Number of edges in result should be len(path) - 1."""
        origin = graph_nodes[0]
        dest   = graph_nodes[-1]
        result = routing.find_route(loaded_graph, origin, dest)
        if result is not None and len(result["path"]) > 1:
            assert len(result["edges"]) == len(result["path"]) - 1

    def test_route_total_time_is_sum_of_edges(self, loaded_graph, graph_nodes):
        origin = graph_nodes[0]
        dest   = graph_nodes[-1]
        result = routing.find_route(loaded_graph, origin, dest)
        if result is not None and result["edges"]:
            computed = sum(e["travel_time_min"] for e in result["edges"])
            assert abs(computed - result["total_time_minutes"]) < 0.01

    def test_route_total_distance_is_sum_of_edges(self, loaded_graph, graph_nodes):
        origin = graph_nodes[0]
        dest   = graph_nodes[-1]
        result = routing.find_route(loaded_graph, origin, dest)
        if result is not None and result["edges"]:
            computed = sum(e["length_km"] for e in result["edges"])
            assert abs(computed - result["total_distance_km"]) < 0.01

    def test_disconnected_nodes_return_none(self, loaded_graph):
        """Routing between disconnected nodes must return None, not raise."""
        import networkx as nx
        isolated_G = nx.MultiDiGraph()
        isolated_G.add_node("isolated_a", lon=0.0, lat=0.0)
        isolated_G.add_node("isolated_b", lon=1.0, lat=1.0)
        result = routing.find_route(isolated_G, "isolated_a", "isolated_b")
        assert result is None


class TestRouteCache:
    def test_cache_returns_same_result(self, loaded_graph, graph_nodes):
        routing.invalidate_cache()
        origin = graph_nodes[0]
        dest   = graph_nodes[-1]
        result1 = routing.find_route(loaded_graph, origin, dest, use_cache=True)
        result2 = routing.find_route(loaded_graph, origin, dest, use_cache=True)
        assert result1 == result2

    def test_cache_invalidation(self, loaded_graph, graph_nodes):
        routing.invalidate_cache()
        initial_size = routing._route_cache.size()
        origin = graph_nodes[0]
        dest   = graph_nodes[-1]
        routing.find_route(loaded_graph, origin, dest, use_cache=True)
        routing.invalidate_cache()
        assert routing._route_cache.size() == 0

    def test_cache_bypass(self, loaded_graph, graph_nodes):
        """use_cache=False should still return a valid route."""
        origin = graph_nodes[0]
        dest   = graph_nodes[-1]
        result = routing.find_route(loaded_graph, origin, dest, use_cache=False)
        if result is not None:
            assert "path" in result

    def test_cache_precompute(self, loaded_graph):
        routing.invalidate_cache()
        routing.precompute_routes(loaded_graph)
        assert routing._route_cache.size() > 0

    def test_cached_route_resolves_fast(self, loaded_graph, graph_nodes):
        """A cached route lookup must resolve in under 2 seconds."""
        routing.invalidate_cache()
        origin = graph_nodes[0]
        dest   = graph_nodes[-1]
        routing.find_route(loaded_graph, origin, dest, use_cache=True)  # populate cache
        start = time.perf_counter()
        routing.find_route(loaded_graph, origin, dest, use_cache=True)
        elapsed = time.perf_counter() - start
        assert elapsed < 2.0, f"Cached route lookup took {elapsed:.3f}s (must be < 2s)"


class TestGetRouteEdgeIds:
    def test_returns_list_of_strings(self, loaded_graph, graph_nodes):
        origin = graph_nodes[0]
        dest   = graph_nodes[-1]
        result = routing.find_route(loaded_graph, origin, dest)
        if result is not None:
            edge_ids = routing.get_route_edge_ids(result)
            assert isinstance(edge_ids, list)
            assert all(isinstance(e, str) for e in edge_ids)
