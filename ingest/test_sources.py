"""
Test availability of real datasets:
1. Open-Meteo (Rainfall)
2. NASA COOLR (Landslides via HDX)
3. OpenStreetMap via Overpass API / OSMnx (Roads & Health Facilities)
4. GeoNames India (Habitations)
5. GADM India (Boundaries)
6. SRTM / Open-Elevation / OpenTopography (Slope)
"""
import urllib.request
import urllib.parse
import json
import os
import zipfile

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "real")
os.makedirs(DATA_DIR, exist_ok=True)

def test_openmeteo():
    print("Testing 1. Open-Meteo Rainfall API...")
    url = "https://archive-api.open-meteo.com/v1/archive?latitude=27.58&longitude=91.86&start_date=2024-06-01&end_date=2024-06-10&daily=precipitation_sum,rain_sum"
    req = urllib.request.Request(url, headers={"User-Agent": "DHARA-Ingest/1.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode())
        print("  [SUCCESS] Open-Meteo returned", len(data["daily"]["precipitation_sum"]), "days of rainfall data.")
        return True

def test_nasa_coolr():
    print("Testing 2. NASA COOLR Landslide Catalog (HDX link)...")
    url = "https://data.humdata.org/dataset/1eb911ba-3681-4a96-b025-ae0c33b80a12/resource/ed703c45-2001-4286-ba16-8248c17fec80/download/global_landslide_catalog_nasa.zip"
    dest = os.path.join(DATA_DIR, "global_landslide_catalog_nasa.zip")
    req = urllib.request.Request(url, headers={"User-Agent": "DHARA-Ingest/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        content = resp.read()
        with open(dest, "wb") as f:
            f.write(content)
        print(f"  [SUCCESS] NASA COOLR downloaded ({len(content)} bytes) -> {dest}")
        return True

def test_geonames_india():
    print("Testing 4. GeoNames India Habitations...")
    # GeoNames public IN.zip download
    url = "https://download.geonames.org/export/dump/IN.zip"
    dest = os.path.join(DATA_DIR, "IN.zip")
    req = urllib.request.Request(url, headers={"User-Agent": "DHARA-Ingest/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            content = resp.read()
            with open(dest, "wb") as f:
                f.write(content)
            print(f"  [SUCCESS] GeoNames India downloaded ({len(content)} bytes) -> {dest}")
            return True
    except Exception as e:
        print(f"  [ERR] GeoNames: {e}")
        return False

def test_osm_roads_facilities():
    print("Testing 3 & 6. OpenStreetMap via Overpass / OSMnx...")
    # Overpass API for North East India bounding box (e.g. 26.5 to 28.5 lat, 91.0 to 93.0 lon)
    query = """
    [out:json][timeout:25];
    (
      node["amenity"="hospital"](26.8,91.5,27.8,92.8);
      node["amenity"="clinic"](26.8,91.5,27.8,92.8);
      way["highway"~"primary|secondary|tertiary|trunk"](27.5,91.7,27.7,92.0);
    );
    out body;
    >;
    out skel qt;
    """
    url = "https://overpass-api.de/api/interpreter"
    data = urllib.parse.urlencode({"data": query}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"User-Agent": "DHARA-Ingest/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            res = json.loads(resp.read().decode())
            elements = res.get("elements", [])
            print(f"  [SUCCESS] Overpass API returned {len(elements)} OSM elements.")
            return True
    except Exception as e:
        print(f"  [ERR] OSM Overpass API: {e}")
        return False

def test_gadm_boundaries():
    print("Testing 5. GADM India Administrative Boundaries...")
    # GADM 4.1 India GeoJSON/JSON
    url = "https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_IND_2.json.zip"
    dest = os.path.join(DATA_DIR, "gadm41_IND_2.json.zip")
    req = urllib.request.Request(url, headers={"User-Agent": "DHARA-Ingest/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read()
            with open(dest, "wb") as f:
                f.write(content)
            print(f"  [SUCCESS] GADM India downloaded ({len(content)} bytes) -> {dest}")
            return True
    except Exception as e:
        print(f"  [ERR] GADM: {e}")
        return False

def test_srtm_elevation():
    print("Testing 7. SRTM / Open-Elevation API...")
    url = "https://api.open-elevation.com/api/v1/lookup?locations=27.58,91.86|27.59,91.87"
    req = urllib.request.Request(url, headers={"User-Agent": "DHARA-Ingest/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            res = json.loads(resp.read().decode())
            print(f"  [SUCCESS] Open-Elevation returned elevations: {res.get('results')}")
            return True
    except Exception as e:
        print(f"  [ERR] Open-Elevation API: {e}")
        return False

if __name__ == "__main__":
    print("=== TESTING ALL 7 REAL SOURCE DATASETS ===")
    test_openmeteo()
    test_nasa_coolr()
    test_geonames_india()
    test_osm_roads_facilities()
    test_gadm_boundaries()
    test_srtm_elevation()
