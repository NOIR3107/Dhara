/**
 * DHARA — Officer map tools (Phase 4)
 *
 *   - Shared map notes: helipads, staging areas, notes (points) and closure
 *     zones (areas), stored in PostGIS via /annotations and written to the
 *     audit trail. Everyone on the command map sees them (60 s refresh).
 *   - Measure: distance along a clicked line (not saved).
 *   - Driver photo reports (from /report) as a camera layer with thumbnails.
 *   - Situation snapshot: one GeoJSON file with the selected forecast day's
 *     road risks, live hazards and officer notes, for after-action review.
 *
 * Drawing pattern adapted from the whiteboard tools in
 * bilawalsidhu/gods-eye-view (MIT). Depends on globals from app.js:
 * API_BASE, showToast.
 */
(function () {
  "use strict";

  const KINDS = {
    helipad: { icon: "🚁", label: "Helipad", geom: "Point" },
    staging_area: { icon: "📦", label: "Staging area", geom: "Point" },
    note: { icon: "📝", label: "Note", geom: "Point" },
    closure_zone: { icon: "⛔", label: "Closure zone", geom: "Polygon" },
  };
  const REFRESH_MS = 60 * 1000;
  const AUTHOR_KEY = "dhara.author";

  const state = { map: null, layer: null, draft: null, panel: null, timer: null };

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function toast(msg, type) {
    if (typeof showToast === "function") showToast(msg, type);
  }

  function haversineKm(a, b) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLon = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function lineKm(points) {
    let km = 0;
    for (let i = 1; i < points.length; i++) km += haversineKm(points[i - 1], points[i]);
    return km;
  }

  function getAuthor() {
    try { return localStorage.getItem(AUTHOR_KEY) || ""; } catch (_) { return ""; }
  }

  function setAuthor(v) {
    try { localStorage.setItem(AUTHOR_KEY, v); } catch (_) { /* private mode */ }
  }

  function status(text) {
    const el = state.panel && state.panel.querySelector(".ops-status");
    if (el) { el.textContent = text; el.hidden = !text; }
  }

  // ------------------------------------------------------------------
  // Rendering shared annotations
  // ------------------------------------------------------------------
  function annotationLayer(f) {
    const p = f.properties;
    const kind = KINDS[p.kind] || { icon: "📌", label: p.kind };
    const when = new Date(p.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
    const popup = `<strong>${kind.icon} ${escapeHtml(p.label)}</strong><br>${escapeHtml(kind.label)} · by ${escapeHtml(p.author)}<br>` +
      `<span class="intel-muted">${when}</span><br>` +
      `<button type="button" class="ops-remove" data-id="${p.id}">Remove</button>`;
    let layer;
    if (f.geometry.type === "Point") {
      const [lon, lat] = f.geometry.coordinates;
      layer = L.marker([lat, lon], {
        icon: L.divIcon({ className: "ops-pin", html: `<span>${kind.icon}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] }),
        keyboard: true,
        title: p.label,
      });
    } else {
      layer = L.geoJSON(f, {
        style: p.kind === "closure_zone"
          ? { color: "#B91C1C", weight: 2, dashArray: "6 4", fillColor: "#DC2626", fillOpacity: 0.12 }
          : { color: "#7C3AED", weight: 3 },
      });
    }
    return layer.bindPopup(popup);
  }

  // ------------------------------------------------------------------
  // Driver photo reports (submitted from /report), last 7 days
  // ------------------------------------------------------------------
  const INCIDENT_LABELS = {
    landslide: "Landslide / debris", flooding: "Water over road", washout: "Road washed out",
    tree_fall: "Fallen tree", accident: "Accident / stuck vehicle", other: "Other",
  };
  const PASS_LABELS = { blocked: "Blocked", one_lane: "One lane only", slow: "Passable, slow", open: "Open" };
  const STUCK_LABELS = { none: "none", "1_5": "1–5", "6_20": "6–20", "20_plus": "20+" };

  function photoLayer(f) {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    const when = new Date(p.captured_at || p.received_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
    const thumbs = (p.photo_urls || []).map((u) =>
      `<a href="${API_BASE}${escapeHtml(u)}" target="_blank" rel="noopener"><img src="${API_BASE}${escapeHtml(u)}" alt="Field photo" loading="lazy"></a>`).join("");
    const popup =
      `<strong>📷 ${escapeHtml(INCIDENT_LABELS[p.incident_type] || p.incident_type)}</strong> ` +
      `<span class="intel-prov">UNVERIFIED · ${escapeHtml(p.ref)}</span><br>` +
      `Road: <b>${escapeHtml(PASS_LABELS[p.passability] || p.passability)}</b> · vehicles stuck: ${escapeHtml(STUCK_LABELS[p.vehicles_stuck] || "?")}<br>` +
      `<div class="ops-photo-thumbs">${thumbs}</div>` +
      (p.note ? `<div>${escapeHtml(p.note)}</div>` : "") +
      (p.landmark ? `<div class="intel-muted">Near: ${escapeHtml(p.landmark)}</div>` : "") +
      `<div class="intel-muted">${escapeHtml(p.reporter_name)}${p.vehicle_id ? " · " + escapeHtml(p.vehicle_id) : ""} · ${when}` +
      `${p.accuracy_m != null ? " · GPS ±" + Math.round(p.accuracy_m) + " m" : ""}</div>`;
    return L.marker([lat, lon], {
      icon: L.divIcon({ className: `ops-pin ops-photo ${p.passability === "blocked" ? "blocked" : ""}`, html: "<span>📷</span>", iconSize: [30, 30], iconAnchor: [15, 15] }),
      title: `${INCIDENT_LABELS[p.incident_type] || p.incident_type} (${p.ref})`,
      keyboard: true,
    }).bindPopup(popup, { maxWidth: 280 });
  }

  async function refreshPhotos() {
    try {
      const res = await fetch(`${API_BASE}/field-photos?days=7`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      state.photoLayer.clearLayers();
      const located = (data.features || []).filter((f) => f.geometry && f.geometry.type === "Point");
      located.forEach((f) => state.photoLayer.addLayer(photoLayer(f)));
      const count = state.panel && state.panel.querySelector(".ops-photo-count");
      if (count) {
        const unplaced = (data.features || []).length - located.length;
        count.textContent = `${located.length} driver photo report(s) on the map (7 days)` + (unplaced ? `, ${unplaced} without GPS` : "");
      }
    } catch (err) {
      console.warn("Field photos fetch failed:", err);
    }
  }

  async function refresh() {
    refreshPhotos();
    try {
      const res = await fetch(`${API_BASE}/annotations`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      state.layer.clearLayers();
      (data.features || []).forEach((f) => state.layer.addLayer(annotationLayer(f)));
      const count = state.panel && state.panel.querySelector(".ops-count");
      if (count) count.textContent = `${(data.features || []).length} shared note(s)`;
    } catch (err) {
      console.warn("Annotations fetch failed:", err);
    }
  }

  async function removeAnnotation(id) {
    if (!window.confirm("Remove this map note for everyone? It stays in the audit trail.")) return;
    const author = getAuthor() || "unknown";
    try {
      const res = await fetch(`${API_BASE}/annotations/${id}?author=${encodeURIComponent(author)}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || `API ${res.status}`);
      state.map.closePopup();
      toast("Map note removed.", "success");
      refresh();
    } catch (err) {
      toast(`Could not remove note: ${err.message}`, "warning");
    }
  }

  // ------------------------------------------------------------------
  // Drawing
  // ------------------------------------------------------------------
  function startDraft(mode) {
    cancelDraft();
    const kind = KINDS[mode];
    state.draft = {
      mode,
      geom: mode === "measure" ? "LineString" : kind.geom,
      points: [],
      preview: L.layerGroup().addTo(state.map),
    };
    state.map.doubleClickZoom.disable();
    state.map.getContainer().classList.add("ops-drawing");
    state.map.on("click", onMapClick);
    state.map.on("dblclick", finishDraft);
    const what = mode === "measure" ? "Measuring" : `Placing ${kind.label.toLowerCase()}`;
    status(state.draft.geom === "Point"
      ? `${what}: click the map.`
      : `${what}: click to add points, double-click or Finish to complete.`);
    setDrawButtons(true);
  }

  function redrawPreview() {
    const d = state.draft;
    d.preview.clearLayers();
    d.points.forEach((p) => d.preview.addLayer(L.circleMarker(p, { radius: 4, color: "#312622", weight: 2, fillColor: "#FFFFFF", fillOpacity: 1 })));
    if (d.points.length > 1) {
      const style = { color: d.mode === "measure" ? "#2563EB" : "#B91C1C", weight: 2, dashArray: "5 4" };
      d.preview.addLayer(d.geom === "Polygon" && d.points.length > 2 ? L.polygon(d.points, style) : L.polyline(d.points, style));
    }
    if (d.mode === "measure" && d.points.length > 1) {
      status(`Distance: ${lineKm(d.points).toFixed(2)} km straight-line along ${d.points.length - 1} leg(s). Double-click or Finish to stop.`);
    }
  }

  function onMapClick(e) {
    const d = state.draft;
    if (!d) return;
    // A double-click also fires two clicks; ignore a repeat of the last point.
    const last = d.points[d.points.length - 1];
    if (last && last.equals(e.latlng)) return;
    d.points.push(e.latlng);
    if (d.geom === "Point") return finishDraft();
    redrawPreview();
  }

  function finishDraft() {
    const d = state.draft;
    if (!d) return;
    const need = d.geom === "Point" ? 1 : d.geom === "Polygon" ? 3 : 2;
    if (d.points.length < need) {
      status(`Add at least ${need} point(s) first.`);
      return;
    }
    stopListening();
    if (d.mode === "measure") {
      const km = lineKm(d.points);
      d.preview.clearLayers();
      d.preview.addLayer(L.polyline(d.points, { color: "#2563EB", weight: 3 })
        .bindTooltip(`${km.toFixed(2)} km`, { permanent: true, direction: "center", className: "ops-measure-label" }));
      status(`Measured ${km.toFixed(2)} km (straight-line legs; road distance is longer). Click Clear to remove.`);
      state.measure = d.preview;
      state.draft = null;
      setDrawButtons(false);
      return;
    }
    showSaveForm();
  }

  function stopListening() {
    state.map.off("click", onMapClick);
    state.map.off("dblclick", finishDraft);
    state.map.doubleClickZoom.enable();
    state.map.getContainer().classList.remove("ops-drawing");
  }

  function cancelDraft() {
    if (state.draft) {
      stopListening();
      state.map.removeLayer(state.draft.preview);
      state.draft = null;
    }
    const form = state.panel && state.panel.querySelector(".ops-save");
    if (form) form.hidden = true;
    status("");
    setDrawButtons(false);
  }

  function setDrawButtons(drawing) {
    if (!state.panel) return;
    state.panel.querySelector(".ops-finish").hidden = !drawing || (state.draft && state.draft.geom === "Point");
    state.panel.querySelector(".ops-cancel").hidden = !drawing;
  }

  function showSaveForm() {
    const form = state.panel.querySelector(".ops-save");
    form.hidden = false;
    form.querySelector(".ops-author").value = getAuthor();
    const label = form.querySelector(".ops-label");
    label.value = "";
    label.focus();
    status(`${KINDS[state.draft.mode].label}: add a label and save.`);
    setDrawButtons(false);
    state.panel.querySelector(".ops-cancel").hidden = false;
  }

  function toGeoJSON(d) {
    const ll = (p) => [Number(p.lng.toFixed(6)), Number(p.lat.toFixed(6))];
    if (d.geom === "Point") return { type: "Point", coordinates: ll(d.points[0]) };
    const ring = d.points.map(ll);
    ring.push(ring[0]);
    return { type: "Polygon", coordinates: [ring] };
  }

  async function saveDraft(ev) {
    ev.preventDefault();
    const d = state.draft;
    if (!d) return;
    const form = state.panel.querySelector(".ops-save");
    const label = form.querySelector(".ops-label").value.trim();
    const author = form.querySelector(".ops-author").value.trim();
    if (!label || !author) {
      status("Label and your name are both required.");
      return;
    }
    setAuthor(author);
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const res = await fetch(`${API_BASE}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: d.mode, label, author, geometry: toGeoJSON(d) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `API ${res.status}`);
      toast(`${KINDS[d.mode].icon} Saved and shared: ${label}`, "success");
      cancelDraft();
      refresh();
    } catch (err) {
      status(`Not saved: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }

  // ------------------------------------------------------------------
  // Situation snapshot export
  // ------------------------------------------------------------------
  async function exportSnapshot() {
    const activeChip = document.querySelector("#forecast-day-chips .forecast-day-chip.active");
    const day = activeChip ? Number(activeChip.dataset.day) : 0;
    status("Building snapshot…");
    try {
      const [segs, hazards, notes] = await Promise.all([
        fetch(`${API_BASE}/segments/at-risk?day=${day}`).then((r) => r.json()),
        fetch(`${API_BASE}/hazards?days=14`).then((r) => r.json()),
        fetch(`${API_BASE}/annotations`).then((r) => r.json()),
      ]);
      const tag = (fc, layer) => (fc.features || []).map((f) =>
        Object.assign({}, f, { properties: Object.assign({ layer }, f.properties) }));
      const now = new Date();
      const snapshot = {
        type: "FeatureCollection",
        dhara_snapshot: {
          generated_at: now.toISOString(),
          forecast_day_index: day,
          forecast_for_date: segs.features && segs.features[0] ? segs.features[0].properties.forecast_for_date : null,
          map_view: (() => { const c = state.map.getCenter(); return { lat: c.lat, lon: c.lng, zoom: state.map.getZoom() }; })(),
          layers: {
            road_risk: "DERIVED — DHARA closure model + live hazard adjustment",
            hazard: "EXTERNAL — USGS / GDACS / FIRMS",
            officer_note: "REAL — officer annotations",
          },
        },
        features: [...tag(segs, "road_risk"), ...tag(hazards, "hazard"), ...tag(notes, "officer_note")],
      };
      const blob = new Blob([JSON.stringify(snapshot)], { type: "application/geo+json" });
      const a = document.createElement("a");
      const stamp = now.toISOString().slice(0, 16).replace(/[-:T]/g, "");
      a.href = URL.createObjectURL(blob);
      a.download = `dhara-snapshot-${stamp}.geojson`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      status(`Snapshot saved: ${snapshot.features.length} features (day ${day + 1}).`);
    } catch (err) {
      status(`Snapshot failed: ${err.message}`);
    }
  }

  // ------------------------------------------------------------------
  // Panel
  // ------------------------------------------------------------------
  function buildPanel() {
    const Panel = L.Control.extend({
      options: { position: "topleft" },
      onAdd: function () {
        const el = L.DomUtil.create("div", "intel-panel ops-panel collapsed");
        el.innerHTML = `
          <button type="button" class="intel-toggle" aria-expanded="false">✏️ Map notes</button>
          <div class="intel-body">
            <div class="intel-h">SHARED NOTES <span class="intel-prov">REAL · AUDITED</span></div>
            <div class="ops-tools">
              ${Object.entries(KINDS).map(([k, v]) => `<button type="button" class="ops-tool" data-mode="${k}">${v.icon} ${v.label}</button>`).join("")}
              <button type="button" class="ops-tool" data-mode="measure">📏 Measure</button>
            </div>
            <div class="ops-status intel-muted" aria-live="polite" hidden></div>
            <div class="ops-actions">
              <button type="button" class="ops-finish" hidden>Finish</button>
              <button type="button" class="ops-cancel" hidden>Cancel</button>
              <button type="button" class="ops-clear">Clear measure</button>
            </div>
            <form class="ops-save" hidden>
              <label>Label <input class="ops-label" maxlength="120" required placeholder="e.g. Helipad at Bomdila school ground"></label>
              <label>Your name <input class="ops-author" maxlength="60" required placeholder="Officer name"></label>
              <button type="submit">Save &amp; share</button>
            </form>
            <div class="intel-muted ops-count"></div>
            <div class="intel-muted ops-photo-count"></div>
            <button type="button" class="intel-share ops-export">⬇ Export situation snapshot</button>
          </div>`;
        L.DomEvent.disableClickPropagation(el);
        L.DomEvent.disableScrollPropagation(el);

        const toggle = el.querySelector(".intel-toggle");
        toggle.addEventListener("click", () => {
          const collapsed = el.classList.toggle("collapsed");
          toggle.setAttribute("aria-expanded", String(!collapsed));
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
        el.querySelectorAll(".ops-tool").forEach((b) => b.addEventListener("click", () => startDraft(b.dataset.mode)));
        el.querySelector(".ops-finish").addEventListener("click", finishDraft);
        el.querySelector(".ops-cancel").addEventListener("click", cancelDraft);
        el.querySelector(".ops-clear").addEventListener("click", () => {
          if (state.measure) { state.map.removeLayer(state.measure); state.measure = null; }
          status("");
        });
        el.querySelector(".ops-save").addEventListener("submit", saveDraft);
        el.querySelector(".ops-export").addEventListener("click", exportSnapshot);
        return el;
      },
    });
    const control = new Panel().addTo(state.map);
    state.panel = control.getContainer();
  }

  function attach(leafletMap) {
    if (!leafletMap || state.map) return;
    state.map = leafletMap;
    state.layer = L.layerGroup().addTo(leafletMap);
    state.photoLayer = L.layerGroup().addTo(leafletMap);
    buildPanel();

    // Remove buttons live inside popups; delegate from the map container.
    leafletMap.getContainer().addEventListener("click", (ev) => {
      const btn = ev.target.closest(".ops-remove");
      if (btn) removeAnnotation(Number(btn.dataset.id));
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && state.draft) cancelDraft();
    });

    refresh();
    state.timer = setInterval(refresh, REFRESH_MS);
  }

  // Open or close the notes panel (used by the Live Map toolbar). Goes
  // through the panel's own toggle so "one panel open at a time" still holds.
  function togglePanel() {
    const toggle = state.panel && state.panel.querySelector(".intel-toggle");
    if (toggle) toggle.click();
  }

  window.DharaOps = { attach, refresh, togglePanel };
})();
