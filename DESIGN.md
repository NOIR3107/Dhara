# DHARA — Design System & UI/UX Architecture Specification

> **Project**: DHARA (Disruption & Hazard-Aware Reachability Automation)  
> **Problem Statement**: SIH26002 — Disaster Accessibility & Relief Logistics  
> **Nodal Ministry**: Ministry of Development of North Eastern Region (MDoNER)  
> **Target Region**: North-East India (735 Districts, 3,660 Habitations, 220 Strategic Corridors)  
> **Version**: 2.5 (PostGIS 3.4 + Fastify + ML Engine)

---

## 1. Executive Summary & Operational Mandate

DHARA is a critical government emergency-management command platform engineered for district logistics officers, state disaster authorities, and field responders in North-East India. 

Unlike consumer products or generic SaaS dashboards, DHARA operates under a strict **operational-first mandate**:

$$\text{HABITATION} \longrightarrow \text{VRI RISK} \longrightarrow \text{CUTOFF COUNTDOWN} \longrightarrow \text{AUTONOMOUS DISPATCH}$$

### Core Design Rules
1. **Action-First Hierarchy**: The interface immediately answers *"Which habitations are about to be cut off?"* and *"What relief supplies must move now?"*
2. **Data Provenance Transparency**: Every data point explicitly displays its source tier (`REAL`, `DERIVED`, or `SIMULATED`).
3. **Verbatim Plain-English Reasoning**: Autonomous decision engine outputs carry un-truncated audit reasoning chains explaining the *why* behind every pre-positioning dispatch.
4. **Mobile & Low-Bandwidth Priority**: Designed for one-handed operation on Android smartphones in low-network disaster zones (minimum 48px touch targets).

---

## 2. Design System Tokens & Aesthetics

The visual language follows a **high-contrast tactical dark theme** built for clarity under high-stress command room lighting and outdoor sunlight.

### 2.1 Color System

```css
:root {
  /* Surface Colors */
  --bg-dark: #090d16;             /* Base viewport background */
  --bg-surface: #101726;          /* Card & container background */
  --bg-surface-elevated: #162033; /* Interactive card & popover background */
  --bg-glass: rgba(16, 23, 38, 0.88); /* Map overlay glassmorphism */

  /* Border & Divider Tokens */
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-active: rgba(56, 189, 248, 0.4);
  --border-danger: rgba(244, 63, 94, 0.4);

  /* Primary Typography Colors */
  --text-primary: #f8fafc;   /* 100% Contrast headers */
  --text-secondary: #94a3b8; /* Subtitles & labels */
  --text-muted: #64748b;     /* Metadata & captions */

  /* Operational Accent & Status Palette */
  --accent-cyan: #38bdf8;     /* Primary interactive highlights & links */
  --accent-blue: #2563eb;     /* Primary action buttons */
  --accent-indigo: #6366f1;   /* Tactical badges */
  --accent-emerald: #10b981;  /* High Reachability / VRI ≥ 70 */
  --accent-amber: #f59e0b;    /* Moderate Risk / 30 ≤ VRI < 70 */
  --accent-rose: #f43f5e;     /* Imminent Cutoff / VRI < 30 */
}
```

### 2.2 Data Provenance Palette

| Provenance Tag | Background Color | Text Color | Border Color | Meaning |
|----------------|------------------|------------|--------------|---------|
| `REAL` | `rgba(16, 185, 129, 0.15)` | `#34d399` | `1px solid rgba(16, 185, 129, 0.3)` | PostGIS / OSM / Open-Meteo real data |
| `DERIVED` | `rgba(56, 189, 248, 0.15)` | `#38bdf8` | `1px solid rgba(56, 189, 248, 0.3)` | ML Closure Model & VRI Index |
| `SIMULATED` | `rgba(245, 158, 11, 0.15)` | `#fbbf24` | `1px solid rgba(245, 158, 11, 0.3)` | Vehicle Telemetry & Relief Hubs |

### 2.3 Typography Scale

- **Display & Headings**: `Outfit` (Sans-Serif, 700/800 weight) — Used for hero titles, section headers, and dominant countdown metrics.
- **Body & Controls**: `Inter` (Sans-Serif, 400/500/600 weight) — Used for card text, tables, forms, and general UI.
- **Monospace Metrics**: `JetBrains Mono` (Monospace, 500/600 weight) — Used for VRI scores, timestamps, coordinates, and system logs.

---

## 3. Information Architecture & Navigation Wireframe

The application uses a **Single Page Application (SPA) Hash Router**:

```
                              DHARA ENTRY PAGE (/#)
                              [Role Selection View]
                                   /        \
                                  /          \
  OFFICER COMMAND CENTRE (/#/officer)      FIELD INCIDENT REPORT (/#/field-report)
  ├── 1. District Connectivity Status       ├── GPS Auto-Location
  ├── 2. Logistics Bottlenecks             ├── Incident Type (Landslide/Flood/Bridge)
  ├── 3. Emergency Routes                  ├── Severity Selection (Critical/High/Medium)
  ├── 4. Real-Time Delivery Status         ├── Ground Truth Description
  ├── Interactive Map & Forecast Scrubber  └── Audit Engine Log Sync
  ├── Cutoff Countdown & Egress Panel
  └── Autonomous Decisions Audit Trail
```

---

## 4. Layout Specifications & Screen Components

### 4.1 Entry & Role Selection Page (`/#`)

Designed to answer *"What do I need to do?"* within 3 seconds of page load.

#### Header Block
- Brand: **DHARA v2.5** | *Disruption & Hazard-Aware Reachability Automation*
- Region Badge: `NER ACCESSIBILITY INTELLIGENCE`
- Multilingual Selector: `English` | `हिंदी` | `অসমীয়া` | `বাংলা` | `মৈতৈলোন্`

#### Hero Heading
- Title: **North East Region Accessibility Command Centre**
- Subtitle: *Monitor connectivity, anticipate disruptions, coordinate essential supplies, and report incidents from the field.*

#### Primary Action Cards Grid (2-Column Desktop / 1-Column Mobile)

```
+------------------------------------------+  +------------------------------------------+
| 📊 OFFICER DASHBOARD                     |  | 📝 FIELD INCIDENT REPORT                 |
| Monitor & coordinate regional access    |  | Report what you see                      |
|                                          |  |                                          |
| View village reachability, disruption    |  | Submit a geo-tagged incident, road       |
| forecasts, supply risks and decisions.   |  | blockage or disaster observation.        |
|                                          |  |                                          |
| • District Connectivity                  |  | • GPS Location    • Severity             |
| • Village Risk & VRI                     |  | • Incident Type   • Evidence             |
| • Cut-off Countdown                      |  | • Offline Sync    • Audit Trail          |
|                                          |  |                                          |
| [ OPEN OFFICER DASHBOARD → ]             |  | [ SUBMIT FIELD REPORT → ]                |
| Regional monitoring & decision centre    |  | Designed for low-network conditions      |
+------------------------------------------+  +------------------------------------------+
```

#### Compact Live System Status Block
Queries live `GET /health` API endpoint:
- `● Prediction Engine — Operational`
- `● Accessibility Intelligence — Operational`
- `● Field Reporting — Operational`
- `● Data Sync — Operational`

#### Quick Situational Summary KPI Grid
Queries live `GET /coverage`, `/habitations`, `/dispatches` API endpoints:
- **Villages Monitored**: `3,660` (Real GeoNames habitations)
- **At-Risk Villages**: `0` (`VRI < 70`)
- **Cut Off Within 48h**: `0` (`Countdown ≤ 48h`)
- **Active Dispatches**: `25` (Module 7 Decision Agent)

---

### 4.2 Officer Command Centre (`/#/officer`)

Contains the **4 Mandated Stakeholder Dashboard Sections**:

```
+-----------------------------------------------------------------------------------------+
| 📌 1. District Connectivity Status       | 🚚 2. Logistics Bottlenecks & Supply Gaps     |
| 3,660 Habitations | 0 Cutoff | 66.7 VRI  | 25 Active Dispatches | 300t Cargo | 0 Shortfall|
| [Table: Habitation, District, VRI, Egress] | [Table: Destination, Cargo, Depot, Tier, Reason]|
+------------------------------------------+----------------------------------------------+
| 🛣️ 3. Emergency Accessibility Routes     | 🛰️ 4. Real-Time Delivery Status              |
| 220 Corridors | 0 At-Risk | 100% Coverage| 4 Telemetry Vehicles | 38 km/h | SIMULATED   |
| [Table: Corridor ID, Slope, Closure Prob]| [Table: Vehicle ID, Depot, Speed, Status]    |
+-----------------------------------------------------------------------------------------+
```

---

### 4.3 Interactive Map & Diagnostics Sidebar

- **Map Engine**: Leaflet dark-theme base tiles with PostGIS GeoJSON overlays (`road_segments`, `habitations`, `simulated_telemetry`).
- **7-Day Forecast Scrubber**: Range slider (`D+0` to `D+6`) dynamically recalculating VRI scores across dates `2026-08-24` to `2026-08-30`.
- **Visually Dominant Cutoff Countdown**:
  ```
  +---------------------------------------------------+
  | STATUS & CUTOFF COUNTDOWN                         |
  |                                                   |
  |     CUT OFF IN 48 HOURS                           |
  |                                                   |
  | Predicted Crossing: Stable in Operational Horizon |
  +---------------------------------------------------+
  ```
- **Emergency Egress Comparison**:
  - `Travel Time NOW`: **25 min**
  - `AFTER Predicted Closure`: **145 min**
  - `Delay Impact`: **+120 min** (*Alternate Route Egress*)

---

### 4.4 Autonomous Decision Agent & Audit Log

Every automated pre-positioning decision is stored in `dispatch_decisions` and `audit_logs` with a plain-English reasoning string:

```
+-----------------------------------------------------------------------------------------+
| DISPATCH_hab_1258551                                      2026-08-24 05:14:17 IST       |
|                                                                                         |
| Reasoning: Pre-positioned 12t ration packs to Rāmthenga (hab_1258551). Reason: predicted  |
| road closure probability 0.31 within 48 hours; VRI projected at 63.5; alternate route   |
| adds 0.0 hours. Confidence 0.85. Tier: notified / 2-hour officer override.              |
|                                                                                         |
| Confidence: 85%                                              [DERIVED AUTOMATION]       |
+-----------------------------------------------------------------------------------------+
```

---

## 5. API Data Flow & Database Integration Architecture

```
[ Open-Meteo Live API ] ──> [ ingest/ingest_weather_forecasts.py ]
                                         │
                                         ▼
                             [ PostgreSQL 16 + PostGIS 3.4 ]
                             ├── habitations (3,660)
                             ├── road_segments (220)
                             ├── weather_forecasts (1,540)
                             ├── disruption_forecasts (1,540)
                             ├── vri_forecasts (25,620)
                             ├── dispatch_decisions (25)
                             └── audit_logs (25)
                                         │
                                         ▼
                            [ Fastify Node.js API (Port 3001) ]
                            ├── GET /health
                            ├── GET /habitations
                            ├── GET /forecast
                            ├── GET /segments/at-risk
                            ├── GET /dispatches
                            ├── GET /alerts
                            ├── GET /coverage
                            └── POST /field-reports
                                         │
                                         ▼
                            [ DHARA Web App (Port 8080) ]
```

---

## 6. Mobile Responsiveness Guidelines

1. **Touch Targets**: All action buttons (`btn-primary-action`, `btn-secondary-action`, `tab-btn`, `mobile-nav-btn`) enforce a minimum height of **48px** for easy single-tap execution on mobile screens.
2. **Layout Breakpoints**:
   - `Desktop (> 900px)`: 2-column action cards grid, side-by-side map and detail sidebar.
   - `Tablet & Mobile (≤ 900px)`: Single column vertical stack, bottom navigation bar (`📊 Dashboard`, `🗺️ Map`, `🛡️ Audit`, `⚠️ Alerts`), 45vh collapsible detail drawer.
3. **No Horizontal Scroll**: All tables use horizontal scroll containers (`.table-scroll`), keeping the main page viewport fixed at 100vw.
