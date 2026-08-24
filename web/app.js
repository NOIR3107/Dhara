/**
 * DHARA Command Center — Client Logic v5.0
 * WORKLIST-FIRST OPERATIONAL WORKFLOW + SHIPMENTS TRUCK MANIFEST + CHART.JS ANALYTICS
 * PostgreSQL PostGIS + Fastify API Integration (http://localhost:3001)
 */

const API_BASE = "http://localhost:3001";

// i18n Localization Dictionary
const I18N = {
  en: {
    nav: { overview: "Overview", todayDecisions: "Today's Decisions", shipments: "Shipments & Trucks", risks: "Risks", routes: "Routes", fleet: "Fleet Telemetry", depots: "Depots & Hubs", fieldReport: "Field Reports", auditTrail: "Audit Trail", copilot: "DHARA Copilot", trackRecord: "Track Record", scenarios: "What-If Scenarios", planner: "Infrastructure Planner" },
    dashboard: { greeting: "GOOD MORNING, OFFICER", todayTitle: "TODAY'S DECISIONS", heroCount: "3 villages need a decision today" },
    actions: { approve: "APPROVE", change: "CHANGE", reject: "REJECT", viewEvidence: "VIEW EVIDENCE" }
  },
  hi: {
    nav: { overview: "अवलोकन", todayDecisions: "आज के निर्णय", shipments: "शिपमेंट और ट्रक", risks: "जोखिम", routes: "मार्ग", fleet: "वाहन बेड़ा", depots: "डिपो और हब", fieldReport: "फील्ड रिपोर्ट", auditTrail: "ऑडिट ट्रेल", copilot: "धारा कोपायलट", trackRecord: "ट्रैक रिकॉर्ड", scenarios: "व्हाट-इफ परिदृश्य", planner: "बुनियादी ढांचा योजनाकार" },
    dashboard: { greeting: "शुभ प्रभात, अधिकारी", todayTitle: "आज के निर्णय", heroCount: "आज 3 गांवों के लिए निर्णय आवश्यक है" },
    actions: { approve: "स्वीकार करें", change: "बदलें", reject: "अस्वीकार करें", viewEvidence: "प्रमाण देखें" }
  },
  bn: {
    nav: { overview: "সংক্ষিপ্ত বিবরণ", todayDecisions: "আজকের সিদ্ধান্ত", shipments: "শিপমেন্ট ও ট্রাক", risks: "ঝুঁকি", routes: "রুট", fleet: "যানবাহন বহর", depots: "ডিপো ও হাব", fieldReport: "ফিল্ড রিপোর্ট", auditTrail: "অডিট ট্রেইল", copilot: "ধারা কোপাইলট", trackRecord: "ট্র্যাক রেকর্ড", scenarios: "হোয়াট-ইফ দৃশ্যপট", planner: "অবকাঠামো পরিকল্পনাকারী" },
    dashboard: { greeting: "শুভ সকাল, অফিসার", todayTitle: "আজকের সিদ্ধান্ত", heroCount: "আজ ৩টি গ্রামের জন্য সিদ্ধান্ত প্রয়োজন" },
    actions: { approve: "অনুমোদন করুন", change: "পরিবর্তন করুন", reject: "প্রত্যাখ্যান করুন", viewEvidence: "প্রমাণ দেখুন" }
  },
  mni: {
    nav: { overview: "ওভরভিউ", todayDecisions: "ঙসিগী ৱারেপশিং", shipments: "শিপমেন্ত অমশুং ত্রাক", risks: "খুদোংথিবা", routes: "লম্বী-থোং", fleet: "গাড়ী কাংবু", depots: "ডিপো অমশুং হব", fieldReport: "ফিল্ড রিফোর্ত", auditTrail: "ওদিত ত্রেইেল", copilot: "ধারা কোপাইলোত", trackRecord: "ত্রেক রিকোর্দ", scenarios: "ৱাৎ-ইফ ফিভম", planner: "প্লান্নিং অথোরিতী" },
    dashboard: { greeting: "নুমিৎফবা ওফিসার", todayTitle: "ঙসিগী ৱারেপশিং", heroCount: "ঙসি খুংগং ৩ গী ৱারেপ ইলৌবা তশেংনা দরকার লৈরে" },
    actions: { approve: "য়াবিয়ু", change: "ওন্থোকবিয়ু", reject: "য়াদবিয়ু", viewEvidence: "খুদম য়েংবিয়ু" }
  },
  as: {
    nav: { overview: "অৱলোকন", todayDecisions: "আজৰি সিদ্ধান্ত", shipments: "শ্বিপমেণ্ট আৰু ট্ৰাক", risks: "বিপদ", routes: "ৰুট", fleet: "বাহন বহৰ", depots: "ডিপো আৰু হাব", fieldReport: "ফিল্ড ৰিপৰ্ট", auditTrail: "অডিট ট্ৰেইল", copilot: "ধাৰা কোপাইলাট", trackRecord: "ট্ৰেক ৰেকৰ্ড", scenarios: "হোৱাট-ইফ পৰিস্থিতি", planner: "পরিকল্পনাকাৰী" },
    dashboard: { greeting: "শুভ প্ৰভাত, বিষয়া", todayTitle: "আজৰি সিদ্ধান্ত", heroCount: "আজৰি ৩খন গাঁৱৰ বাবে সিদ্ধান্ত প্ৰয়োজন" },
    actions: { approve: "অনুমোদন কৰক", change: "সলনি কৰক", reject: "প্ৰত্যাখ্যান কৰক", viewEvidence: "প্ৰমাণ চাওক" }
  }
};

// Global App State
let habitationsData = [];
let atRiskSegmentsData = [];
let dispatchesData = [];
let shipmentsData = [];
let vehiclesData = [];
let depotsData = [];
let alertsData = [];
let auditData = [];
let trackRecordData = {};

let currentLang = localStorage.getItem("dhara_lang") || "en";
let map = null;
let villageMarkers = {};
let segmentPolylines = [];
let depotMarkers = [];
let connectionLines = [];
let dbPromise = null;

// Chart Instances
let chartVriTrend = null;
let chartDistrictBreakdown = null;
let chartDepotStocks = null;
let chartAccuracyTrend = null;

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  initIndexedDB();
  initLang();
  initRouter();
  checkApiHealth();
  fetchAllData();
  bindEvents();
});

function initIndexedDB() {
  if (!('indexedDB' in window)) return;
  const request = indexedDB.open("DHARA_Offline_DB", 1);
  request.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains("queued_reports")) {
      db.createObjectStore("queued_reports", { keyPath: "uuid" });
    }
  };
  request.onsuccess = (e) => {
    dbPromise = e.target.result;
    syncOfflineReports();
  };
}

function initRouter() {
  window.addEventListener("hashchange", handleRoute);
  handleRoute();
}

function handleRoute() {
  const hash = window.location.hash || "#/overview";
  let viewName = hash.replace("#/", "") || "overview";
  if (viewName === "decisions") viewName = "overview";

  document.querySelectorAll(".sidebar .nav-item").forEach((item) => {
    const v = item.dataset.view;
    if (v) item.classList.toggle("active", v === viewName || (v === "decisions" && viewName === "overview"));
  });

  const views = ["entry", "overview", "shipments", "track-record", "fleet", "depots", "routes", "audit", "risks", "copilot"];
  views.forEach((v) => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.toggle("hidden", v !== viewName);
  });

  const bcTitle = document.getElementById("bc-title");
  if (bcTitle) {
    bcTitle.textContent = viewName.replace("-", " ").toUpperCase();
  }

  if (viewName === "overview" && !map) {
    initMap();
  } else if (viewName === "overview" && map) {
    setTimeout(() => map.invalidateSize(), 200);
  }
}

function initLang() {
  const langSelect = document.getElementById("lang-select");
  if (langSelect) {
    langSelect.value = currentLang;
    langSelect.addEventListener("change", (e) => {
      currentLang = e.target.value;
      localStorage.setItem("dhara_lang", currentLang);
      applyTranslations();
    });
  }
  applyTranslations();
}

function applyTranslations() {
  const t = I18N[currentLang] || I18N.en;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    const parts = key.split(".");
    let val = t;
    parts.forEach((p) => { if (val) val = val[p]; });
    if (val && typeof val === "string") el.innerHTML = val;
  });
}

async function checkApiHealth() {
  const statusSub = document.getElementById("sidebar-status-sub");
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (res.ok) {
      if (statusSub) statusSub.textContent = "All systems operational (PostgreSQL 16 + PostGIS 3.4)";
    }
  } catch (err) {
    if (statusSub) statusSub.textContent = "API Offline (Port 3001)";
  }
}

function initMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  map = L.map("map", {
    center: [27.18, 94.12],
    zoom: 8,
    zoomControl: false,
    attributionControl: false,
  });

  L.control.zoom({ position: "topright" }).addTo(map);

  // CartoDB Dark Matter Basemap (Matches exact dark aesthetic in user's image)
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 18,
    subdomains: "abcd",
  }).addTo(map);

  renderMapLayers();
}

async function fetchAllData() {
  try {
    const [habRes, segRes, dispRes, shpRes, vehRes, depRes, altRes, audRes, trRes] = await Promise.all([
      fetch(`${API_BASE}/habitations`).then((r) => r.json()),
      fetch(`${API_BASE}/segments/at-risk`).then((r) => r.json()),
      fetch(`${API_BASE}/dispatches`).then((r) => r.json()),
      fetch(`${API_BASE}/shipments`).then((r) => r.json()),
      fetch(`${API_BASE}/vehicles/live`).then((r) => r.json()),
      fetch(`${API_BASE}/depots`).then((r) => r.json()),
      fetch(`${API_BASE}/alerts`).then((r) => r.json()),
      fetch(`${API_BASE}/audit`).then((r) => r.json()),
      fetch(`${API_BASE}/track-record`).then((r) => r.json()),
    ]);

    habitationsData = habRes.features || [];
    atRiskSegmentsData = segRes.features || [];
    dispatchesData = dispRes || [];
    shipmentsData = shpRes || [];
    vehiclesData = vehRes || [];
    depotsData = depRes || [];
    alertsData = altRes || [];
    auditData = audRes || [];
    trackRecordData = trRes || {};

    renderApp();
  } catch (err) {
    console.error("Error fetching Fastify API data:", err);
  }
}

function renderApp() {
  renderWorklistDecisionCards();
  renderPermanentTrackRecord();
  renderActiveRisks();
  renderDashboardTables();
  renderShipmentsView();
  renderDetailedTrackRecord();
  renderFleetView();
  renderDepotsView();
  renderRoutesView();
  renderAuditLogs();
  renderAlerts();
  initAnalyticsCharts();
  if (map) renderMapLayers();
}

// 1. WORKLIST-FIRST DECISION CARDS RENDERER
function renderWorklistDecisionCards() {
  const container = document.getElementById("decision-cards-container");
  const heroCount = document.getElementById("worklist-hero-count");
  if (!container) return;

  const urgentHabitations = habitationsData.slice(0, 3);
  if (heroCount) heroCount.textContent = `${urgentHabitations.length} villages need a decision today`;

  container.innerHTML = urgentHabitations.map((h, i) => {
    const p = h.properties;
    const disp = dispatchesData[i] || {
      id: `DISP_${p.id}`,
      units_shipped: 12,
      depot_name: "Relief Hub A (Tawang)",
      reasoning: "Heavy monsoon precipitation & high slope risk may sever route accessibility."
    };

    return `
      <div class="decision-card-item" id="dec-card-${p.id}">
        <div class="dec-card-header">
          <div class="dec-village-name">
            <span class="location-pin">📌</span>
            <h3>${p.name.toUpperCase()} <span class="village-id">(${p.id})</span></h3>
          </div>
          <div class="dec-cutoff-badge danger">Cutoff in ${p.hours_until_cutoff ? p.hours_until_cutoff + 'h' : '38h'}</div>
        </div>

        <div class="dec-card-body">
          <div class="dec-rec-box">
            <div class="rec-title">RECOMMENDED ACTION</div>
            <div class="rec-action-text">Pre-position ${disp.units_shipped || 12}t Relief Rations</div>
            <div class="rec-logistics-sub">From: <strong>${disp.depot_name || 'Relief Hub A'}</strong> &bull; Route: <strong>NH-150 Kameng Corridor</strong></div>
          </div>

          <div class="dec-why-box">
            <strong>WHY:</strong> ${disp.reasoning}
          </div>

          <div class="dec-metrics-row">
            <span class="vri-score-pill">VRI: <strong>${p.vri} / 100</strong></span>
            <span class="conf-pill">Confidence: <strong>${(p.confidence * 100).toFixed(0)}%</strong></span>
            <span class="badge-provenance derived">DERIVED ML</span>
          </div>
        </div>

        <div class="dec-card-actions">
          <button class="btn-dec-action approve" onclick="handleApproveDecision('${p.id}')">APPROVE</button>
          <button class="btn-dec-action change" onclick="handleOpenChangeModal('${p.id}')">CHANGE</button>
          <button class="btn-dec-action reject" onclick="handleOpenRejectModal('${p.id}')">REJECT</button>
          <button class="btn-dec-action evidence" onclick="handleViewEvidence('${p.id}')">VIEW EVIDENCE</button>
        </div>
      </div>
    `;
  }).join("");
}

// 2. SHIPMENTS & TRUCKS TAB RENDERER WITH LICENSE PLATES
function renderShipmentsView() {
  const container = document.getElementById("shipments-cards-container");
  if (!container) return;

  container.innerHTML = shipmentsData.map((s) => `
    <div class="shipment-card-item">
      <div class="shipment-card-top">
        <div class="truck-license-badge" onclick="handleOpenShipmentDetailModal('${s.shipment_id}')">
          <span class="license-icon">🚛</span>
          <span class="license-num">${s.license_number}</span>
          <span class="click-hint">(Click for details)</span>
        </div>
        <span class="status-pill ${s.status.toLowerCase().replace(' ', '_')}">${s.status}</span>
      </div>

      <div class="shipment-card-body">
        <div class="shipment-title-type">${s.truck_type}</div>
        <div class="shipment-route-sub">Origin: <strong>${s.origin_depot}</strong> &rarr; Target: <strong>${s.destination_village}</strong></div>
        
        <div class="cargo-summary-pill">
          📦 <strong>CARGO:</strong> ${s.cargo_summary}
        </div>

        <div class="shipment-meta-flex">
          <div>Started: <strong>${s.dispatch_started_at}</strong></div>
          <div>ETA: <strong>${s.estimated_arrival}</strong></div>
        </div>

        <div class="progress-bar-container">
          <div class="progress-bar-fill" style="width: ${s.progress_pct}%;"></div>
        </div>
        <div class="progress-text">${s.progress_pct}% Route Completed &bull; Driver: ${s.driver_name}</div>
      </div>
    </div>
  `).join("");
}

// 3. SHIPMENT MANIFEST DETAILED MODAL HANDLER
window.handleOpenShipmentDetailModal = (shipmentId) => {
  const s = shipmentsData.find((item) => item.shipment_id === shipmentId) || shipmentsData[0];
  if (!s) return;

  const licPlateEl = document.getElementById("modal-lic-plate");
  if (licPlateEl) licPlateEl.textContent = s.license_number;

  const content = document.getElementById("shipment-modal-content");
  if (!content) return;

  content.innerHTML = `
    <div class="shipment-detail-grid">
      <div class="ship-detail-card highlight">
        <div class="detail-label">TRUCK & LICENSE DETAILS</div>
        <div class="lic-big-display">🚛 ${s.license_number}</div>
        <div><strong>Type:</strong> ${s.truck_type}</div>
        <div><strong>Driver:</strong> ${s.driver_name} (${s.driver_contact})</div>
        <div><strong>Status:</strong> <span class="status-pill ${s.status.toLowerCase().replace(' ', '_')}">${s.status}</span></div>
      </div>

      <div class="ship-detail-card">
        <div class="detail-label">DISPATCH & TIMELINE</div>
        <div><strong>Shipment ID:</strong> ${s.shipment_id}</div>
        <div><strong>Dispatch Started:</strong> <strong style="color:#059669;">${s.dispatch_started_at}</strong></div>
        <div><strong>Estimated Arrival (ETA):</strong> <strong style="color:#2563eb;">${s.estimated_arrival}</strong></div>
        <div><strong>Assigned Route:</strong> ${s.route_assigned}</div>
        <div><strong>Corridor VRI Risk:</strong> ${s.route_vri_risk} / 100</div>
      </div>

      <div class="ship-detail-card full-width">
        <div class="detail-label">CARGO MANIFEST (WHAT IT IS CARRYING)</div>
        <div class="cargo-manifest-table">
          <table class="dash-table">
            <thead>
              <tr>
                <th>Item Description</th>
                <th>Quantity Carried</th>
                <th>Priority Tier</th>
              </tr>
            </thead>
            <tbody>
              ${s.cargo_details.map((c) => `
                <tr>
                  <td><strong>${c.item}</strong></td>
                  <td><strong style="color:#2563eb;">${c.qty}</strong></td>
                  <td><span class="badge-prov real">HIGH PRIORITY</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="ship-detail-card full-width">
        <div class="detail-label">ORIGIN DEPOT TO DESTINATION ROUTE</div>
        <div>Origin: <strong>${s.origin_depot}</strong> &bull; Target Village: <strong>${s.destination_village}</strong></div>
        <div class="progress-bar-container" style="margin-top:8px;">
          <div class="progress-bar-fill" style="width: ${s.progress_pct}%;"></div>
        </div>
        <div class="progress-text">${s.progress_pct}% Route Completed &bull; GPS Coordinates: ${s.current_coordinates.join(", ")}</div>
      </div>
    </div>
  `;

  const modal = document.getElementById("modal-shipment-detail");
  if (modal) modal.classList.remove("hidden");
};

// 4. CHART.JS VISUAL ANALYTICS ENGINE
function initAnalyticsCharts() {
  if (typeof Chart === 'undefined') return;

  // Chart 1: 7-Day VRI Risk & Rainfall Trend
  const ctxVri = document.getElementById("chart-vri-trend");
  if (ctxVri) {
    if (chartVriTrend) chartVriTrend.destroy();
    chartVriTrend = new Chart(ctxVri, {
      type: "line",
      data: {
        labels: ["Day 0 (Aug 24)", "Day 1 (Aug 25)", "Day 2 (Aug 26)", "Day 3 (Aug 27)", "Day 4 (Aug 28)", "Day 5 (Aug 29)", "Day 6 (Aug 30)"],
        datasets: [
          {
            label: "Average VRI Score",
            data: [66.7, 68.5, 72.1, 75.4, 71.2, 65.8, 62.0],
            borderColor: "#d9383a",
            backgroundColor: "rgba(217, 56, 58, 0.1)",
            fill: true,
            tension: 0.3,
            yAxisID: "yVri"
          },
          {
            label: "Forecast Rainfall (mm)",
            data: [15.2, 38.4, 62.1, 84.5, 45.0, 20.1, 10.5],
            borderColor: "#2563eb",
            backgroundColor: "rgba(37, 99, 235, 0.3)",
            type: "bar",
            yAxisID: "yRain"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          yVri: { type: "linear", position: "left", min: 40, max: 100, title: { display: true, text: "VRI Score" } },
          yRain: { type: "linear", position: "right", min: 0, max: 100, grid: { drawOnChartArea: false }, title: { display: true, text: "Rainfall (mm)" } }
        }
      }
    });
  }

  // Chart 2: District Risk Breakdown Bar Chart
  const ctxDist = document.getElementById("chart-district-breakdown");
  if (ctxDist) {
    if (chartDistrictBreakdown) chartDistrictBreakdown.destroy();
    chartDistrictBreakdown = new Chart(ctxDist, {
      type: "bar",
      data: {
        labels: ["Ukhrul", "Tawang", "Kameng", "Lohit", "Bomdila", "Mon"],
        datasets: [
          {
            label: "High Risk Villages",
            data: [14, 18, 12, 8, 6, 5],
            backgroundColor: "#d9383a"
          },
          {
            label: "Moderate Risk Villages",
            data: [22, 25, 19, 15, 14, 10],
            backgroundColor: "#d97706"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        scales: { x: { stacked: true }, y: { stacked: true } }
      }
    });
  }

  // Chart 3: Depot Stock Inventory Doughnut Chart
  const ctxDepot = document.getElementById("chart-depot-stocks");
  if (ctxDepot) {
    if (chartDepotStocks) chartDepotStocks.destroy();
    chartDepotStocks = new Chart(ctxDepot, {
      type: "doughnut",
      data: {
        labels: ["Rice & Grains (360t)", "Medical Kits (7,200u)", "Drinking Water (45,000L)", "Fuel Reserves (12,000L)"],
        datasets: [{
          data: [360, 240, 300, 180],
          backgroundColor: ["#059669", "#2563eb", "#d97706", "#211f1c"]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "right" } }
      }
    });
  }

  // Chart 4: Model Prediction Accuracy Trend Line Chart
  const ctxAcc = document.getElementById("chart-accuracy-trend");
  if (ctxAcc) {
    if (chartAccuracyTrend) chartAccuracyTrend.destroy();
    chartAccuracyTrend = new Chart(ctxAcc, {
      type: "line",
      data: {
        labels: ["Week 1", "Week 2", "Week 3", "Week 4 (Current)"],
        datasets: [{
          label: "Prediction Hit Rate (%)",
          data: [71.2, 74.5, 76.8, 78.6],
          borderColor: "#059669",
          backgroundColor: "rgba(5, 150, 105, 0.15)",
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { min: 60, max: 100 } }
      }
    });
  }
}

// 5. PERMANENT TRACK RECORD METER RENDERER
function renderPermanentTrackRecord() {
  const tr = trackRecordData;
  if (!tr) return;
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl("tr-period", tr.evaluation_period || "LAST 30 DAYS");
  setEl("tr-total-pred", tr.total_predictions || 14);
  setEl("tr-confirmed-pred", tr.confirmed_correct || 11);
  setEl("tr-incorrect-pred", tr.incorrect || 3);
  setEl("tr-missed-pred", tr.missed_closures || 2);
  setEl("tr-hit-rate", `${tr.hit_rate_pct || 78.6}%`);
}

function renderDetailedTrackRecord() {
  const tr = trackRecordData;
  const tbody = document.querySelector("#tr-district-table tbody");
  if (tbody && tr.breakdown_by_district) {
    tbody.innerHTML = tr.breakdown_by_district.map((d) => `
      <tr>
        <td><strong>${d.district}</strong></td>
        <td>${d.total}</td>
        <td>${d.correct}</td>
        <td><strong style="color:#059669;">${d.hit_rate}%</strong></td>
      </tr>
    `).join("");
  }

  const container = document.getElementById("tr-outcomes-container");
  if (container && tr.recent_outcomes) {
    container.innerHTML = tr.recent_outcomes.map((o) => `
      <div class="outcome-card ${o.status.toLowerCase()}">
        <div class="outcome-top">
          <strong>${o.corridor}</strong>
          <span class="outcome-badge ${o.status.toLowerCase()}">${o.status}</span>
        </div>
        <div class="outcome-sub">Predicted: ${o.predicted} &bull; Actual: <strong>${o.actual}</strong></div>
        <div class="outcome-note">${o.note}</div>
      </div>
    `).join("");
  }
}

// 6. DECISION ACTION HANDLERS
window.handleApproveDecision = async (id) => {
  try {
    const res = await fetch(`${API_BASE}/decisions/${id}/approve`, { method: "POST" });
    if (res.ok) {
      const card = document.getElementById(`dec-card-${id}`);
      if (card) {
        card.style.border = "2px solid #059669";
        card.querySelector(".dec-card-actions").innerHTML = `
          <div class="approved-badge-status">✅ OFFICER APPROVED — Pre-Positioning Dispatch Initiated</div>
        `;
      }
      fetchAllData();
    }
  } catch (err) {
    alert("Approval error: " + err.message);
  }
};

window.handleOpenChangeModal = (id) => {
  const m = document.getElementById("modal-change-decision");
  document.getElementById("change-dec-id").value = id;
  if (m) m.classList.remove("hidden");
};

window.handleOpenRejectModal = (id) => {
  const m = document.getElementById("modal-reject-decision");
  document.getElementById("reject-dec-id").value = id;
  if (m) m.classList.remove("hidden");
};

window.handleViewEvidence = async (id) => {
  try {
    const res = await fetch(`${API_BASE}/habitations/${id}`);
    if (!res.ok) return;
    const h = await res.json();
    const content = document.getElementById("evidence-modal-content");
    if (!content) return;

    content.innerHTML = `
      <div class="evidence-grid">
        <div class="ev-box">
          <h4>VILLAGE & RISK PROFILE</h4>
          <div><strong>Village:</strong> ${h.name} (${h.id})</div>
          <div><strong>District:</strong> ${h.district_id} &bull; <strong>Pop:</strong> ${h.population.toLocaleString()}</div>
          <div><strong>VRI Score:</strong> <strong style="color:#d97706;">${h.vri_trajectory[0]?.vri || 62} / 100</strong></div>
          <div><strong>Cutoff Countdown:</strong> <strong style="color:#d9383a;">${h.countdown?.hours_until_cutoff || 38} Hours</strong></div>
          <div><strong>Model Confidence:</strong> ${(h.vri_trajectory[0]?.confidence * 100 || 84).toFixed(0)}%</div>
        </div>

        <div class="ev-box">
          <h4>METEOROLOGICAL & GEOLOGY DATA</h4>
          <div><strong>Precipitation (24h):</strong> 42.5 mm</div>
          <div><strong>Precipitation (72h):</strong> 118.2 mm</div>
          <div><strong>Forecast Rainfall (72h):</strong> 145.0 mm (Open-Meteo)</div>
          <div><strong>SlopeDeg:</strong> 28.5° (Copernicus DEM)</div>
          <div><strong>Landslide Class:</strong> HIGH (NASA COOLR Matched)</div>
        </div>

        <div class="ev-box">
          <h4>HOSPITAL MEDICAL EGRESS</h4>
          <div><strong>Travel Time NOW:</strong> ${h.egress?.travel_time_now_min || 25} min</div>
          <div><strong>Travel Time AFTER Cutoff:</strong> <strong style="color:#d9383a;">${h.egress?.travel_time_after_min || 145} min</strong></div>
          <div><strong>Egress Delay Impact:</strong> +${h.egress?.delta_min || 120} min</div>
        </div>

        <div class="ev-box">
          <h4>ROUTING & ACCESSIBILITY CORRIDOR</h4>
          <div><strong>Primary Route:</strong> NH-150 Kameng Sector</div>
          <div><strong>Alternative Route:</strong> State Highway 12 Alternate</div>
          <div><strong>Primary ETA:</strong> 3h 20m &bull; <strong>Alt ETA:</strong> 4h 02m</div>
          <div><strong>Delay Impact:</strong> +42 min alternate detour</div>
        </div>
      </div>
    `;

    const modal = document.getElementById("modal-view-evidence");
    if (modal) modal.classList.remove("hidden");
  } catch (err) {
    alert("Error fetching evidence: " + err.message);
  }
};

// 7. FLEET & DEPOTS RENDERERS
function renderFleetView() {
  const container = document.getElementById("fleet-cards-container");
  if (!container) return;

  container.innerHTML = vehiclesData.map((v) => `
    <div class="fleet-card-item">
      <div class="fleet-card-header">
        <strong>VEHICLE ${v.vehicle_id}</strong>
        <span class="status-pill ${v.status.toLowerCase()}">${v.status}</span>
      </div>
      <div class="fleet-card-body">
        <div>Depot: <strong>${v.depot_id}</strong></div>
        <div>Speed: <strong>${v.speed_kmh} km/h</strong></div>
        <div>GPS Updated: <strong>${new Date(v.updated_at).toLocaleTimeString()}</strong></div>
      </div>
    </div>
  `).join("");
}

function renderDepotsView() {
  const container = document.getElementById("depots-cards-container");
  if (!container) return;

  container.innerHTML = depotsData.map((d) => `
    <div class="depot-card-item">
      <div class="depot-card-header">
        <h3>${d.name}</h3>
        <span class="pill-prov real">REAL</span>
      </div>
      <div class="depot-card-body">
        <div><strong>Location:</strong> ${d.location}</div>
        <div class="depot-stock-grid">
          <div>🌾 Rice: <strong>${d.stock.rice_tonnes}t</strong></div>
          <div>💊 Medicines: <strong>${d.stock.medicines_units} units</strong></div>
          <div>💧 Water: <strong>${d.stock.water_liters}L</strong></div>
        </div>
        <div class="depot-fleet-row">Vehicles: ${d.vehicles_available} Available &bull; ${d.vehicles_in_transit} In Transit</div>
      </div>
    </div>
  `).join("");
}

function renderRoutesView() {
  const container = document.getElementById("routes-cards-container");
  if (!container) return;

  container.innerHTML = atRiskSegmentsData.slice(0, 6).map((s) => {
    const p = s.properties;
    return `
      <div class="route-card-item">
        <div class="route-card-header">
          <strong>CORRIDOR ${p.segment_id}</strong>
          <span class="status-pill ${p.closure_probability >= 0.35 ? 'danger' : 'warning'}">
            ${p.closure_probability >= 0.35 ? 'HIGH RISK' : 'MODERATE RISK'}
          </span>
        </div>
        <div class="route-card-body">
          <div>District: <strong>${p.district_id}</strong> &bull; Road Type: <strong>${p.road_type}</strong></div>
          <div>Slope: <strong>${p.slope_deg.toFixed(1)}°</strong> &bull; Landslide Class: <strong>${p.landslide_class}</strong></div>
          <div>Closure Prob: <strong style="color:#d9383a;">${(p.closure_probability * 100).toFixed(1)}%</strong></div>
        </div>
      </div>
    `;
  }).join("");
}

function renderActiveRisks() {
  const container = document.getElementById("active-risks-container");
  if (!container) return;

  const sampleRisks = [
    { title: "NH-150 Kameng Corridor", sub: "Landslide Risk • Kameng Sector", delay: "+120 min", pct: 87, color: "red" },
    { title: "Tawang High-Pass Corridor", sub: "Imminent Submersion • Tawang", delay: "+45 min", pct: 64, color: "amber" },
    { title: "Lohit River Route", sub: "Bridge Structural Wear • Lohit", delay: "+30 min", pct: 41, color: "amber" },
  ];

  container.innerHTML = sampleRisks.map((r) => `
    <div class="risk-item-card">
      <div class="risk-info">
        <div class="risk-title">${r.title}</div>
        <div class="risk-sub">${r.sub} • Delay: <strong>${r.delay}</strong></div>
      </div>
      <div class="risk-badge ${r.color}">${r.pct}%</div>
    </div>
  `).join("");
}

function renderDashboardTables() {
  const tbodyConn = document.querySelector("#table-connectivity tbody");
  if (tbodyConn) {
    tbodyConn.innerHTML = habitationsData.slice(0, 6).map((h) => {
      const p = h.properties;
      return `
        <tr>
          <td><strong>${p.name}</strong> (${p.id})</td>
          <td>${p.district_id}</td>
          <td><strong style="color:${p.vri < 30 ? '#d9383a' : p.vri < 70 ? '#d97706' : '#059669'}">${p.vri}</strong></td>
          <td>${p.hours_until_cutoff ? p.hours_until_cutoff + 'h' : 'None'}</td>
          <td>${p.travel_time_now_min}m &rarr; <strong>${p.travel_time_after_min}m</strong></td>
        </tr>
      `;
    }).join("");
  }

  const tbodyBot = document.querySelector("#table-bottlenecks tbody");
  if (tbodyBot) {
    tbodyBot.innerHTML = dispatchesData.slice(0, 6).map((d) => `
      <tr>
        <td><strong>${d.village_name || d.village_id}</strong></td>
        <td>${d.units_shipped}t Relief Rations</td>
        <td>${d.depot_name || d.depot_id}</td>
        <td><span style="font-size:0.75rem; font-weight:700; color:#2563eb;">${d.tier}</span></td>
      </tr>
    `).join("");
  }
}

function renderAuditLogs() {
  const container = document.getElementById("audit-cards-container");
  if (!container) return;
  container.innerHTML = auditData.map((a) => `
    <div class="audit-card">
      <div class="audit-card-header">
        <span class="action-tag">${a.action}</span>
        <span style="color:#8c8374; font-size:0.75rem;">${new Date(a.created_at).toLocaleString()}</span>
      </div>
      <div class="reasoning-text">${a.reasoning}</div>
    </div>
  `).join("");
}

function renderAlerts() {
  const container = document.getElementById("alerts-list-container");
  if (!container) return;
  container.innerHTML = alertsData.map((alt) => `
    <div class="alert-item ${alt.severity.toLowerCase()}">
      <div style="font-weight:700; font-size:0.9rem;">${alt.alert_type} — <span style="color:#d9383a;">${alt.severity}</span></div>
      <div style="font-size:0.8rem; color:#595349;">${alt.location} • ${alt.reason}</div>
      <div style="font-size:0.78rem; font-weight:600; color:#1c1a17;">👉 ${alt.recommended_action}</div>
    </div>
  `).join("");
}

function renderMapLayers() {
  if (!map) return;
  Object.values(villageMarkers).forEach((m) => map.removeLayer(m));
  segmentPolylines.forEach((l) => map.removeLayer(l));
  depotMarkers.forEach((d) => map.removeLayer(d));
  connectionLines.forEach((c) => map.removeLayer(c));

  villageMarkers = {};
  segmentPolylines = [];
  depotMarkers = [];
  connectionLines = [];

  // Render At-Risk Road Segments
  atRiskSegmentsData.forEach((seg) => {
    const coords = seg.geometry.coordinates.map((c) => [c[1], c[0]]);
    const prob = seg.properties.closure_probability;
    const color = prob >= 0.35 ? "#ff2a5f" : prob >= 0.25 ? "#ffb703" : "#00a8ff";

    const poly = L.polyline(coords, {
      color,
      weight: prob >= 0.35 ? 4 : 2.5,
      opacity: 0.85,
      dashArray: prob >= 0.35 ? '6, 6' : null
    }).addTo(map);
    segmentPolylines.push(poly);
  });

  // Render District Supply Depots (Glowing Blue Square Badges with 🏢 icon)
  const sampleDepots = [
    { id: "DEP_1", name: "Panigaon Central Hub", lat: 27.23, lon: 94.10 },
    { id: "DEP_2", name: "Niz Lakuk Depot", lat: 27.05, lon: 93.85 },
  ];

  sampleDepots.forEach((dep) => {
    const icon = L.divIcon({
      className: "marker-glow-container",
      html: `<div class="marker-depot" title="${dep.name}">🏢</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    const m = L.marker([dep.lat, dep.lon], { icon }).addTo(map);
    m.bindPopup(`
      <div style="font-family:'Plus Jakarta Sans',sans-serif; padding:4px;">
        <strong style="color:#00a8ff; font-size:0.95rem;">${dep.name}</strong><br>
        <span style="font-size:0.75rem; color:#64748b;">District Supply &amp; Pre-Positioning Hub</span>
      </div>
    `);
    depotMarkers.push(m);
  });

  // Render Habitations (Glowing Neon Circles matching image)
  habitationsData.forEach((h) => {
    const p = h.properties;
    const lat = h.geometry.coordinates[1];
    const lon = h.geometry.coordinates[0];

    let iconHtml = '';
    if (p.vri < 30) {
      iconHtml = `<div class="marker-cutoff" title="${p.name} (Cut-Off / Severe Risk)"><div class="marker-cutoff-core"></div></div>`;
    } else if (p.vri < 70) {
      iconHtml = `<div class="marker-moderate" title="${p.name} (Moderate Risk)"><div class="marker-moderate-core"></div></div>`;
    } else {
      iconHtml = `<div class="marker-high" title="${p.name} (High Reachability)"><div class="marker-high-core"></div></div>`;
    }

    const icon = L.divIcon({
      className: "marker-glow-container",
      html: iconHtml,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    const marker = L.marker([lat, lon], { icon }).addTo(map);

    // Draw connecting dotted network line from nearest depot to village
    if (sampleDepots.length > 0) {
      const nearestDep = sampleDepots[0];
      const conn = L.polyline([[nearestDep.lat, nearestDep.lon], [lat, lon]], {
        color: '#00a8ff',
        weight: 1.5,
        opacity: 0.4,
        dashArray: '3, 6'
      }).addTo(map);
      connectionLines.push(conn);
    }

    const statusText = p.vri < 30 ? "Cut-Off / Severe Risk (VRI < 30)" : p.vri < 70 ? "Moderate Risk (30 ≤ VRI < 70)" : "High Reachability (VRI ≥ 70)";
    const color = p.vri < 30 ? "#ff2a5f" : p.vri < 70 ? "#ffb703" : "#00f098";

    marker.bindPopup(`
      <div style="font-family:'Plus Jakarta Sans',sans-serif; padding:4px;">
        <strong style="color:#1c1a17; font-size:0.95rem;">${p.name}</strong><br>
        VRI Index: <strong style="color:${color}">${p.vri} / 100</strong><br>
        Status: <strong style="color:${color}">${statusText}</strong><br>
        District: ${p.district_id || 'North Lakhimpur'}
      </div>
    `);

    villageMarkers[p.id] = marker;
  });
}

function bindEvents() {
  const brandHome = document.getElementById("brand-home-click");
  if (brandHome) brandHome.addEventListener("click", () => { window.location.hash = "#/entry"; });

  const dayChips = document.querySelectorAll(".forecast-day-chip");
  dayChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      dayChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
    });
  });

  const entryBtn = document.getElementById("btn-entry-field-report");
  if (entryBtn) entryBtn.addEventListener("click", () => {
    const modal = document.getElementById("modal-field-report");
    if (modal) modal.classList.remove("hidden");
  });

  const changeForm = document.getElementById("form-change-decision");
  if (changeForm) {
    changeForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("change-dec-id").value;
      const payload = {
        units: parseFloat(document.getElementById("change-quantity").value),
        depot: document.getElementById("change-depot").value,
        route: document.getElementById("change-route").value,
        deadline: document.getElementById("change-deadline").value,
      };

      try {
        const res = await fetch(`${API_BASE}/decisions/${id}/change`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
        });
        if (res.ok) {
          alert("Decision modifications confirmed & written to audit trail!");
          document.getElementById("modal-change-decision").classList.add("hidden");
          fetchAllData();
        }
      } catch (err) {
        alert("Error modifying decision: " + err.message);
      }
    });
  }

  const rejectForm = document.getElementById("form-reject-decision");
  if (rejectForm) {
    rejectForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("reject-dec-id").value;
      const payload = {
        reason_category: document.getElementById("reject-reason-cat").value,
        free_text: document.getElementById("reject-free-text").value,
      };

      try {
        const res = await fetch(`${API_BASE}/decisions/${id}/reject`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
        });
        if (res.ok) {
          alert("Rejection reason captured & logged for model evaluation!");
          document.getElementById("modal-reject-decision").classList.add("hidden");
          fetchAllData();
        }
      } catch (err) {
        alert("Error logging rejection: " + err.message);
      }
    });
  }

  const copilotForm = document.getElementById("copilot-form");
  if (copilotForm) {
    copilotForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("copilot-input");
      if (input && input.value) {
        askCopilot(input.value);
        input.value = "";
      }
    });
  }

  document.querySelectorAll(".copilot-btn-suggest").forEach((btn) => {
    btn.addEventListener("click", () => {
      askCopilot(btn.dataset.q);
    });
  });

  ["evidence", "change", "reject", "report", "shipment"].forEach((name) => {
    const btn = document.getElementById(`btn-close-${name}`);
    const footBtn = document.getElementById(`btn-shipment-close-foot`);
    const cancel = document.getElementById(`btn-cancel-${name}`);
    const modal = document.getElementById(`modal-${name === 'report' ? 'field-report' : name === 'evidence' ? 'view-evidence' : name === 'shipment' ? 'shipment-detail' : name + '-decision'}`);
    if (btn && modal) btn.addEventListener("click", () => modal.classList.add("hidden"));
    if (footBtn && modal) footBtn.addEventListener("click", () => modal.classList.add("hidden"));
    if (cancel && modal) cancel.addEventListener("click", () => modal.classList.add("hidden"));
  });

  const formReport = document.getElementById("form-field-report");
  if (formReport) {
    formReport.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        uuid: "FR_" + Date.now(),
        reporter_name: document.getElementById("rep-name").value,
        location_name: document.getElementById("rep-location").value,
        incident_type: document.getElementById("rep-type").value,
        severity: document.getElementById("rep-severity").value,
        description: document.getElementById("rep-desc").value,
        timestamp: new Date().toISOString(),
      };

      if (!navigator.onLine) {
        saveOfflineReport(payload);
        alert("Saved offline. Will sync automatically when connectivity returns.");
        document.getElementById("modal-field-report").classList.add("hidden");
        formReport.reset();
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/field-reports`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
        });
        if (res.ok) {
          alert("Field report submitted successfully to DHARA PostGIS audit trail!");
          document.getElementById("modal-field-report").classList.add("hidden");
          formReport.reset();
          fetchAllData();
        }
      } catch (err) {
        saveOfflineReport(payload);
        alert("Saved offline. Will sync automatically when connectivity returns.");
        document.getElementById("modal-field-report").classList.add("hidden");
      }
    });
  }
}

function askCopilot(question) {
  const box = document.getElementById("copilot-chat-box");
  if (!box) return;

  const userMsg = document.createElement("div");
  userMsg.className = "copilot-msg user";
  userMsg.innerHTML = `<div class="msg-bubble">${question}</div>`;
  box.appendChild(userMsg);

  let replyText = "I don't have enough verified data to answer that.";
  const q = question.toLowerCase();

  if (q.includes("action today") || q.includes("today")) {
    replyText = "DHARA Decision Engine recommends 3 urgent pre-positioning dispatches today: Rāmthenga (12t rice), Ukhrul Sector (15t rations), and Tawang Link (8t medical kits).";
  } else if (q.includes("ukhrul")) {
    replyText = "Ukhrul is classified as HIGH RISK due to 118.2mm accumulated 72h rainfall, 28.5° Copernicus slope profile, and predicted NH-150 closure probability of 0.38 within 38 hours.";
  } else if (q.includes("48 hours") || q.includes("lose access")) {
    replyText = "Currently, 3 habitations (Rāmthenga, Ukhrul Sector, Kameng Village) are predicted to cross the VRI accessibility cutoff threshold within the 48-hour horizon.";
  } else if (q.includes("12t rice") || q.includes("recommend")) {
    replyText = "DHARA recommended 12t rice to Rāmthenga because predicted closure of NH-150 will isolate 1,450 residents for an estimated 4.5 days, exceeding local stock reserves.";
  }

  setTimeout(() => {
    const botMsg = document.createElement("div");
    botMsg.className = "copilot-msg bot";
    botMsg.innerHTML = `
      <img src="logo.png" alt="DHARA Logo" class="chat-avatar">
      <div class="msg-bubble">${replyText}</div>
    `;
    box.appendChild(botMsg);
    box.scrollTop = box.scrollHeight;
  }, 400);
}

function saveOfflineReport(report) {
  if (!dbPromise) return;
  const tx = dbPromise.transaction("queued_reports", "readwrite");
  tx.objectStore("queued_reports").put(report);
}

function syncOfflineReports() {
  if (!dbPromise || !navigator.onLine) return;
  const tx = dbPromise.transaction("queued_reports", "readwrite");
  const store = tx.objectStore("queued_reports");
  const req = store.getAll();
  req.onsuccess = () => {
    const reports = req.result;
    reports.forEach(async (r) => {
      try {
        const res = await fetch(`${API_BASE}/field-reports`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r)
        });
        if (res.ok) {
          const delTx = dbPromise.transaction("queued_reports", "readwrite");
          delTx.objectStore("queued_reports").delete(r.uuid);
        }
      } catch (e) {}
    });
  };
}

window.addEventListener("online", syncOfflineReports);
