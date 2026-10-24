# Relay4 React Frontend

Admin-only internal emergency intake and coordination portal for Louisiana. Geeks From SLU — Team 404. The current data workspace is an explicitly labeled Admin simulation.

## Team and project documentation

Built for Louisiana by **Geeks From SLU — Team 404**. This React, Vite, and TypeScript frontend runs separately from the FastAPI backend.

- [Project overview and team split](../README.md): voice agent/caller experience, backend records and permissions, dispatcher dashboard and assignments, responder experience and testing/demo.
- [Shared architecture](../docs/architecture.md): voice intake → backend incident and source evidence → dispatcher review → corrections → human-approved assignment → responder acknowledgement.
- [Backend setup and current API behavior](../backend/README.md): FastAPI, persistence, ElevenLabs intake, and authenticated writes.
- [Frontend API handoff](API-CONTRACT.md): proposed frontend domain shapes, GIS context, multi-unit approvals, and integration requirements. These shapes are not assumed to match the current backend endpoints.

This website contains admin tools only. Caller-facing intake and teammate-owned responder clients are outside this portal. There is no public signup, caller-access entry or production-role picker.

The backend must be the source of truth for incident facts, assignment status, corrections, and permissions when the services are connected. The current frontend uses an explicit simulation adapter and in-memory state; it does not yet read or write the backend. Keep voice/API integration and authentication in the agreed service boundary, and preserve dispatcher approval for assignments.

## Start locally

Requires Node.js 22 or newer and npm.

```sh
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The entry point is **Admin sign-in** (`/#/sign-in`); choose **Enter Admin simulation** for synthetic data. Live sign-in is marked unconnected. Vite prints the actual port if 5173 is occupied.

The included [.env.example](.env.example) documents prospective `API_BASE_URL` and `REALTIME_URL` settings. They are placeholders for integration, not settings consumed by the current simulation adapter; copying this file to `.env` does not enable backend access. No `.env` or keys are needed for the demo. Keep secret `.env` files ignored, and never put admin or webhook secrets into browser code. See the backend README for running the separate service.

```sh
npm run build
npm test
npm run preview
```

Browser workflow checks (first install the test browser):

```sh
npx playwright install chromium
npm run test:e2e
```

Preview serves the production build at http://localhost:4173 by default.

## Screens and interaction

Hash routes work without server rewrite rules: `/#/home`, `/#/map`, `/#/incidents/R4-001`, `/#/calls`, `/#/responders`, `/#/activity`, and `/#/sign-in`. The legacy `/#/responder` fragment redirects to admin responder management.

- Home: compact queue (up to three reports), search, pending actions, selected summary, and a link to the full Map page.
- Map: category/tag filters, incident list synchronized with markers and side panel, fit visible incidents, collapsible context layers, and a legend.
- Incident details: review evidence, correct facts with a required reason, review call links, select an unassigned unit, and explicitly approve its assignment.
- Calls: full synthetic transcripts, incident filter, search, and incident links.
- Responders: admin unit/assignment management, approval identities, acknowledgement status and assignment review with latest incident facts/maps.
- Activity: corrections, call-link reviews, approvals, and acknowledgement history.
- Admin assignment review: inspect a unit from Responders or Incident Details. Only Admin simulation offers **Demo: simulate acknowledgement**; this records demo receipt and never means en route. A live admin would inspect receipt status rather than impersonate a responder.

All simulation changes share in-memory state across screens. Reload resets to the sample snapshot. Search is global and applies to the current screen's records; clear it using the search field's clear button. Incident filters and call filters are independent. No backend is called. The shared interactive map reads incident coordinates supplied by the simulation adapter; see the map behavior below.

## Admin access and integration boundary

`src/auth/adminAuth.ts` defines the replaceable AdminAuthAdapter: `getAdminSession`, `signInAdmin`, `enterAdminSimulation` and `signOut`. There was no existing frontend authentication implementation. The teammate's backend currently documents admin-key checks for manual writes, not a browser admin-session/sign-in contract; that backend code is untouched. No key-entry form, browser admin secret, guessed login endpoint or production-role selector is introduced.

The default adapter enables only the labeled Admin simulation. A tab-scoped `relay4.admin-simulation` flag remembers that demo choice across reloads; it never represents a production identity or token. Exiting the simulation clears it and unmounts the workspace. Unknown local role/token values are not consumed. Simulation data remains bundled client-side and is not confidential.

The frontend route gate is **navigation UX, not real authentication or security**. For live integration, the backend must authenticate the user, validate admin authorization on every read/write/command, reject non-admins and expired/revoked sessions, and supply trusted actor/audit information. Only a server-backed adapter may return an actual admin session. Enabling a button or editing client state cannot grant server permissions. See [API-CONTRACT.md](API-CONTRACT.md).

The earlier scaffold's caller intake and standalone responder screen ideas remain the relevant teammates' separate responsibility. This portal preserves caller evidence as an admin tool and provides no public caller/responder role switching.

## Interactive maps

Home, Incident Details, and admin assignment review share `src/components/IncidentMap.tsx`. Use +/−, wheel zoom, dragging, touch pinch, arrow-key panning, Recenter, or the expanded map dialog. Escape closes expansion and returns focus to its button. Selecting an incident recenters the map; browsing does not alter its facts. The expanded dispatcher map also has an incident selector. The admin assignment-review map stays on the reviewed unit’s assigned incident. The dedicated Map page reuses the same component, with category icons, fit-to-visible, a synchronized list and panel, and context overlays. Category chips match primary category or secondary tags. Fit excludes unknown incident positions and context geometry.

R4-001 and the new collision, medical, and weather scenarios use explicitly labeled simulated positions, not verified real places. Reports without supplied coordinates show “Exact location unknown” with a Louisiana regional view and no pin for that incident. Only incidents with valid provided coordinates get markers; any other markers in a regional view retain their own incident ID and provenance. Popups show ID, location, status, and coordinate provenance. Location/detail text corrections clear stale coordinates pending review; other corrections preserve coordinates. There is no geocoding, GPS request, tracking, polling, or simulated movement.

The base map uses `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with visible © OpenStreetMap contributors attribution and a report-issue link. Provider settings are isolated in `src/mapConfig.ts`. The browser sends its normal User-Agent and Referer and honors standard HTTP caching. The map requests viewport tiles only (`keepBuffer: 0`, idle updates); there is no tile prefetch, bulk/offline download, proxy, or cache bypass. If hosting later, preserve browser Referer and caching behavior. For more traffic, choose a provider with appropriate capacity and terms. See the [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/).

If tiles fail or take too long, location details remain visible with a connection message and an explicit retry button. This demo does not offer offline mapping. Automated browser tests intercept tile requests with local synthetic fixtures and never run gesture tests against OSM's community tile servers.

## GIS demo and integration limits

R4-004 is a synthetic collision with reported fuel leakage and smoke. It is tagged Accident + Fire hazard and appears in both filters. Open it from Map, approve Engine 07 for fire and EMS 09 for medical response separately, then inspect each unit in admin assignment review. In Admin simulation, use the explicitly labeled demo action to simulate each acknowledgement. Approval and receipt stay independent and update Map, Home, Details, Responders, and Activity. A unit cannot be assigned twice, but an incident can have multiple units. No unassigned unit is presented as an available resource.

Layers include reported blockages, assigned response units, fire hazards, fire units, assigned EMS, fictional hospital locations, synthetic weather alerts/flood-risk polygons, and reported demo closures. Unit/hazard overlays derive from shared records. Other context arrives through the API adapter. Layer toggles are independent of incident filters. Every added overlay has source/timestamp metadata and synthetic labeling. The live alert connection is explicitly unavailable; no official feed is fabricated. Unknown-position records stay readable in Layers without map geometry. Empty/unavailable layers do not disable the base map.

Only OpenStreetMap tiles are externally connected. Backend incident data, authenticated multi-unit approvals, authoritative unit positions, hospital data, weather alerts, flood models, closure sources, durable audit and synchronization still require the teammate's backend integration. There is no live GPS, resource-availability inference, severity scoring, or route/safety guidance. See the proposed API handoff for the new fields and cardinality.

## Response presets and map styles

The Map page has independent **Map style**, **Response preset**, and **incident category filter** controls. Presets do not filter incidents: the Accident + Fire hazard collision remains in both relevant category filters, regardless of the chosen response preset.

| Preset | Default context layers | Focus |
| --- | --- | --- |
| Overview | None; enable optional context manually | All supplied incident positions |
| Fire | Building entrances, hydrants, reported fire hazards, fire units | Fire reports (including secondary fire tags) and enabled context |
| Accident | Reported road blockages, vehicle locations, assigned response units | Accident reports and enabled context |
| Medical | Medical access points, EMS units, hospital locations | Medical reports and enabled context |
| Weather | Available weather-alert polygons, waterways, flood-risk zones | Weather/flood reports and enabled context |

The contextual panel explains each preset and its unknown facts. The legend lists currently mapped incident categories and only enabled, ready context layers with valid geometry, using the same colors/shapes as the overlays. Every layer shows its source and source timestamp. Additional entrances, hydrants, vehicle positions, medical access points and waterways are **synthetic training fixtures** loaded through the existing adapter. Hydrant existence/serviceability/flow/pressure, access suitability, hospital capabilities/receiving status, resource availability and actual hazard boundaries remain Unknown. No point is presented as a live position.

Selecting a preset explicitly fits its relevant supplied incident/context positions. Recenter recalculates that preset extent from current data. No coordinates means a Louisiana regional view, never an invented incident pin. Afterward, panning, zooming, category filters, source/data updates and layer changes preserve the camera. Explicit incident selection can pan to a supplied position without changing zoom; Fit visible incidents is a separate explicit map action. Each preset remembers its layer overrides, and Reset preset layers resets only those layers. Preset, category, style, layer choices and camera survive route navigation during the session. Expansion/closing preserves the camera; reloading resets the simulation and view preferences.

Layer cards support Loading, Empty, Location unknown, Unavailable and Error states. Only ready, valid geometry is drawn. Errors offer an explicit adapter retry; source failures never change incident facts or automatically replay preset zoom. `simulationApi.reloadContextLayer` reloads local fixtures today and is the seam for a future agreed backend context service.

Streets reuses the existing OpenStreetMap raster source and visible contributor attribution. **Satellite and Terrain are labeled unavailable** because the frontend has no configured, licensed provider/attribution terms or credentials for them. They are disabled choices, not alternative names for Streets. No imagery provider or key was added. See [MAP-PROVIDERS.md](MAP-PROVIDERS.md) for the provider review and browser validation scope.

## Structure

The scaffold's separation of reusable UI, screens, service clients, types, and assets is retained. Current implementation files are shown below; the `screens/`, `services/`, `types/`, and `tests/` directories contain incoming placeholders for future organization, not a second data model or active API client.

```text
frontend/
├── src/
│   ├── App.tsx          # Navigation, dispatcher/responder screens, shared state
│   ├── components/      # Reusable UI, GIS workspace, map and overlays
│   ├── screens/         # Reserved admin screen modules
│   ├── services/        # Reserved backend API and realtime clients
│   ├── types/           # Reserved type modules; current contract is types.ts
│   ├── types.ts         # Shared frontend domain types
│   ├── api.ts           # Current simulation adapter; future service boundary
│   ├── mockData.ts      # Synthetic scenario data
│   └── assets/          # Local SVG assets and source/license documentation
├── public/              # Static files served as-is
├── e2e/                 # Active browser workflow and map tests
├── tests/               # Incoming test scaffold; current unit tests are in src/
├── .env.example         # Prospective service settings, no secrets
├── API-CONTRACT.md      # Backend teammate handoff
└── README.md
```


`src/auth/adminAuth.ts`: replaceable admin-entry adapter. `src/auth/AdminPortal.tsx`: sign-in entry and frontend navigation gate. `src/types.ts`: shared domain types. `src/mockData.ts`: synthetic scenarios. `src/api.ts`: replaceable data adapter. `src/state.ts`: simulation commands. `src/coordinates.ts`: coordinate validation. `src/components/IncidentMap.tsx`: shared map. `src/components/GisMapPage.tsx`: full GIS workspace. `src/components/ContextOverlays.tsx`: context geometry. `src/gis.ts`: taxonomy, assignment summaries, and derived layers. `src/mapConfig.ts`: provider/style availability and regional defaults. `src/responsePresets.ts`: presentation-only preset definitions and extent calculation. `src/responseFixtures.ts`: synthetic operational context. `src/components/MapViewportController.tsx`: explicit GIS camera commands and restoration. `src/App.tsx`: reusable panels, forms, navigation, and screens. `src/styles.css`: responsive styles. See [API-CONTRACT.md](API-CONTRACT.md) for the proposed backend handoff.

The browser may request optional Google Fonts; system sans-serif is the fallback. No secrets are required.
