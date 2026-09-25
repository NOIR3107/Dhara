/**
 * DHARA — 3D Terrain Command View (Phase 3)
 *
 * Officer-only 3D view of the North-East on real terrain, adapted from
 * bilawalsidhu/gods-eye-view (MIT). Cesium (~5 MB) is lazy-loaded only when
 * the view is opened, so field users on low bandwidth never download it.
 *
 * No API keys: CesiumJS from jsdelivr, Re:Earth / Mapterhorn keyless terrain
 * (CC BY 4.0), Esri World Imagery. Cesium ion is never used.
 *
 *   - Roads draped on terrain, coloured by forecast closure probability
 *   - Habitations coloured by VRI, depots, live hazards (quake landslide
 *     envelopes, GDACS cyclone wind buffers)
 *   - 7-day forecast replay: step or play through /segments/at-risk?day=N
 *     and /habitations?day=N
 *   - Fly along a selected road (or orbit a short one) to brief drivers
 *   - Vertical exaggeration toggle for reading ghat-road relief
 *
 * Depends on globals from app.js: API_BASE, showToast.
 */
(function () {
  "use strict";

  const CESIUM_VERSION = "1.145.0";
  const CESIUM_BASE = `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium/`;
  const TERRAIN_URL = "https://terrain.reearth.land/cesium-mesh/ellipsoid";
  const IMAGERY_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  const DAYS = 7;
  const PLAY_INTERVAL_MS = 2500;
  const CLOSURE_THRESHOLD = 0.35; // same cut as predicted_closed in run_real_pipeline.py
  const CHASE_RANGE_M = 1800;     // chase-camera distance from the road point during flights

  // Same envelope as model/hazard_adjustment.py (approximate, after Keefer 1984).
  const KEEFER_ENVELOPE = [[4.0, 0], [4.5, 10], [5.0, 25], [5.5, 50], [6.0, 90],
    [6.5, 150], [7.0, 220], [7.5, 300], [8.0, 400]];

  const state = {
    viewer: null,
    loading: null,
    overlay: null,
    day: 0,
    dates: [],
    cache: {},            // day -> { habs, segs }
    habEntities: new Map(),
    roadEntities: new Map(),
    playTimer: null,
    flight: null,
    exaggerated: false,
    lastFocus: null,
  };

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function toast(msg, type) {
    if (typeof showToast === "function") showToast(msg, type);
  }

  function landslideRadiusKm(mag) {
    const pts = KEEFER_ENVELOPE;
    if (mag <= pts[0][0]) return 0;
    if (mag >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
    for (let i = 0; i < pts.length - 1; i++) {
      const [m0, r0] = pts[i], [m1, r1] = pts[i + 1];
      if (mag >= m0 && mag <= m1) return r0 + (r1 - r0) * (mag - m0) / (m1 - m0);
    }
    return 0;
  }

  function vriColor(vri) {
    if (vri < 30) return Cesium.Color.fromCssColorString("#DC2626");
    if (vri < 70) return Cesium.Color.fromCssColorString("#D97706");
    return Cesium.Color.fromCssColorString("#10B981");
  }

  function roadColor(p) {
    if (p >= 0.5) return Cesium.Color.fromCssColorString("#DC2626");
    if (p >= 0.25) return Cesium.Color.fromCssColorString("#F59E0B");
    return Cesium.Color.fromCssColorString("#3B82F6");
  }

  function setStatus(text) {
    const el = state.overlay && state.overlay.querySelector(".t3d-status");
    if (el) el.textContent = text;
  }

  function requestRender() {
    if (state.viewer) state.viewer.scene.requestRender();
  }

  // ------------------------------------------------------------------
  // Lazy loading
  // ------------------------------------------------------------------
  function loadCesium() {
    if (window.Cesium) return Promise.resolve();
    if (state.loading) return state.loading;
    window.CESIUM_BASE_URL = CESIUM_BASE;
    state.loading = new Promise((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = CESIUM_BASE + "Widgets/widgets.css";
      document.head.appendChild(css);
      const script = document.createElement("script");
      script.src = CESIUM_BASE + "Cesium.js";
      script.onload = () => resolve();
      script.onerror = () => {
        state.loading = null;
        reject(new Error("Could not load the 3D engine (CesiumJS). Check the network connection."));
      };
      document.head.appendChild(script);
    });
    return state.loading;
  }

  async function loadDay(day) {
    if (state.cache[day]) return state.cache[day];
    const [habRes, segRes] = await Promise.all([
      fetch(`${API_BASE}/habitations?day=${day}`),
      fetch(`${API_BASE}/segments/at-risk?day=${day}`),
    ]);
    if (!habRes.ok || !segRes.ok) throw new Error("Forecast API unavailable");
    const data = { habs: (await habRes.json()).features || [], segs: (await segRes.json()).features || [] };
    state.cache[day] = data;
    const date = data.segs[0] && data.segs[0].properties.forecast_for_date;
    if (date) state.dates[day] = date;
    return data;
  }

  // ------------------------------------------------------------------
  // Overlay DOM
  // ------------------------------------------------------------------
  function buildOverlay() {
    const el = document.createElement("div");
    el.className = "t3d-overlay";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "3D terrain command view");
    el.innerHTML = `
      <div class="t3d-viewer"></div>
      <div class="t3d-panel">
        <div class="t3d-head">
          <div>
            <div class="t3d-title">3D TERRAIN COMMAND VIEW</div>
            <div class="t3d-sub">Forecast closures on real relief</div>
          </div>
          <button type="button" class="t3d-close" aria-label="Close 3D view">✕</button>
        </div>
        <div class="t3d-status" aria-live="polite">Loading 3D engine…</div>

        <div class="t3d-h">7-DAY FORECAST REPLAY</div>
        <div class="t3d-days">
          ${Array.from({ length: DAYS }, (_, i) => `<button type="button" class="t3d-day${i === 0 ? " active" : ""}" data-day="${i}">D${i + 1}</button>`).join("")}
          <button type="button" class="t3d-play" aria-label="Play forecast replay">▶</button>
        </div>
        <div class="t3d-date"></div>
        <div class="t3d-stats"></div>

        <div class="t3d-h">VIEW</div>
        <label class="t3d-row"><input type="checkbox" class="t3d-exag"> Exaggerate relief ×2</label>
        <label class="t3d-row"><input type="checkbox" class="t3d-haz" checked> Live hazards (quakes, cyclones)</label>
        <button type="button" class="t3d-btn t3d-home">↺ Reset camera</button>

        <div class="t3d-selected" hidden></div>

        <div class="t3d-legend">
          <span><i style="background:#DC2626"></i>≥50% closure / VRI&lt;30</span>
          <span><i style="background:#F59E0B"></i>25–50% / VRI 30–70</span>
          <span><i style="background:#3B82F6"></i>Road &lt;25%</span>
          <span><i style="background:#10B981"></i>VRI ≥70</span>
        </div>
      </div>`;
    document.body.appendChild(el);

    el.querySelector(".t3d-close").addEventListener("click", close);
    el.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    el.querySelectorAll(".t3d-day").forEach((b) =>
      b.addEventListener("click", () => { stopPlay(); showDay(Number(b.dataset.day)); }));
    el.querySelector(".t3d-play").addEventListener("click", togglePlay);
    el.querySelector(".t3d-exag").addEventListener("change", (e) => {
      state.exaggerated = e.target.checked;
      if (state.viewer) state.viewer.scene.verticalExaggeration = state.exaggerated ? 2.0 : 1.0;
      requestRender();
    });
    el.querySelector(".t3d-haz").addEventListener("change", (e) => {
      const ds = state.viewer && state.viewer.dataSources.getByName("hazards")[0];
      if (ds) ds.show = e.target.checked;
      requestRender();
    });
    el.querySelector(".t3d-home").addEventListener("click", resetCamera);
    return el;
  }

  // ------------------------------------------------------------------
  // Viewer
  // ------------------------------------------------------------------
  function createViewer(container) {
    const terrain = new Cesium.Terrain(Cesium.CesiumTerrainProvider.fromUrl(TERRAIN_URL));
    terrain.errorEvent.addEventListener(() => {
      setStatus("Terrain service unavailable — showing flat globe.");
    });
    const viewer = new Cesium.Viewer(container, {
      baseLayer: new Cesium.ImageryLayer(new Cesium.UrlTemplateImageryProvider({
        url: IMAGERY_URL,
        maximumLevel: 18,
        credit: new Cesium.Credit("Imagery © Esri, Maxar, Earthstar Geographics"),
      })),
      terrain,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: true,
      // Only redraw when something changes — keeps laptops cool in a command room.
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity,
    });
    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.scene.globe.enableLighting = false;
    viewer.selectedEntityChanged.addEventListener(onSelect);
    return viewer;
  }

  function resetCamera() {
    stopFlight();
    state.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(93.2, 25.0, 230000),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-38), roll: 0 },
      duration: 1.5,
    });
  }

  // ------------------------------------------------------------------
  // Entities
  // ------------------------------------------------------------------
  function lineCoords(geometry) {
    if (!geometry) return [];
    if (geometry.type === "LineString") return [geometry.coordinates];
    if (geometry.type === "MultiLineString") return geometry.coordinates;
    return [];
  }

  function drawBase(data) {
    const v = state.viewer;
    const entities = v.entities;
    entities.suspendEvents();

    data.segs.forEach((f) => {
      const p = f.properties;
      lineCoords(f.geometry).forEach((line, i) => {
        if (line.length < 2) return;
        const e = entities.add({
          id: `road:${p.segment_id}:${i}`,
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray(line.flat()),
            clampToGround: true,
            width: 5,
            material: roadColor(p.closure_probability),
          },
        });
        e.dhara = { kind: "road", segment_id: p.segment_id, line };
        if (!state.roadEntities.has(p.segment_id)) state.roadEntities.set(p.segment_id, []);
        state.roadEntities.get(p.segment_id).push(e);
      });
    });

    data.habs.forEach((f) => {
      const p = f.properties;
      const [lon, lat] = f.geometry.coordinates;
      const e = entities.add({
        id: `hab:${p.id}`,
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        point: {
          pixelSize: 6,
          color: vriColor(p.vri),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          // Keep villages visible behind ridges; terrain would otherwise hide them.
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new Cesium.NearFarScalar(5e3, 1.6, 4e5, 0.8),
        },
      });
      e.dhara = { kind: "hab", id: p.id };
      state.habEntities.set(p.id, e);
    });

    entities.resumeEvents();
  }

  async function drawDepots() {
    try {
      const res = await fetch(`${API_BASE}/depots`);
      const depots = await res.json();
      depots.forEach((d) => {
        const c = d.location && d.location.coordinates;
        if (!Array.isArray(c)) return;
        const e = state.viewer.entities.add({
          id: `depot:${d.id}`,
          position: Cesium.Cartesian3.fromDegrees(c[0], c[1]),
          point: {
            pixelSize: 14, color: Cesium.Color.fromCssColorString("#16A34A"),
            outlineColor: Cesium.Color.WHITE, outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: d.name, font: "600 13px 'Plus Jakarta Sans', sans-serif",
            fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -20),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 600000),
          },
        });
        e.dhara = { kind: "depot", depot: d };
      });
      requestRender();
    } catch (err) {
      console.warn("3D depots failed:", err);
    }
  }

  async function drawHazards() {
    const ds = new Cesium.CustomDataSource("hazards");
    await state.viewer.dataSources.add(ds);
    try {
      const res = await fetch(`${API_BASE}/hazards?days=14`);
      const data = await res.json();
      const coneColor = { cone_green: "#16A34A", cone_orange: "#EA580C", cone_red: "#DC2626" };
      (data.features || []).forEach((f, i) => {
        const p = f.properties;
        if (p.event_type === "earthquake") {
          const [lon, lat] = f.geometry.coordinates;
          const radius = landslideRadiusKm(p.magnitude || 0);
          const e = ds.entities.add({
            id: `quake:${p.external_id}`,
            position: Cesium.Cartesian3.fromDegrees(lon, lat),
            point: { pixelSize: 10, color: Cesium.Color.fromCssColorString("#B91C1C"),
              outlineColor: Cesium.Color.WHITE, outlineWidth: 2,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY },
            ellipse: radius > 0 ? {
              semiMajorAxis: radius * 1000, semiMinorAxis: radius * 1000,
              material: Cesium.Color.fromCssColorString("#DC2626").withAlpha(0.18),
              outline: false,
            } : undefined,
          });
          e.dhara = { kind: "hazard", p, radius };
        } else if (p.event_type === "cyclone" && coneColor[p.part] && f.geometry.type === "Polygon") {
          const e = ds.entities.add({
            id: `cone:${p.external_id}:${i}`,
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray(f.geometry.coordinates[0].flat()),
              material: Cesium.Color.fromCssColorString(coneColor[p.part]).withAlpha(0.14),
            },
          });
          e.dhara = { kind: "hazard", p };
        }
      });
      requestRender();
    } catch (err) {
      console.warn("3D hazards failed:", err);
    }
  }

  // ------------------------------------------------------------------
  // Forecast replay
  // ------------------------------------------------------------------
  async function showDay(day) {
    state.day = day;
    state.overlay.querySelectorAll(".t3d-day").forEach((b) =>
      b.classList.toggle("active", Number(b.dataset.day) === day));
    if (!state.viewer) return; // still loading; open() draws the selected day
    let data;
    if (!state.cache[day]) setStatus(`Loading forecast day ${day + 1}…`);
    try {
      data = await loadDay(day);
    } catch (err) {
      setStatus(`Day ${day + 1}: ${err.message}`);
      return;
    }
    if (state.day !== day) return; // a newer click won
    if (/^Loading forecast day/.test(state.overlay.querySelector(".t3d-status").textContent)) {
      setStatus("Drag to pan · right-drag or Ctrl-drag to tilt · click a road or village.");
    }

    data.segs.forEach((f) => {
      const color = roadColor(f.properties.closure_probability);
      (state.roadEntities.get(f.properties.segment_id) || []).forEach((e) => {
        e.polyline.material = new Cesium.ColorMaterialProperty(color);
      });
    });
    data.habs.forEach((f) => {
      const e = state.habEntities.get(f.properties.id);
      if (e) e.point.color = vriColor(f.properties.vri);
    });

    const atRisk = data.segs.filter((f) => f.properties.closure_probability >= CLOSURE_THRESHOLD).length;
    const vris = data.habs.map((f) => f.properties.vri);
    const cutoff = vris.filter((v) => v < 30).length;
    const minVri = vris.length ? Math.min(...vris) : NaN;
    const date = state.dates[day];
    state.overlay.querySelector(".t3d-date").textContent = date
      ? new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })
      : "";
    state.overlay.querySelector(".t3d-stats").innerHTML =
      `<div><b>${atRisk}</b> of ${data.segs.length} roads ≥${CLOSURE_THRESHOLD * 100}% closure risk</div>` +
      `<div><b>${cutoff}</b> habitations VRI &lt; 30 · lowest VRI <b>${Number.isFinite(minVri) ? minVri.toFixed(1) : "–"}</b></div>` +
      `<div class="t3d-muted">DERIVED · DHARA closure model + live hazards</div>`;
    refreshSelected();
    requestRender();
  }

  function stopPlay() {
    clearInterval(state.playTimer);
    state.playTimer = null;
    const btn = state.overlay && state.overlay.querySelector(".t3d-play");
    if (btn) { btn.textContent = "▶"; btn.setAttribute("aria-label", "Play forecast replay"); }
  }

  function togglePlay() {
    if (state.playTimer) return stopPlay();
    const btn = state.overlay.querySelector(".t3d-play");
    btn.textContent = "❚❚";
    btn.setAttribute("aria-label", "Pause forecast replay");
    // Warm the cache so playback does not stall on the network.
    for (let d = 0; d < DAYS; d++) loadDay(d).catch(() => {});
    state.playTimer = setInterval(() => showDay((state.day + 1) % DAYS), PLAY_INTERVAL_MS);
  }

  // ------------------------------------------------------------------
  // Selection card + road flight
  // ------------------------------------------------------------------
  function currentProps(kind, id) {
    const data = state.cache[state.day];
    if (!data) return null;
    const list = kind === "road" ? data.segs : data.habs;
    const key = kind === "road" ? "segment_id" : "id";
    const f = list.find((x) => x.properties[key] === id);
    return f ? f.properties : null;
  }

  function onSelect(entity) {
    state.selected = entity && entity.dhara ? entity : null;
    refreshSelected();
  }

  function refreshSelected() {
    const card = state.overlay.querySelector(".t3d-selected");
    const e = state.selected;
    if (!e) { card.hidden = true; card.innerHTML = ""; return; }
    const info = e.dhara;
    let html = "";
    if (info.kind === "road") {
      const p = currentProps("road", info.segment_id) || {};
      html = `<div class="t3d-h">SELECTED ROAD</div>
        <div><b>${escapeHtml(info.segment_id)}</b> · ${escapeHtml(p.road_type || "")}</div>
        <div>Closure risk <b>${p.closure_probability != null ? (p.closure_probability * 100).toFixed(0) + "%" : "–"}</b>
          · slope ${p.slope_deg != null ? p.slope_deg.toFixed(1) + "°" : "–"} · landslide class ${p.landslide_class ?? "–"}</div>` +
        (p.hazard_reasons && p.hazard_reasons.length
          ? `<ul class="t3d-reasons">${p.hazard_reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>` : "") +
        `<button type="button" class="t3d-btn t3d-fly">✈ Fly this road</button>`;
    } else if (info.kind === "hab") {
      const p = currentProps("hab", info.id) || {};
      html = `<div class="t3d-h">SELECTED HABITATION</div>
        <div><b>${escapeHtml(p.name || info.id)}</b> · pop. ${p.population ?? "–"}</div>
        <div>VRI <b>${p.vri != null ? p.vri.toFixed(1) : "–"}</b> · ${escapeHtml((p.cutoff_status || "").replace(/_/g, " "))}</div>`;
    } else if (info.kind === "depot") {
      const d = info.depot;
      html = `<div class="t3d-h">DEPOT</div><div><b>${escapeHtml(d.name)}</b></div>
        <div>${d.stock ? d.stock.rice_tonnes + " t rice · " : ""}${d.vehicles_available ?? "?"} vehicles available</div>`;
    } else if (info.kind === "hazard") {
      const p = info.p;
      html = `<div class="t3d-h">HAZARD · ${escapeHtml(p.source)}</div><div><b>${escapeHtml(p.title)}</b></div>` +
        (info.radius ? `<div>Shaded: ~${info.radius.toFixed(0)} km landslide envelope</div>` : "") +
        `<div class="t3d-muted">${p.event_time ? new Date(p.event_time).toLocaleString("en-IN") : ""}</div>`;
    }
    card.innerHTML = html;
    card.hidden = false;
    const fly = card.querySelector(".t3d-fly");
    if (fly) fly.addEventListener("click", () => flyRoad(info.line));
  }

  // From high above, villages must show through ridges; at flight altitude that
  // clutters the view, so terrain occludes them while flying.
  function setVillageOcclusion(occlude) {
    const d = occlude ? 0 : Number.POSITIVE_INFINITY;
    state.habEntities.forEach((e) => { e.point.disableDepthTestDistance = d; });
  }

  function stopFlight() {
    if (state.flight) {
      cancelAnimationFrame(state.flight.raf);
      state.flight = null;
      setVillageOcclusion(false);
      if (state.viewer) {
        state.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        state.viewer.scene.requestRender();
      }
    }
  }

  async function flyRoad(line) {
    stopFlight();
    const viewer = state.viewer;
    const cartos = line.map(([lon, lat]) => Cesium.Cartographic.fromDegrees(lon, lat));
    // Cumulative ground distance along the road.
    const cum = [0];
    for (let i = 1; i < cartos.length; i++) {
      const g = new Cesium.EllipsoidGeodesic(cartos[i - 1], cartos[i]);
      cum.push(cum[i - 1] + g.surfaceDistance);
    }
    const length = cum[cum.length - 1];
    const exag = state.exaggerated ? 2 : 1;

    setStatus("Preparing flight (sampling terrain heights)…");
    try {
      await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, cartos);
    } catch (_) { /* flat fallback: heights stay 0 */ }

    // Short segments: orbit instead — a 100 m "flight" says nothing.
    if (length < 1500) {
      const mid = cartos[Math.floor(cartos.length / 2)];
      const center = Cesium.Cartesian3.fromRadians(mid.longitude, mid.latitude, (mid.height || 0) * exag);
      const start = performance.now();
      const step = (now) => {
        const t = (now - start) / 12000;
        if (t >= 1) return stopFlight();
        viewer.camera.lookAt(center, new Cesium.HeadingPitchRange(t * Cesium.Math.TWO_PI, Cesium.Math.toRadians(-25), 900));
        viewer.scene.requestRender();
        state.flight.raf = requestAnimationFrame(step);
      };
      state.flight = { raf: requestAnimationFrame(step) };
      setVillageOcclusion(true);
      setStatus("Orbiting short segment — drag the map to stop.");
      return;
    }

    const duration = Math.min(40000, Math.max(10000, (length / 1000) * 5000));
    const at = (d) => {
      let i = 1;
      while (i < cum.length - 1 && cum[i] < d) i++;
      const f = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
      const a = cartos[i - 1], b = cartos[i];
      return {
        lon: a.longitude + (b.longitude - a.longitude) * f,
        lat: a.latitude + (b.latitude - a.latitude) * f,
        h: ((a.height || 0) + ((b.height || 0) - (a.height || 0)) * f) * exag,
      };
    };
    const start = performance.now();
    const step = (now) => {
      const t = (now - start) / duration;
      if (t >= 1) { stopFlight(); setStatus("Flight complete."); return; }
      const d = t * length;
      const here = at(d);
      const ahead = at(Math.min(length, d + 300));
      const heading = Math.atan2(
        Math.sin(ahead.lon - here.lon) * Math.cos(ahead.lat),
        Math.cos(here.lat) * Math.sin(ahead.lat) - Math.sin(here.lat) * Math.cos(ahead.lat) * Math.cos(ahead.lon - here.lon)
      );
      // Chase camera: look down at the road point from behind and above, so
      // valley walls taller than the camera never fill the frame.
      viewer.camera.lookAt(
        Cesium.Cartesian3.fromRadians(here.lon, here.lat, here.h),
        new Cesium.HeadingPitchRange(heading, Cesium.Math.toRadians(-35), CHASE_RANGE_M * exag)
      );
      viewer.scene.requestRender();
      state.flight.raf = requestAnimationFrame(step);
    };
    state.flight = { raf: requestAnimationFrame(step) };
    setVillageOcclusion(true);
    setStatus(`Flying ${(length / 1000).toFixed(1)} km of road — drag the map to stop.`);
  }

  // ------------------------------------------------------------------
  // Open / close
  // ------------------------------------------------------------------
  async function open() {
    state.lastFocus = document.activeElement;
    if (!state.overlay) state.overlay = buildOverlay();
    state.overlay.classList.add("open");
    document.body.classList.add("t3d-lock");
    state.overlay.querySelector(".t3d-close").focus();

    if (state.viewer) {
      state.viewer.useDefaultRenderLoop = true;
      requestRender();
      return;
    }
    try {
      setStatus("Loading 3D engine (~5 MB, first time only)…");
      await loadCesium();
      setStatus("Loading terrain and forecast…");
      state.viewer = createViewer(state.overlay.querySelector(".t3d-viewer"));
      // Stop flights/orbits when the officer grabs the camera.
      state.viewer.screenSpaceEventHandler.setInputAction(stopFlight, Cesium.ScreenSpaceEventType.LEFT_DOWN);
      state.viewer.screenSpaceEventHandler.setInputAction((m) => {
        stopFlight();
        const picked = state.viewer.scene.pick(m.position);
        state.viewer.selectedEntity = picked && picked.id instanceof Cesium.Entity ? picked.id : undefined;
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      resetCamera();
      const data = await loadDay(0);
      drawBase(data);
      await showDay(state.day);
      drawDepots();
      drawHazards();
      setStatus("Drag to pan · right-drag or Ctrl-drag to tilt · click a road or village.");
    } catch (err) {
      console.error("3D view failed:", err);
      setStatus(err.message || "3D view failed to load.");
      toast("3D terrain view could not load — the 2D map still works.", "warning");
    }
  }

  function close() {
    if (!state.overlay) return;
    stopPlay();
    stopFlight();
    state.overlay.classList.remove("open");
    document.body.classList.remove("t3d-lock");
    // Stop rendering while hidden so the GPU idles.
    if (state.viewer) state.viewer.useDefaultRenderLoop = false;
    if (state.lastFocus && state.lastFocus.focus) state.lastFocus.focus();
  }

  // Leaflet button on the 2D command map.
  function attach(leafletMap) {
    if (!leafletMap || state.attached) return;
    state.attached = true;
    const Btn = L.Control.extend({
      options: { position: "topleft" },
      onAdd: function () {
        const el = L.DomUtil.create("button", "t3d-launch");
        el.type = "button";
        el.innerHTML = "🏔 3D terrain";
        el.title = "Open 3D terrain view (loads ~5 MB the first time)";
        L.DomEvent.disableClickPropagation(el);
        el.addEventListener("click", open);
        return el;
      },
    });
    new Btn().addTo(leafletMap);
  }

  window.DharaTerrain3D = { attach, open, close, get viewer() { return state.viewer; } };
})();
