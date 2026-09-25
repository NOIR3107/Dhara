/**
 * DHARA — Live Hazard Intel layers (Phase 1)
 *
 * External, keyless hazard context layered onto the command map, adapted from
 * patterns in bilawalsidhu/gods-eye-view (MIT):
 *   - NASA GIBS: VIIRS observed flood extent, IMERG rainfall, true-colour imagery
 *   - RainViewer: live precipitation radar (personal/educational use only)
 *   - USGS: M2.5+ earthquakes (past 7 days) near the North-East
 *   - Open-Meteo: 48h rain forecast inside each habitation popup
 *   - DHARA API /hazards: GDACS cyclone wind buffers + tracks, flood alerts,
 *     FIRMS fires (ingested server-side by ingest/ingest_hazards.py)
 *   - DHARA API /news: GDELT regional headlines (unverified)
 *   - Road popups show hazard-driven probability adjustments and reasons
 *   - Habitation popups list the next radar / optical satellite overpasses
 *     (CelesTrak orbits via DHARA API, propagated in-browser with satellite.js)
 *   - Nearby-resources roster, offline search, shareable view links, credits
 *
 * Every external layer is tagged EXTERNAL so it is never mistaken for
 * DHARA's own REAL / DERIVED / SIMULATED model outputs.
 *
 * Depends on globals from app.js: API_BASE, mapLayers, habitationsData,
 * depotsData, vehiclesData, atRiskSegmentsData, showToast.
 */
(function () {
  "use strict";

  // Region of interest: NE India plus neighbouring Bhutan/Tibet/Myanmar/Bangladesh,
  // where quakes and storms that affect NE corridors originate.
  const NE_BOUNDS = { minLat: 20.5, maxLat: 30.5, minLon: 85.5, maxLon: 98.5 };
  const QUAKE_IMPACT_KM = 75;
  const ROSTER_RADIUS_KM = 60;
  const RAIN_CACHE_MS = 30 * 60 * 1000;

  const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
  const GIBS_ATTR = '<a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener">NASA GIBS</a>';

  const state = {
    map: null,
    layers: {},
    date: isoDaysAgo(1),
    quakes: [],
    rainCache: new Map(),
    radarTimer: null,
  };

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  function isoDaysAgo(n) {
    const d = new Date(Date.now() - n * 86400000);
    return d.toISOString().slice(0, 10);
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function toast(msg, type) {
    if (typeof showToast === "function") showToast(msg, type);
  }

  function depotLatLng(d) {
    const c = d && d.location && d.location.coordinates;
    return Array.isArray(c) ? [c[1], c[0]] : null;
  }

  function inRegion(lat, lon) {
    return lat >= NE_BOUNDS.minLat && lat <= NE_BOUNDS.maxLat &&
      lon >= NE_BOUNDS.minLon && lon <= NE_BOUNDS.maxLon;
  }

  // ------------------------------------------------------------------
  // Tile layers (NASA GIBS + RainViewer)
  // ------------------------------------------------------------------
  function gibsLayer(layerId, matrix, ext, maxNative, opts) {
    const layer = L.tileLayer(
      `${GIBS}/${layerId}/default/{time}/${matrix}/{z}/{y}/{x}.${ext}`,
      Object.assign({
        time: state.date,
        maxNativeZoom: maxNative,
        maxZoom: 18,
        opacity: 0.75,
        attribution: GIBS_ATTR,
        crossOrigin: true,
      }, opts || {})
    );
    layer._dharaGibs = true;
    return layer;
  }

  function buildTileLayers() {
    state.layers.flood = gibsLayer("VIIRS_Combined_Flood_2-Day", "GoogleMapsCompatible_Level9", "png", 9, { opacity: 0.85 });
    // IMERG daily is published with ~1–2 day latency; clamp the date so it never goes blank.
    state.layers.imerg = gibsLayer("IMERG_Precipitation_Rate", "GoogleMapsCompatible_Level6", "png", 6, { imergLag: 2 });
    state.layers.truecolor = gibsLayer("VIIRS_SNPP_CorrectedReflectance_TrueColor", "GoogleMapsCompatible_Level9", "jpg", 9, { opacity: 1 });
    state.layers.radar = L.layerGroup();
  }

  function setSatelliteDate(iso) {
    state.date = iso;
    ["flood", "imerg", "truecolor"].forEach((k) => {
      const layer = state.layers[k];
      let t = iso;
      if (layer.options.imergLag) {
        const floor = isoDaysAgo(layer.options.imergLag);
        if (t > floor) t = floor;
      }
      layer.options.time = t;
      if (state.map.hasLayer(layer)) layer.redraw();
    });
    writeShareState();
  }

  async function refreshRadar() {
    const group = state.layers.radar;
    try {
      const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
      const data = await res.json();
      const frames = (data.radar && data.radar.past) || [];
      if (!frames.length) throw new Error("no radar frames");
      const latest = frames[frames.length - 1];
      group.clearLayers();
      group.addLayer(L.tileLayer(`${data.host}${latest.path}/256/{z}/{x}/{y}/2/1_1.png`, {
        maxNativeZoom: 7, // RainViewer's free tiles stop at z7
        maxZoom: 18,
        opacity: 0.7,
        attribution: '<a href="https://www.rainviewer.com/api.html" target="_blank" rel="noopener">RainViewer</a> (non-commercial)',
      }));
      const stamp = new Date(latest.time * 1000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      setStatus("radar", `frame ${stamp} IST`);
    } catch (err) {
      console.warn("RainViewer radar fetch failed:", err);
      setStatus("radar", "unavailable");
    }
  }

  // ------------------------------------------------------------------
  // USGS earthquakes
  // ------------------------------------------------------------------
  function nearbyImpact(lat, lon, radiusKm) {
    let habs = 0, segs = 0;
    (habitationsData || []).forEach((f) => {
      const c = f.geometry.coordinates;
      if (haversineKm(lat, lon, c[1], c[0]) <= radiusKm) habs++;
    });
    (atRiskSegmentsData || []).forEach((f) => {
      const g = f.geometry;
      if (!g) return;
      const lines = g.type === "MultiLineString" ? g.coordinates : [g.coordinates];
      const hit = lines.some((line) => line.some((c) => haversineKm(lat, lon, c[1], c[0]) <= radiusKm));
      if (hit) segs++;
    });
    return { habs, segs };
  }

  async function loadQuakes() {
    const group = state.layers.quakes;
    try {
      const res = await fetch("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson");
      const data = await res.json();
      state.quakes = (data.features || []).filter((f) => {
        const [lon, lat] = f.geometry.coordinates;
        return inRegion(lat, lon);
      });
      group.clearLayers();

      const dayAgo = Date.now() - 86400000;
      const alerts = [];

      state.quakes.forEach((f) => {
        const [lon, lat, depth] = f.geometry.coordinates;
        const p = f.properties;
        const mag = p.mag || 0;
        const impact = nearbyImpact(lat, lon, QUAKE_IMPACT_KM);
        const recent = p.time >= dayAgo;
        const color = mag >= 5 ? "#B91C1C" : mag >= 4 ? "#EA580C" : "#CA8A04";

        const marker = L.circleMarker([lat, lon], {
          radius: 4 + mag * 2,
          color: color,
          weight: recent ? 3 : 1.5,
          fillColor: color,
          fillOpacity: recent ? 0.45 : 0.2,
          dashArray: recent ? null : "3 3",
        });
        marker.bindPopup(
          `<strong>🌐 M${mag.toFixed(1)} earthquake</strong><br>` +
          `${escapeHtml(p.place)}<br>` +
          `${new Date(p.time).toLocaleString("en-IN")}<br>` +
          `Depth: ${depth != null ? depth.toFixed(0) : "?"} km<br>` +
          `Within ${QUAKE_IMPACT_KM} km: <b>${impact.habs}</b> habitations, <b>${impact.segs}</b> at-risk segments<br>` +
          (mag >= 4 && impact.segs > 0
            ? `<span class="intel-flag">⚠ Recommend post-quake slope inspection</span><br>` : "") +
          `<span class="intel-prov">EXTERNAL · USGS</span> <a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">details</a>`
        );
        group.addLayer(marker);

        if (recent && mag >= 4 && (impact.habs > 0 || impact.segs > 0)) {
          alerts.push(`M${mag.toFixed(1)} ${p.place}: ${impact.segs} at-risk segments within ${QUAKE_IMPACT_KM} km`);
        }
      });

      setStatus("quakes", `${state.quakes.length} in region, 7 days`);
      alerts.slice(0, 2).forEach((a) => toast(`🌐 Seismic: ${a}`, "warning"));
    } catch (err) {
      console.warn("USGS quake fetch failed:", err);
      setStatus("quakes", "unavailable");
    }
  }

  // ------------------------------------------------------------------
  // Server-ingested hazards: GDACS cyclones / flood alerts, FIRMS fires
  // ------------------------------------------------------------------
  const CONE_STYLE = {
    cone_green: { color: "#16A34A", fillOpacity: 0.08 },
    cone_orange: { color: "#EA580C", fillOpacity: 0.12 },
    cone_red: { color: "#DC2626", fillOpacity: 0.16 },
  };

  function fmtTime(t) {
    return t ? new Date(t).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "?";
  }

  function hazardPopup(p) {
    const link = p.report || p.url;
    return `<strong>${escapeHtml(p.title)}</strong><br>` +
      (p.severitytext ? `${escapeHtml(p.severitytext)}<br>` : "") +
      (p.alertlevel || p.severity ? `Alert: ${escapeHtml(p.alertlevel || p.severity)}<br>` : "") +
      `From ${fmtTime(p.event_time)}${p.valid_until ? " to " + fmtTime(p.valid_until) : ""}<br>` +
      `<span class="intel-prov">EXTERNAL · ${escapeHtml(p.source)}</span>` +
      (link ? ` <a href="${escapeHtml(link)}" target="_blank" rel="noopener">report</a>` : "");
  }

  async function loadServerHazards() {
    const gdacs = state.layers.gdacs;
    const fires = state.layers.fires;
    try {
      const res = await fetch(`${API_BASE}/hazards?days=14`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      gdacs.clearLayers();
      fires.clearLayers();
      let cyclones = 0, floods = 0, fireCount = 0;

      // Draw cones largest-first so the red core stays on top and clickable.
      const order = { cone_green: 0, cone_orange: 1, cone_red: 2 };
      const feats = (data.features || []).slice().sort((a, b) =>
        (order[a.properties.part] ?? 3) - (order[b.properties.part] ?? 3));

      feats.forEach((f) => {
        const p = f.properties;
        if (p.event_type === "cyclone") {
          if (p.part === "centre") cyclones++;
          const style = CONE_STYLE[p.part];
          const layer = L.geoJSON(f, {
            style: style
              ? { color: style.color, weight: 1, fillColor: style.color, fillOpacity: style.fillOpacity }
              : { color: "#7C3AED", weight: 2, dashArray: p.part === "track_forecast" ? "6 5" : null },
            pointToLayer: (_, ll) => L.circleMarker(ll, { radius: 8, color: "#7C3AED", weight: 3, fillColor: "#FFFFFF", fillOpacity: 1 }),
          });
          layer.bindPopup(hazardPopup(p));
          gdacs.addLayer(layer);
        } else if (p.event_type === "flood_alert") {
          floods++;
          const [lon, lat] = f.geometry.coordinates;
          gdacs.addLayer(L.circleMarker([lat, lon], { radius: 9, color: "#0284C7", weight: 2, fillColor: "#0284C7", fillOpacity: 0.25 })
            .bindPopup(hazardPopup(p)));
        } else if (p.event_type === "fire") {
          fireCount++;
          const [lon, lat] = f.geometry.coordinates;
          fires.addLayer(L.circleMarker([lat, lon], { radius: 3, color: "#DC2626", weight: 1, fillColor: "#F97316", fillOpacity: 0.9 })
            .bindPopup(hazardPopup(Object.assign({}, p, { title: `Active fire · ${p.frp_mw || "?"} MW` }))));
        }
      });
      setStatus("gdacs", `${cyclones} cyclone(s), ${floods} flood alert(s)`);
      setStatus("fires", fireCount ? `${fireCount} detections, 2 days` : "none, or FIRMS key not set on server");
    } catch (err) {
      console.warn("Hazard API fetch failed:", err);
      setStatus("gdacs", "API unavailable");
      setStatus("fires", "API unavailable");
    }
  }

  // ------------------------------------------------------------------
  // Road popup enrichment: hazard-driven probability adjustments
  // ------------------------------------------------------------------
  function enrichRoadPopup(popup, feature) {
    const p = feature.properties || {};
    if (!p.hazard_reasons || !p.hazard_reasons.length || p.base_probability == null) return;
    if (feature._dharaBaseContent === undefined) feature._dharaBaseContent = popup.getContent();
    popup.setContent(
      `<div class="intel-popup">${feature._dharaBaseContent}` +
      `<div class="intel-section"><div class="intel-h">⚠ Live hazard adjustment <span class="intel-prov">DERIVED</span></div>` +
      `<div>Model ${(p.base_probability * 100).toFixed(0)}% → <b>${(p.closure_probability * 100).toFixed(0)}%</b> (odds ×${p.hazard_multiplier.toFixed(2)})</div>` +
      `<ul class="intel-reasons">${p.hazard_reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul></div></div>`
    );
  }

  // ------------------------------------------------------------------
  // Regional headlines (GDELT via DHARA API) — unverified context
  // ------------------------------------------------------------------
  function fmtGdeltDate(s) {
    const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/.exec(s || "");
    return m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]} UTC` : "";
  }

  async function loadNews(listEl) {
    listEl.innerHTML = `<li class="intel-muted">Loading…</li>`;
    try {
      const res = await fetch(`${API_BASE}/news`);
      const data = await res.json();
      const items = data.articles || [];
      if (!items.length) {
        listEl.innerHTML = `<li class="intel-muted">${escapeHtml(data.error || "No matching headlines in the last 3 days.")}</li>`;
        return false;
      }
      listEl.innerHTML = items.slice(0, 8).map((a) =>
        `<li><a href="${escapeHtml(a.url)}" target="_blank" rel="noopener">${escapeHtml(a.title)}</a>` +
        `<div class="intel-muted">${escapeHtml(a.domain)} · ${fmtGdeltDate(a.seen_at)}</div></li>`
      ).join("");
      return true;
    } catch (err) {
      listEl.innerHTML = `<li class="intel-muted">News unavailable (API offline?)</li>`;
      return false;
    }
  }

  // ------------------------------------------------------------------
  // Satellite overpasses: when could fresh imagery of this place arrive?
  // ------------------------------------------------------------------
  const SAT_HORIZON_H = 72;
  const SAT_STEP_S = 30;
  const SAT_CACHE_MS = 30 * 60 * 1000;
  const satState = { lib: null, sats: null, cache: new Map() };

  function loadSatelliteLib() {
    if (window.satellite) return Promise.resolve(window.satellite);
    if (satState.lib) return satState.lib;
    satState.lib = new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = "https://cdn.jsdelivr.net/npm/satellite.js@5.0.0/dist/satellite.min.js";
      el.onload = () => resolve(window.satellite);
      el.onerror = () => { satState.lib = null; reject(new Error("orbit library failed to load")); };
      document.head.appendChild(el);
    });
    return satState.lib;
  }

  async function loadSatellites() {
    if (satState.sats) return satState.sats;
    const [lib, res] = await Promise.all([loadSatelliteLib(), fetch(`${API_BASE}/satellites/tle`)]);
    const data = await res.json();
    if (!data.satellites || !data.satellites.length) throw new Error(data.error || "no orbit data");
    satState.sats = data.satellites.map((s) => Object.assign({}, s, { satrec: lib.twoline2satrec(s.tle1, s.tle2) }));
    return satState.sats;
  }

  // Solar elevation (degrees) — NOAA low-precision formulas, ample for a
  // daylight check on optical imagery.
  function sunElevationDeg(date, lat, lon) {
    const rad = Math.PI / 180;
    const jd = date.getTime() / 86400000 + 2440587.5;
    const n = jd - 2451545.0;
    const L = (280.46 + 0.9856474 * n) % 360;
    const g = ((357.528 + 0.9856003 * n) % 360) * rad;
    const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
    const eps = (23.439 - 0.0000004 * n) * rad;
    const decl = Math.asin(Math.sin(eps) * Math.sin(lambda));
    const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
    const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
    const hourAngle = (gmst * 15 + lon) * rad - ra;
    const el = Math.asin(Math.sin(lat * rad) * Math.sin(decl) + Math.cos(lat * rad) * Math.cos(decl) * Math.cos(hourAngle));
    return el / rad;
  }

  function groundDistanceKm(sat, lib, date, lat, lon) {
    const pv = lib.propagate(sat.satrec, date);
    if (!pv.position) return Infinity;
    const geo = lib.eciToGeodetic(pv.position, lib.gstime(date));
    return haversineKm(lat, lon, lib.degreesLat(geo.latitude), lib.degreesLong(geo.longitude));
  }

  // Closest approach of each pass ≈ the target's cross-track distance, which
  // decides whether it lies inside the sensor's imaging strip.
  async function predictOverpasses(lat, lon) {
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    const hit = satState.cache.get(key);
    if (hit && Date.now() - hit.at < SAT_CACHE_MS) return hit.passes;

    const lib = await loadSatelliteLib();
    const sats = await loadSatellites();
    const start = Date.now();
    const steps = (SAT_HORIZON_H * 3600) / SAT_STEP_S;
    const passes = [];

    sats.forEach((sat) => {
      const reach = sat.far_km + 400; // coarse gate before refining
      let prev2 = Infinity, prev1 = Infinity;
      for (let i = 0; i <= steps; i++) {
        const d = groundDistanceKm(sat, lib, new Date(start + i * SAT_STEP_S * 1000), lat, lon);
        if (prev1 < reach && prev1 <= prev2 && prev1 <= d) {
          // Refine the minimum around step i-1 with a ternary search.
          let lo = start + (i - 2) * SAT_STEP_S * 1000, hi = start + i * SAT_STEP_S * 1000;
          for (let k = 0; k < 30; k++) {
            const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
            if (groundDistanceKm(sat, lib, new Date(m1), lat, lon) < groundDistanceKm(sat, lib, new Date(m2), lat, lon)) hi = m2; else lo = m1;
          }
          const t = new Date((lo + hi) / 2);
          const cross = groundDistanceKm(sat, lib, t, lat, lon);
          const inStrip = cross >= sat.near_km && cross <= sat.far_km;
          const daylight = sat.sensor === "radar" || sunElevationDeg(t, lat, lon) >= 10;
          if (inStrip && daylight) passes.push({ name: sat.name, sensor: sat.sensor, instrument: sat.instrument, time: t, crossKm: cross });
        }
        prev2 = prev1;
        prev1 = d;
      }
    });

    passes.sort((a, b) => a.time - b.time);
    satState.cache.set(key, { at: Date.now(), passes });
    return passes;
  }

  function fmtIn(t) {
    const h = (t - Date.now()) / 3600000;
    return h < 1 ? `in ${Math.max(1, Math.round(h * 60))} min` : `in ${Math.round(h)} h`;
  }

  function overpassHtml(passes) {
    const row = (p) =>
      `<li><b>${escapeHtml(p.name)}</b> · ${p.time.toLocaleString("en-IN", { weekday: "short", hour: "2-digit", minute: "2-digit" })} (${fmtIn(p.time)})` +
      `<div class="intel-muted">${escapeHtml(p.instrument)} · ${p.crossKm.toFixed(0)} km off-track</div></li>`;
    const radar = passes.filter((p) => p.sensor === "radar").slice(0, 2);
    const optical = passes.filter((p) => p.sensor === "optical").slice(0, 2);
    return `<div class="intel-sat-kind">Radar <span class="intel-muted">sees through cloud</span></div>` +
      (radar.length ? `<ul class="intel-roster">${radar.map(row).join("")}</ul>` : `<div class="intel-muted">None in ${SAT_HORIZON_H} h</div>`) +
      `<div class="intel-sat-kind">Optical <span class="intel-muted">daylight + clear sky</span></div>` +
      (optical.length ? `<ul class="intel-roster">${optical.map(row).join("")}</ul>` : `<div class="intel-muted">None in ${SAT_HORIZON_H} h</div>`) +
      `<div class="intel-muted">An overflight is not a guaranteed image — each mission follows its own acquisition plan.</div>`;
  }

  // ------------------------------------------------------------------
  // Habitation popup enrichment: Open-Meteo rain + nearby resources roster
  // ------------------------------------------------------------------
  async function fetchRain(lat, lon) {
    const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    const cached = state.rainCache.get(key);
    if (cached && Date.now() - cached.at < RAIN_CACHE_MS) return cached.data;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&hourly=precipitation,precipitation_probability&forecast_hours=48&timezone=Asia%2FKolkata`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const json = await res.json();
    const precip = json.hourly.precipitation || [];
    const prob = json.hourly.precipitation_probability || [];
    const sum = (a, from, to) => a.slice(from, to).reduce((s, v) => s + (v || 0), 0);
    const data = {
      next24: sum(precip, 0, 24),
      next48: sum(precip, 0, 48),
      peakHour: precip.reduce((best, v, i) => (v > precip[best] ? i : best), 0),
      peakMm: Math.max(0, ...precip),
      maxProb: Math.max(0, ...prob.filter((v) => v != null)),
      hourly: precip,
      times: json.hourly.time,
    };
    state.rainCache.set(key, { at: Date.now(), data });
    return data;
  }

  function rainSparkline(values) {
    const w = 180, h = 28, max = Math.max(1, ...values);
    const step = w / Math.max(1, values.length);
    const bars = values.map((v, i) => {
      const bh = (v / max) * h;
      return `<rect x="${(i * step).toFixed(1)}" y="${(h - bh).toFixed(1)}" width="${Math.max(1, step - 1).toFixed(1)}" height="${bh.toFixed(1)}" fill="#0284C7"/>`;
    }).join("");
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="48 hour rainfall forecast">${bars}</svg>`;
  }

  function rainSeverity(mm24) {
    // IMD 24h categories: heavy 64.5–115.5, very heavy 115.6–204.4, extremely heavy ≥204.5
    if (mm24 >= 204.5) return { label: "EXTREMELY HEAVY", cls: "sev-red" };
    if (mm24 >= 115.6) return { label: "VERY HEAVY", cls: "sev-red" };
    if (mm24 >= 64.5) return { label: "HEAVY", cls: "sev-amber" };
    if (mm24 >= 15.6) return { label: "MODERATE", cls: "sev-amber" };
    return { label: "LIGHT / NONE", cls: "sev-green" };
  }

  function buildRoster(lat, lon) {
    const items = [];
    (depotsData || []).forEach((d) => {
      const ll = depotLatLng(d);
      if (!ll) return;
      const km = haversineKm(lat, lon, ll[0], ll[1]);
      items.push({ kind: "depot", icon: "🏢", label: d.name, km, ll,
        meta: d.stock ? `${d.stock.rice_tonnes}t rice · ${d.vehicles_available ?? "?"} vehicles` : "" });
    });
    (vehiclesData || []).forEach((v) => {
      if (!Array.isArray(v.coordinates)) return;
      const ll = [v.coordinates[1], v.coordinates[0]];
      const km = haversineKm(lat, lon, ll[0], ll[1]);
      items.push({ kind: "vehicle", icon: "🚚", label: v.vehicle_id, km, ll, meta: v.status || "" });
    });
    items.sort((a, b) => a.km - b.km);
    const near = items.filter((i) => i.km <= ROSTER_RADIUS_KM).slice(0, 6);
    // Always surface the nearest depot even if it is outside the radius.
    if (!near.some((i) => i.kind === "depot")) {
      const nearestDepot = items.find((i) => i.kind === "depot");
      if (nearestDepot) near.push(nearestDepot);
    }
    return near;
  }

  function rosterHtml(items) {
    if (!items.length) return `<div class="intel-muted">No depots or vehicles loaded.</div>`;
    return `<ul class="intel-roster">` + items.map((i) =>
      `<li><button type="button" class="intel-jump" data-lat="${i.ll[0]}" data-lon="${i.ll[1]}">` +
      `${i.icon} ${escapeHtml(i.label)}</button> <span class="intel-km">${i.km.toFixed(1)} km</span>` +
      (i.meta ? `<div class="intel-muted">${escapeHtml(i.meta)}</div>` : "") + `</li>`
    ).join("") + `</ul><div class="intel-muted">Straight-line distance — road time may be far longer.</div>`;
  }

  function enrichHabitationPopup(popup, source) {
    const ll = source.getLatLng();
    if (source._dharaBaseContent === undefined) source._dharaBaseContent = popup.getContent();
    const base = source._dharaBaseContent;
    const roster = rosterHtml(buildRoster(ll.lat, ll.lng));

    let rainPart = `<div class="intel-muted">Loading forecast…</div>`;
    let satPart = `<div class="intel-muted">Computing overpasses…</div>`;
    const render = (rainHtml, satHtml) => {
      if (rainHtml !== undefined) rainPart = rainHtml;
      if (satHtml !== undefined) satPart = satHtml;
      if (!popup.isOpen()) return;
      popup.setContent(
        `<div class="intel-popup">${base}` +
        `<div class="intel-section"><div class="intel-h">🌧 48h rain forecast <span class="intel-prov">EXTERNAL · Open-Meteo</span></div>${rainPart}</div>` +
        `<div class="intel-section"><div class="intel-h">📡 Nearest resources</div>${roster}</div>` +
        `<div class="intel-section"><div class="intel-h">🛰 Next satellite overpasses <span class="intel-prov">DERIVED · CelesTrak orbits</span></div>${satPart}</div></div>`
      );
    };

    render();
    predictOverpasses(ll.lat, ll.lng)
      .then((passes) => render(undefined, overpassHtml(passes)))
      .catch((err) => {
        console.warn("Overpass prediction failed:", err);
        render(undefined, `<div class="intel-muted">Overpasses unavailable (${escapeHtml(err.message)})</div>`);
      });
    fetchRain(ll.lat, ll.lng).then((r) => {
      const sev = rainSeverity(r.next24);
      const peakTime = r.times[r.peakHour] ? r.times[r.peakHour].slice(11, 16) : "";
      render(
        `<div><span class="intel-sev ${sev.cls}">${sev.label}</span> ` +
        `<b>${r.next24.toFixed(1)} mm</b> next 24h · ${r.next48.toFixed(1)} mm 48h</div>` +
        rainSparkline(r.hourly) +
        `<div class="intel-muted">Peak ${r.peakMm.toFixed(1)} mm/h${peakTime ? " at " + peakTime : ""} · max chance ${r.maxProb}%</div>`
      );
    }).catch((err) => {
      console.warn("Open-Meteo fetch failed:", err);
      render(`<div class="intel-muted">Forecast unavailable (offline?)</div>`);
    });
  }

  function onPopupOpen(e) {
    const source = e.popup._source;
    if (!source) return;
    // Collapse the panel so it never hides the popup on a small map
    // (a wide map has room for both).
    const panel = document.querySelector(".intel-panel");
    if (panel && state.map && state.map.getSize().x < 700) panel.classList.add("collapsed");
    if (source.getLatLng && mapLayers.habitations && mapLayers.habitations.hasLayer(source)) {
      enrichHabitationPopup(e.popup, source);
    } else if (source.feature && source.feature.properties && "closure_probability" in source.feature.properties) {
      enrichRoadPopup(e.popup, source.feature);
    }
  }

  // ------------------------------------------------------------------
  // Offline search over already-loaded habitations, depots, vehicles
  // ------------------------------------------------------------------
  function searchIndex(q) {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const out = [];
    (habitationsData || []).forEach((f) => {
      const p = f.properties;
      if (p.name && p.name.toLowerCase().includes(needle)) {
        const c = f.geometry.coordinates;
        out.push({ icon: "🏘️", label: p.name, sub: `VRI ${p.vri.toFixed(0)}`, ll: [c[1], c[0]], layer: "habitations", starts: p.name.toLowerCase().startsWith(needle) });
      }
    });
    (depotsData || []).forEach((d) => {
      const ll = depotLatLng(d);
      if (ll && d.name && d.name.toLowerCase().includes(needle)) {
        out.push({ icon: "🏢", label: d.name, sub: "Depot", ll, layer: "dispatches", starts: d.name.toLowerCase().startsWith(needle) });
      }
    });
    (vehiclesData || []).forEach((v) => {
      if (v.vehicle_id && v.vehicle_id.toLowerCase().includes(needle) && Array.isArray(v.coordinates)) {
        out.push({ icon: "🚚", label: v.vehicle_id, sub: v.status || "Vehicle", ll: [v.coordinates[1], v.coordinates[0]], layer: "vehicles", starts: true });
      }
    });
    out.sort((a, b) => (b.starts - a.starts) || a.label.localeCompare(b.label));
    return out.slice(0, 8);
  }

  function focusResult(r) {
    const m = state.map;
    if (!m) return;
    m.flyTo(r.ll, Math.max(m.getZoom(), 11), { duration: 0.8 });
    m.once("moveend", () => {
      const group = mapLayers[r.layer];
      if (!group) return;
      group.eachLayer((layer) => {
        if (!layer.getLatLng) return;
        const p = layer.getLatLng();
        if (Math.abs(p.lat - r.ll[0]) < 1e-6 && Math.abs(p.lng - r.ll[1]) < 1e-6) layer.openPopup();
      });
    });
  }

  // ------------------------------------------------------------------
  // Shareable view state (query string, so the hash router is untouched)
  // ------------------------------------------------------------------
  const SHARE_KEYS = ["flood", "imerg", "truecolor", "radar", "quakes", "gdacs", "fires"];

  function writeShareState() {
    if (!state.map) return;
    const c = state.map.getCenter();
    const params = new URLSearchParams(window.location.search);
    params.set("map", `${c.lat.toFixed(4)},${c.lng.toFixed(4)},${state.map.getZoom()}`);
    const on = SHARE_KEYS.filter((k) => state.map.hasLayer(state.layers[k]));
    if (on.length) params.set("intel", on.join(",")); else params.delete("intel");
    params.set("sat", state.date);
    const url = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", url);
  }

  function readShareState() {
    const params = new URLSearchParams(window.location.search);
    const sat = params.get("sat");
    if (sat && /^\d{4}-\d{2}-\d{2}$/.test(sat)) state.date = sat;
    const view = (params.get("map") || "").split(",").map(Number);
    const intel = (params.get("intel") || "").split(",").filter((k) => SHARE_KEYS.includes(k));
    return { view: view.length === 3 && view.every(Number.isFinite) ? view : null, intel };
  }

  async function copyShareLink() {
    writeShareState();
    const link = window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      toast("🔗 Map view link copied — opens with the same area, layers and date.", "success");
    } catch (_) {
      window.prompt("Copy this map view link:", link);
    }
  }

  // ------------------------------------------------------------------
  // Control panel
  // ------------------------------------------------------------------
  const LAYER_DEFS = [
    { key: "flood", label: "Observed flood (VIIRS 2-day)", tag: "NASA" },
    { key: "imerg", label: "Satellite rainfall (IMERG daily)", tag: "NASA" },
    { key: "radar", label: "Live rain radar", tag: "RainViewer" },
    { key: "quakes", label: "Earthquakes M2.5+ (7 days)", tag: "USGS" },
    { key: "gdacs", label: "Cyclone wind buffers & flood alerts", tag: "GDACS" },
    { key: "fires", label: "Active fires (2 days)", tag: "NASA FIRMS" },
    { key: "truecolor", label: "True-colour satellite (clouds)", tag: "NASA" },
  ];

  function setStatus(key, text) {
    const el = document.querySelector(`.intel-status[data-status="${key}"]`);
    if (el) el.textContent = text;
  }

  function toggleLayer(key, on) {
    const layer = state.layers[key];
    if (!layer) return;
    if (on) {
      layer.addTo(state.map);
      if (key === "radar") {
        refreshRadar();
        clearInterval(state.radarTimer);
        state.radarTimer = setInterval(refreshRadar, 10 * 60 * 1000);
      }
      if (key === "quakes" && !state.quakes.length) loadQuakes();
      if ((key === "gdacs" || key === "fires") && !state.hazardsLoaded) {
        state.hazardsLoaded = true;
        loadServerHazards();
      }
    } else {
      state.map.removeLayer(layer);
      if (key === "radar") clearInterval(state.radarTimer);
    }
    const cb = document.querySelector(`.intel-panel input[data-layer="${key}"]`);
    if (cb) cb.checked = on;
    writeShareState();
  }

  function buildPanel() {
    const Panel = L.Control.extend({
      options: { position: "topleft" },
      onAdd: function () {
        const el = L.DomUtil.create("div", "intel-panel collapsed");
        el.innerHTML = `
          <button type="button" class="intel-toggle" aria-expanded="false" title="Live hazard intel">🛰 Hazard Intel</button>
          <div class="intel-body">
            <div class="intel-search">
              <input type="search" placeholder="Find village, depot, truck…" aria-label="Search map" autocomplete="off">
              <ul class="intel-results" role="listbox"></ul>
            </div>
            <div class="intel-h">LIVE HAZARD LAYERS <span class="intel-prov">EXTERNAL</span></div>
            ${LAYER_DEFS.map((d) => `
              <label class="intel-row">
                <input type="checkbox" data-layer="${d.key}">
                <span>${d.label}<br><small><span class="intel-tag">${d.tag}</span> <span class="intel-status" data-status="${d.key}"></span></small></span>
              </label>`).join("")}
            <label class="intel-row intel-date">
              <span>Satellite date</span>
              <input type="date" value="${state.date}" max="${isoDaysAgo(0)}" min="2015-11-24">
            </label>
            <div class="intel-muted">Pick a date before and after an event to compare flood extent.</div>
            <details class="intel-news">
              <summary>📰 Regional headlines <span class="intel-prov">UNVERIFIED · GDELT</span></summary>
              <ul class="intel-news-list"></ul>
            </details>
            <button type="button" class="intel-share">🔗 Copy link to this view</button>
          </div>`;

        L.DomEvent.disableClickPropagation(el);
        L.DomEvent.disableScrollPropagation(el);

        const toggleBtn = el.querySelector(".intel-toggle");
        toggleBtn.addEventListener("click", () => {
          const collapsed = el.classList.toggle("collapsed");
          toggleBtn.setAttribute("aria-expanded", String(!collapsed));
          // One tool panel open at a time — the map is too small for more.
          if (!collapsed) {
            document.querySelectorAll(".intel-panel").forEach((other) => {
              if (other === el) return;
              other.classList.add("collapsed");
              const t = other.querySelector(".intel-toggle");
              if (t) t.setAttribute("aria-expanded", "false");
            });
          }
        });

        el.querySelectorAll("input[data-layer]").forEach((cb) => {
          cb.addEventListener("change", () => toggleLayer(cb.dataset.layer, cb.checked));
        });

        el.querySelector(".intel-date input").addEventListener("change", (ev) => {
          if (ev.target.value) setSatelliteDate(ev.target.value);
        });

        el.querySelector(".intel-share").addEventListener("click", copyShareLink);

        const news = el.querySelector(".intel-news");
        news.addEventListener("toggle", async () => {
          if (!news.open || news.dataset.loaded) return;
          news.dataset.loaded = "1";
          // Allow a retry on the next open if the feed was unavailable.
          if (!(await loadNews(news.querySelector(".intel-news-list")))) delete news.dataset.loaded;
        });

        const input = el.querySelector(".intel-search input");
        const list = el.querySelector(".intel-results");
        let results = [];
        input.addEventListener("input", () => {
          results = searchIndex(input.value);
          list.innerHTML = results.map((r, i) =>
            `<li><button type="button" data-i="${i}">${r.icon} ${escapeHtml(r.label)} <small>${escapeHtml(r.sub)}</small></button></li>`
          ).join("") || (input.value.trim().length >= 2 ? `<li class="intel-muted">No matches</li>` : "");
        });
        input.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" && results[0]) { focusResult(results[0]); list.innerHTML = ""; }
        });
        list.addEventListener("click", (ev) => {
          const btn = ev.target.closest("button[data-i]");
          if (!btn) return;
          focusResult(results[Number(btn.dataset.i)]);
          list.innerHTML = "";
          input.value = "";
        });

        return el;
      },
    });
    new Panel().addTo(state.map);
  }

  // Roster "jump" buttons live inside popups, so delegate from the map container.
  function bindRosterJumps() {
    state.map.getContainer().addEventListener("click", (ev) => {
      const btn = ev.target.closest(".intel-jump");
      if (!btn) return;
      state.map.flyTo([Number(btn.dataset.lat), Number(btn.dataset.lon)], Math.max(state.map.getZoom(), 11), { duration: 0.8 });
    });
  }

  // ------------------------------------------------------------------
  // 2D forecast-day chips (Day 1–7 under the map)
  // ------------------------------------------------------------------
  // app.js redraws the map from its global day-1 data every 30 s. Instead of
  // overwriting those globals (the rest of the dashboard uses them), swap the
  // selected day's data in only for the duration of each map redraw.
  const dayState = { day: 0, cache: {} };

  async function fetchDay(day) {
    const [habRes, segRes] = await Promise.all([
      fetch(`${API_BASE}/habitations?day=${day}`),
      fetch(`${API_BASE}/segments/at-risk?day=${day}`),
    ]);
    if (!habRes.ok || !segRes.ok) throw new Error("forecast API unavailable");
    const data = { habs: (await habRes.json()).features || [], segs: (await segRes.json()).features || [] };
    dayState.cache[day] = data;
    return data;
  }

  function wrapMapRedraw() {
    const original = window.updateMapLayers;
    if (typeof original !== "function" || original._dharaDayAware) return;
    const wrapped = function () {
      const data = dayState.day > 0 ? dayState.cache[dayState.day] : null;
      if (!data) return original();
      const savedHabs = habitationsData, savedSegs = atRiskSegmentsData;
      habitationsData = data.habs;
      atRiskSegmentsData = data.segs;
      try { original(); } finally {
        habitationsData = savedHabs;
        atRiskSegmentsData = savedSegs;
      }
      // Refresh the cached day quietly so a new pipeline run shows up next redraw.
      fetchDay(dayState.day).catch(() => {});
    };
    wrapped._dharaDayAware = true;
    window.updateMapLayers = wrapped;
  }

  function bindForecastChips() {
    const chips = document.querySelectorAll("#forecast-day-chips .forecast-day-chip");
    chips.forEach((chip) => chip.addEventListener("click", async () => {
      const day = Number(chip.dataset.day);
      chips.forEach((c) => c.classList.toggle("active", c === chip));
      dayState.day = day;
      if (day > 0 && !dayState.cache[day]) {
        chip.classList.add("loading");
        chip.setAttribute("aria-busy", "true");
        try {
          await fetchDay(day);
        } catch (err) {
          toast(`Could not load forecast day ${day + 1}: ${err.message}`, "warning");
          return;
        } finally {
          chip.classList.remove("loading");
          chip.removeAttribute("aria-busy");
        }
      }
      if (dayState.day !== day) return; // a newer click won
      window.updateMapLayers();
      const segs = day > 0 ? dayState.cache[day].segs : (atRiskSegmentsData || []);
      const date = segs[0] && segs[0].properties.forecast_for_date;
      if (date) {
        chip.title = new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
      }
    }));
  }

  // ------------------------------------------------------------------
  // Public entry point — called from initMap() in app.js
  // ------------------------------------------------------------------
  function attach(leafletMap) {
    if (!leafletMap || state.map) return;
    state.map = leafletMap;

    const shared = readShareState();
    buildTileLayers();
    state.layers.quakes = L.layerGroup();
    state.layers.gdacs = L.layerGroup();
    state.layers.fires = L.layerGroup();

    // Credits: required by the OSM/CARTO/NASA/RainViewer/USGS/Open-Meteo terms.
    // Tile layers add their own credit while visible; hover expands the line.
    L.control.attribution({ position: "bottomright", prefix: '<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>' })
      .addAttribution('<a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a> · <a href="https://earthquake.usgs.gov" target="_blank" rel="noopener">USGS</a>')
      .addTo(leafletMap);

    buildPanel();
    bindRosterJumps();
    wrapMapRedraw();
    bindForecastChips();
    leafletMap.on("popupopen", onPopupOpen);
    leafletMap.on("moveend", writeShareState);

    if (shared.view) leafletMap.setView([shared.view[0], shared.view[1]], shared.view[2]);
    const dateInput = document.querySelector(".intel-panel .intel-date input");
    if (dateInput) dateInput.value = state.date;
    setSatelliteDate(state.date);
    shared.intel.forEach((k) => toggleLayer(k, true));
    if (shared.intel.length) {
      const panel = document.querySelector(".intel-panel");
      if (panel) panel.classList.remove("collapsed");
    }
  }

  // Open or close the hazard intel panel (used by the Live Map toolbar).
  function togglePanel() {
    const toggle = document.querySelector(".intel-panel:not(.ops-panel) .intel-toggle");
    if (toggle) toggle.click();
  }

  // search/focus are shared with the dashboard's Ctrl+K quick search.
  window.DharaIntel = { attach, togglePanel, search: searchIndex, focus: focusResult };
})();
