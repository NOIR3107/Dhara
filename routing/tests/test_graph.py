"""
tests/test_graph.py — Module 1: Graph loading and district management
"""
import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import networkx as nx
import graph as graph_module


@pytest.fixture
def hill_geojson_path():
    return os.path.join(os.path.dirname(__file__), "..", "data", "districts", "hill_district.geojson")


@pytest.fixture
def valley_geojson_path():
    return os.path.join(os.path.dirname(__file__), "..", "data", "districts", "valley_district.geojson")


class TestGeoJSONLoad:
    def test_load_hill_district(self, hill_geojson_path):
        G = graph_module.load_graph_from_geojson(hill_geojson_path)
        assert G.number_of_nodes() > 0
        assert G.number_of_edges() > 0

    def test_load_valley_district(self, valley_geojson_path):
        G = graph_module.load_graph_from_geojson(valley_geojson_path)
        assert G.number_of_nodes() > 0
        assert G.number_of_edges() > 0

    def test_edges_have_required_attributes(self, hill_geojson_path):
        G = graph_module.load_graph_from_geojson(hill_geojson_path)
        for u, v, key, data in G.edges(keys=True, data=True):
            assert "osmid"            in data, f"Edge {u}-{v} missing osmid"
            assert "highway"          in data, f"Edge {u}-{v} missing highway"
            assert "travel_time_min"  in data, f"Edge {u}-{v} missing travel_time_min"
            assert "weight"           in data, f"Edge {u}-{v} missing weight"
            assert "length_km"        in data, f"Edge {u}-{v} missing length_km"
            assert data["travel_time_min"] > 0, f"Edge {u}-{v} has non-positive travel time"
            assert data["weight"] == data["travel_time_min"], "weight must equal travel_time_min"

    def test_nodes_have_coordinates(self, hill_geojson_path):
        G = graph_module.load_graph_from_geojson(hill_geojson_path)
        for node, data in G.nodes(data=True):
            assert "lon" in data, f"Node {node} missing lon"
            assert "lat" in data, f"Node {node} missing lat"

    def test_both_directions_loaded(self, hill_geojson_path):
        """Roads should be traversable in both directions (undirected semantics)."""
        G = graph_module.load_graph_from_geojson(hill_geojson_path)
        # Count forward vs reverse edges
        forward = [k for u, v, k in G.edges(keys=True) if not str(k).endswith("_rev")]
        reverse = [k for u, v, k in G.edges(keys=True) if str(k).endswith("_rev")]
        assert len(forward) > 0
        assert len(reverse) > 0

    def test_missing_file_raises_error(self):
        with pytest.raises(FileNotFoundError):
            graph_module.load_graph_from_geojson("nonexistent.geojson")

    def test_travel_time_increases_with_length(self, hill_geojson_path):
        """Longer roads should always take more time than shorter ones for the same highway class."""
        G = graph_module.load_graph_from_geojson(hill_geojson_path)
        primary_edges = [
            data for u, v, key, data in G.edges(keys=True, data=True)
            if data.get("highway") == "primary"
        ]
        if len(primary_edges) >= 2:
            primary_edges.sort(key=lambda d: d["length_m"])
            assert primary_edges[0]["travel_time_min"] <= primary_edges[-1]["travel_time_min"]


class TestDistrictManagement:
    def test_get_graph_returns_combined(self):
        G = graph_module.get_graph()
        assert isinstance(G, nx.MultiDiGraph)
        districts = graph_module.list_districts(G)
        assert len(districts) >= 1  # at least one district loaded

    def test_add_district_merges_correctly(self, valley_geojson_path):
        base_G = graph_module.load_graph_from_geojson(valley_geojson_path)
        hill_path = os.path.join(
            os.path.dirname(__file__), "..", "data", "districts", "hill_district.geojson"
        )
        combined = graph_module.add_district(base_G, hill_path, district_id="test_hill")
        assert combined.number_of_nodes() > base_G.number_of_nodes()
        assert combined.number_of_edges() > base_G.number_of_edges()

    def test_list_districts(self, hill_geojson_path):
        G = graph_module.load_graph_from_geojson(hill_geojson_path)
        districts = graph_module.list_districts(G)
        assert isinstance(districts, list)
        assert len(districts) > 0

    def test_district_tagging(self, hill_geojson_path):
        G = graph_module.load_graph_from_geojson(hill_geojson_path)
        for u, v, key, data in G.edges(keys=True, data=True):
            assert "district" in data

    def test_get_edge_by_osmid(self, hill_geojson_path):
        G = graph_module.load_graph_from_geojson(hill_geojson_path)
        # Get first edge osmid
        first_osmid = next(iter(G.edges(data=True)))[2].get("osmid")
        result = graph_module.get_edge_by_osmid(G, str(first_osmid))
        assert result is not None
        u, v, key, data = result
        assert str(data["osmid"]) == str(first_osmid)

    def test_get_edge_by_osmid_not_found(self, hill_geojson_path):
        G = graph_module.load_graph_from_geojson(hill_geojson_path)
        result = graph_module.get_edge_by_osmid(G, "NONEXISTENT_OSMID_XYZ")
        assert result is None


class TestDistrictNamespacing:
    """
    Regression tests for the district-ID collision bug discovered in the live test:

        copy valley_district.geojson test_district.geojson
        python seed_district.py --geojson test_district.geojson --name "Test District"
        → "+0 nodes, +0 edges" added
        → old district's nodes silently relabeled under the new district name

    Root cause: node IDs were coordinate-based strings (e.g. "94.0,27.0").
    When two district files share the same coordinates, nx.compose treated them
    as the same nodes and silently overwrote the 'district' attribute.

    Fix: _namespace_graph() prefixes every node ID with '{district_id}::' before
    composing, so collisions are impossible regardless of input data.
    """

    def test_same_file_loaded_twice_doubles_nodes_and_edges(self, hill_geojson_path):
        """
        Loading the same GeoJSON under two different district names must result
        in a combined graph whose node and edge counts are exactly 2× the
        single-district count — not 1× (silent overwrite).

        This is the exact scenario that produced "+0 nodes, +0 edges" before the fix.
        """
        import networkx as nx

        # Load as district_a
        G_empty = nx.MultiDiGraph()
        G_with_a = graph_module.add_district(G_empty, hill_geojson_path, district_id="district_a")
        nodes_a = G_with_a.number_of_nodes()
        edges_a = G_with_a.number_of_edges()

        assert nodes_a > 0, "district_a must have nodes"
        assert edges_a > 0, "district_a must have edges"

        # Load the SAME file again as district_b (the collision scenario)
        G_with_both = graph_module.add_district(G_with_a, hill_geojson_path, district_id="district_b")

        # BUG (before fix): number_of_nodes() == nodes_a  (+0 nodes)
        # CORRECT (after fix): number_of_nodes() == 2 * nodes_a
        assert G_with_both.number_of_nodes() == 2 * nodes_a, (
            f"Expected {2 * nodes_a} nodes after adding a duplicate district, "
            f"got {G_with_both.number_of_nodes()} — district ID collision not prevented."
        )
        assert G_with_both.number_of_edges() == 2 * edges_a, (
            f"Expected {2 * edges_a} edges after adding a duplicate district, "
            f"got {G_with_both.number_of_edges()}."
        )

    def test_both_district_names_survive_after_duplicate_load(self, hill_geojson_path):
        """
        After loading the same file under district_b, district_a must still
        appear in list_districts() — it must NOT be silently replaced.

        BUG (before fix): list_districts() returned ['district_b'] only,
        because all nodes' 'district' attribute got overwritten.
        """
        import networkx as nx

        G_empty = nx.MultiDiGraph()
        G_with_a = graph_module.add_district(G_empty, hill_geojson_path, district_id="district_a")
        G_with_both = graph_module.add_district(G_with_a, hill_geojson_path, district_id="district_b")

        districts = graph_module.list_districts(G_with_both)
        assert "district_a" in districts, (
            f"district_a was lost after adding district_b from the same file. "
            f"Got: {districts}"
        )
        assert "district_b" in districts, f"district_b not found. Got: {districts}"

    def test_node_ids_are_district_namespaced(self, hill_geojson_path):
        """
        Every node in a district-added graph must have the district_id
        prefix in its node key (e.g. 'district_a::94.0,27.0').
        """
        import networkx as nx

        G_empty = nx.MultiDiGraph()
        G = graph_module.add_district(G_empty, hill_geojson_path, district_id="district_a")
        for node in G.nodes():
            assert node.startswith("district_a::"), (
                f"Node '{node}' is missing the 'district_a::' namespace prefix."
            )

    def test_node_district_attribute_matches_district_id(self, hill_geojson_path):
        """
        The 'district' attribute on every node must equal the district_id
        passed to add_district(), not the district_id embedded in the GeoJSON.
        This matters when the same file is re-used under a different name.
        """
        import networkx as nx

        G_empty = nx.MultiDiGraph()
        G = graph_module.add_district(G_empty, hill_geojson_path, district_id="reused_as_x")
        for node, data in G.nodes(data=True):
            assert data.get("district") == "reused_as_x", (
                f"Node '{node}' has district='{data.get('district')}', "
                f"expected 'reused_as_x'."
            )

    def test_edge_district_attribute_matches_district_id(self, hill_geojson_path):
        """
        The 'district' attribute on every edge must also reflect the new district_id.
        """
        import networkx as nx

        G_empty = nx.MultiDiGraph()
        G = graph_module.add_district(G_empty, hill_geojson_path, district_id="reused_as_y")
        for u, v, key, data in G.edges(keys=True, data=True):
            assert data.get("district") == "reused_as_y", (
                f"Edge '{key}' has district='{data.get('district')}', "
                f"expected 'reused_as_y'."
            )

    def test_namespace_graph_helper_is_public(self):
        """
        _namespace_graph is accessible for testing — regression guard to ensure
        the function is not removed or renamed without updating tests.
        """
        assert hasattr(graph_module, "_namespace_graph"), (
            "_namespace_graph must remain accessible for the collision-prevention guarantee."
        )

    def test_routing_works_after_namespaced_load(self, hill_geojson_path):
        """
        Routes within a namespaced district must still resolve correctly —
        namespacing changes node keys but must not break graph connectivity.
        """
        import networkx as nx

        G_empty = nx.MultiDiGraph()
        G = graph_module.add_district(G_empty, hill_geojson_path, district_id="routing_test")

        import routing as rt
        nodes = list(G.nodes())
        if len(nodes) >= 2:
            result = rt.find_route(G, nodes[0], nodes[-1], use_cache=False)
            # Graph may not be fully connected — just check it doesn't crash
            assert result is None or "path" in result
