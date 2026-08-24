"""
seed_district.py — Live District Addition CLI
==============================================
Ingest a new district's road network with ONE command, ZERO code changes.

Usage:
    python seed_district.py --geojson data/districts/new_district.geojson --name "Nagaland-Mon"
    python seed_district.py --place "Kohima, Nagaland, India" --name "Nagaland-Kohima"

This is the entry point that satisfies the live-district-addition requirement:
"A judge may ask 'add a third district, show me, right now' as a live test of
whether this is a real system or a hardcoded demo."

After running, the script prints a summary of what was loaded and demonstrates
that routing between nodes in the new district works immediately.
"""

import argparse
import sys
import json

import graph as graph_module
import routing


def main():
    parser = argparse.ArgumentParser(
        description="Nirantar — Seed a new district into the road network",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Load from GeoJSON file (works offline, recommended for demos):
  python seed_district.py --geojson data/districts/my_district.geojson --name "Mon-Nagaland"

  # Load from OpenStreetMap via OSMnx (requires internet):
  python seed_district.py --place "Mon, Nagaland, India" --name "Mon-Nagaland"

GeoJSON requirements:
  - FeatureCollection of LineString features
  - Each feature must have properties: osmid (unique), highway, length_m (optional)
  - Add district_id property to tag edges with this district's slug
  - See data/districts/hill_district.geojson for a complete example
        """
    )

    source_group = parser.add_mutually_exclusive_group(required=True)
    source_group.add_argument(
        "--geojson",
        metavar="PATH",
        help="Path to a GeoJSON file containing the new district's road network",
    )
    source_group.add_argument(
        "--place",
        metavar="PLACE_NAME",
        help="OSMnx place name to fetch from OpenStreetMap (e.g. 'Mon, Nagaland, India')",
    )

    parser.add_argument(
        "--name",
        required=True,
        metavar="DISTRICT_NAME",
        help="Short slug for the new district (e.g. 'Mon-Nagaland'). "
             "Used as district_id on all loaded edges.",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        default=False,
        help="Validate the GeoJSON schema without adding to the live graph.",
    )
    parser.add_argument(
        "--json-output",
        action="store_true",
        default=False,
        help="Output summary as JSON (for programmatic use by other tools).",
    )

    args = parser.parse_args()
    district_id = args.name.lower().replace(" ", "_").replace("-", "_")

    print(f"\n{'='*60}")
    print(f"  Nirantar — Adding District: {args.name}")
    print(f"  district_id: {district_id}")
    print(f"{'='*60}\n")

    # ------------------------------------------------------------------
    # Step 1: Validate GeoJSON schema (if --geojson)
    # ------------------------------------------------------------------
    if args.geojson:
        print(f"[1/4] Validating GeoJSON: {args.geojson}")
        try:
            with open(args.geojson, "r", encoding="utf-8") as f:
                data = json.load(f)
        except FileNotFoundError:
            print(f"ERROR: File not found: {args.geojson}", file=sys.stderr)
            sys.exit(1)
        except json.JSONDecodeError as e:
            print(f"ERROR: Invalid JSON: {e}", file=sys.stderr)
            sys.exit(1)

        if data.get("type") != "FeatureCollection":
            print("ERROR: GeoJSON must be a FeatureCollection", file=sys.stderr)
            sys.exit(1)

        features = data.get("features", [])
        linestrings = [f for f in features if f.get("geometry", {}).get("type") == "LineString"]
        if not linestrings:
            print("ERROR: No LineString features found in GeoJSON", file=sys.stderr)
            sys.exit(1)

        osmid_values = [str(f.get("properties", {}).get("osmid", "")) for f in linestrings]
        if any(not v for v in osmid_values):
            print("WARNING: Some features are missing 'osmid' property — auto-IDs will be assigned.")

        duplicates = set(v for v in osmid_values if osmid_values.count(v) > 1 and v)
        if duplicates:
            print(f"WARNING: Duplicate osmid values found: {duplicates}")

        print(f"  [OK] Valid FeatureCollection with {len(linestrings)} LineString road feature(s)")

        if args.validate_only:
            print("\n[--validate-only] Validation complete. No changes made to live graph.")
            sys.exit(0)

    # ------------------------------------------------------------------
    # Step 2: Load into graph
    # ------------------------------------------------------------------
    print(f"\n[2/4] Loading current graph...")
    existing_graph = graph_module.get_graph()
    print(f"  Current graph: {existing_graph.number_of_nodes()} nodes, "
          f"{existing_graph.number_of_edges()} edges, "
          f"districts: {graph_module.list_districts(existing_graph)}")

    print(f"\n[3/4] Adding district '{args.name}'...")
    try:
        source = args.geojson if args.geojson else args.place
        updated_graph = graph_module.reload_with_new_district(source, district_id=district_id)
    except Exception as e:
        print(f"ERROR: Failed to load district: {e}", file=sys.stderr)
        sys.exit(1)

    new_nodes = updated_graph.number_of_nodes() - existing_graph.number_of_nodes()
    new_edges = updated_graph.number_of_edges() - existing_graph.number_of_edges()
    print(f"  [OK] District added: +{new_nodes} nodes, +{new_edges} edges")
    print(f"  Updated graph: {updated_graph.number_of_nodes()} nodes, "
          f"{updated_graph.number_of_edges()} edges, "
          f"districts: {graph_module.list_districts(updated_graph)}")

    # ------------------------------------------------------------------
    # Step 3: Invalidate route cache and demonstrate routing
    # ------------------------------------------------------------------
    print(f"\n[4/4] Invalidating route cache and verifying routing...")
    routing.invalidate_cache()

    # Find nodes in the new district
    new_district_nodes = [
        n for n, d in updated_graph.nodes(data=True)
        if d.get("district") == district_id
    ]

    demo_result = None
    if len(new_district_nodes) >= 2:
        origin = new_district_nodes[0]
        dest   = new_district_nodes[-1]
        demo_result = routing.find_route(updated_graph, origin, dest)
        if demo_result:
            print(f"  [OK] Demo route ({district_id}): "
                  f"{origin} -> {dest} | "
                  f"{demo_result['total_time_minutes']:.1f} min | "
                  f"{demo_result['total_distance_km']:.1f} km | "
                  f"{len(demo_result['path'])} nodes in path")
        else:
            print(f"  [WARN] No route found between demo nodes (graph may be disconnected)")
    else:
        print(f"  [WARN] Not enough nodes in district '{district_id}' for a demo route")

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    summary = {
        "district_name":     args.name,
        "district_id":       district_id,
        "nodes_added":       new_nodes,
        "edges_added":       new_edges,
        "total_nodes":       updated_graph.number_of_nodes(),
        "total_edges":       updated_graph.number_of_edges(),
        "all_districts":     graph_module.list_districts(updated_graph),
        "demo_route":        demo_result,
    }

    if args.json_output:
        print("\n" + json.dumps(summary, indent=2))
    else:
        print(f"\n{'='*60}")
        print(f"  SUCCESS — District '{args.name}' is LIVE")
        print(f"  Total districts now: {summary['all_districts']}")
        print(f"{'='*60}\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
