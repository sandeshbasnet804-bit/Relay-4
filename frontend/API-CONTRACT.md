# Backend handoff — proposed data shapes

These are frontend domain shapes, **not agreed endpoint contracts**. No backend paths, authentication schemes, ElevenLabs calls, or DeepSpace calls are assumed. `src/types.ts` is the complete TypeScript contract. `src/api.ts` normalizes the synthetic snapshot; replace it when the transport is agreed. No keys belong in this frontend.

The OpenStreetMap base tiles are the existing external integration. The frontend has no connected incident, unit-location, hospital, flood-risk, or weather-alert service. Added context is explicitly synthetic, and the live-alert connection is marked unavailable. Loading the demo never sends a backend request. Reload resets the in-memory state.

## Incident extensions

```ts
type IncidentCategory = 'accident' | 'fire' | 'medical' | 'flood' | 'weather' | 'other';
type UnitDiscipline = 'fire' | 'ems' | 'rescue' | 'support';
type Coordinates = {
  latitude: number; // finite, [-90, 90]
  longitude: number; // finite, [-180, 180]
  source: 'simulated' | 'reported';
};
type Incident = {
  id: string;
  title: string;
  category: IncidentCategory; // primary incident type, not severity
  tags: (IncidentCategory | 'road-blockage')[]; // independently reviewed labels
  hazards: string; // caller-reported facts, not inferred from category/tags
  responseNeeds: UnitDiscipline[]; // scenario planning needs, not dispatch authorization
  location: string;
  detail: string;
  people: string;
  injuries: string;
  coordinates: Coordinates | null;
  callIds: string[];
  status: 'Needs review' | 'Location updated' | 'Assigned'; // existing coarse queue state
  source: string;
  reportedAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
};
```

Category, reported hazards, and assignment receipt are separate. The legacy `status` field is preserved for the existing queue. Detailed assignment status is derived from actual Assignment records, including approved-unit and acknowledged-receipt counts. A Fire filter matches a primary fire or a secondary `fire` tag. R4-004 is an Accident with a Fire hazard tag; changing hazard text does not silently reclassify it. Taxonomy/tag edits would need an explicit reviewed operation from the backend.

Missing facts remain `Unknown`. `src/coordinates.ts` accepts only finite numeric coordinates with recognized provenance; invalid/missing coordinates become `null`. R4-002 and R4-003 have no coordinates. R4-001 and the new R4-004/005/006 demo records have clearly labeled simulated positions; they are not verified real locations. No severity or confidence is inferred.

Changed location/detail text clears stale coordinates to null and records the action. Hazard, people, and injury corrections preserve coordinates and update the incident timestamp. No geocoding, dragging of incident pins, route inference, GPS, polling, or simulated movement is implemented. Map camera state never becomes incident data.

## Units and multiple assignments

```ts
type Unit = {
  id: string; name: string; capability: string;
  discipline: UnitDiscipline;
  coordinates: Coordinates | null; // only a supplied position, never inferred from incident
  source: string;
  updatedAt: string;
};
type Assignment = {
  id: string; incidentId: string; unitId: string;
  approvedBy: string;
  approvedAt: string;
  source: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
};
```

An incident can have multiple separately approved assignments. A unit can have only one active assignment in this demo. The collision starts with Fire and EMS approval pending; the dispatcher can approve Engine 07 and EMS 09 separately using the existing confirmation checkbox. Each acknowledgement updates only that assignment, not the other responder's receipt. Receipt is not en route, arrival, capability, or resource availability. Fire/EMS unit sample positions are static and labeled simulated; unit availability stays Unknown even if there is no assignment.

The backend should validate active-assignment constraints atomically, authenticate approving/responding identities, preserve durable audits, and return updated entities. This demo checkbox and “Demo dispatcher” label are not authentication. Release/reassignment, unit capacity, and authoritative resource availability require additional agreed operations and data.

## Context layers

```ts
type ContextFeature = {
  id: string; name: string; description: string;
  source: string;
  updatedAt: string;
  geometry:
    | { type: 'point'; position: Coordinates | null }
    | { type: 'polygon' | 'line'; positions: Coordinates[] };
};
type ContextLayer = {
  id: string; name: string;
  state: 'synthetic' | 'connected' | 'unavailable' | 'loading' | 'error';
  source: string;
  updatedAt: string | null;
  message?: string;
  features: ContextFeature[];
};
type Snapshot = {
  incidents: Incident[];
  calls: Call[];
  units: Unit[];
  assignments: Assignment[];
  activity: Activity[];
  contextLayers: ContextLayer[]; // [] when no static context supplied
};
```

These geometry shapes reuse the existing Coordinates type; they are **not GeoJSON coordinate arrays**. Agree any GeoJSON conversion in the adapter if the backend chooses that representation. Polygons need at least three valid positions and lines at least two. Invalid or unknown geometry is not plotted. Source timestamps are supplied data; the UI does not relabel old samples as current.

`src/gis.ts` derives road blockage/fire hazard overlays from incident records and assigned response/fire/EMS overlays from the same unit and assignment records used elsewhere. It never copies incident positions onto responders. Other layers (hospital locations, weather alerts, flood-risk zones, closures) arrive through `contextLayers`. The demo hospital is fictional; capabilities, receiving status, capacity, and resource availability are Unknown. Weather/flood polygons are illustrative training geometry, not official warnings or risk assessments. There are no verified hydrants or safe routes.

Unavailable/loading/error layers have explanatory states and no renderable overlay. Errors expose an explicit retry through the adapter, with Loading while awaiting its result; errors preserve other layers, the camera and incident facts. Empty layers show “No records supplied”; records without positions remain readable in Layers without a map feature. Incident filters and layer toggles are independent. Fit visible incidents excludes unknown positions and context geometry. OpenStreetMap attribution remains visible, with standard browser Referer/caching behavior and no bulk download or tile prefetch. Automated gesture tests use local synthetic tiles.

## Existing calls, audit, and commands

Calls retain `{ id, incidentId: string | null, language, time, transcript: { speaker, text }[] }`. `time` is a display-only demo time; a live backend should provide an ISO timestamp and evidence provenance. Activity retains `{ id, time, title, detail, incidentId }` for correction, approval, link-review, and receipt history. Live service audits should add immutable server timestamps and actor IDs.

| Command | Input | Expected behavior |
| --- | --- | --- |
| Correct incident | `incidentId`, `field` (`location`, `detail`, `hazards`, `people`, `injuries`), `value`, `reason` | Require a value and evidence/reason; preserve previous value in audit; clear coordinates on changed location/detail; update timestamp. |
| Review call link | `callId`, `incidentId`, `link` | Explicit review; atomically update the call and incident call lists and audit the relationship. |
| Approve assignment | `incidentId`, `unitId`, human confirmation | Allow multiple units per incident; reject a unit already assigned; create independent pending receipt and approval timestamp. |
| Acknowledge receipt | `assignmentId` | Idempotently acknowledge only that assignment, set receipt timestamp, and audit; travel status stays Unknown. |

Before live integration, agree transport, authorization, concurrency/versioning, structured errors, source attribution, timestamp semantics, and feed licensing. Replace command implementations with validated backend responses and preserve unsaved correction input on failures. No deployment or backend changes are included.

## Response preset and basemap extensions

Presets, category filters, style choices, per-preset layer overrides and camera state are frontend presentation preferences, not Incident fields. No new backend endpoint or server-side preset schema is assumed. `src/responsePresets.ts` defines the Fire/Accident/Medical/Weather layer groups, contextual text and maximum fit zooms. Explicit preset selection or Recenter generates a one-shot viewport request; source refreshes and layer toggles do not generate camera commands. Unknown locations remain null. There is no automatic geocoding, safe-route calculation or tracking.

Additional ContextLayer IDs are `building-entrances`, `hydrants`, `vehicle-locations`, `access-points`, and `waterways`; each reuses the existing ContextFeature geometry, coordinate provenance, source and timestamp fields. `ems-units` is derived from the shared unit roster (all EMS records, with assignment/availability kept separate); `assigned-ems` remains available as the earlier assigned-only layer. All additional operational fixtures are explicitly synthetic. Do not promote their positions or boundaries into operational data on integration.

`simulationApi.reloadContextLayer(id)` currently returns a deep clone of a local fixture or rejects an unknown source. A future service implementation should return a complete ContextLayer (including source/timestamp/provenance) or a rejected operation; the UI transitions loading → ready/error without changing incident records. Use `features: []` for an empty ready layer; `state: 'unavailable'` plus `message` for an unconnected source. Loading/error layers never draw stale features. Source timestamps describe the source records, not the time a preset was selected. Preserve provider licensing and source metadata when connecting real context.

Only Streets has a configured provider. Satellite/Terrain are unavailable in `mapConfig.ts` and have no fallback source. Enabling a future style requires an explicitly reviewed provider URL, license/attribution, browser/CORS/zoom compatibility and appropriate public browser credentials (if required); never expose backend secrets. Existing OpenStreetMap attribution and tile policy remain intact. See [MAP-PROVIDERS.md](MAP-PROVIDERS.md).

## Admin-only portal authentication boundary

The web frontend is an internal admin portal. All dashboard, GIS, incident, calls, activity and responder-management routes are admin tools. There is no public signup/caller entry or selectable production role. The legacy `/#/responder` URL redirects to admin responder management. Teammate-owned responder/backend code remains separate and unchanged.

`src/auth/adminAuth.ts` supplies this frontend integration seam (these are method names, not assumed HTTP endpoints):

```ts
type AdminSession = {
  userId: string;
  displayName: string;
  mode: 'simulation' | 'admin';
};
interface AdminAuthAdapter {
  readonly productionSignInAvailable: boolean;
  getAdminSession(): Promise<AdminSession | null>;
  signInAdmin(): Promise<AdminSession>;
  enterAdminSimulation(): Promise<AdminSession>;
  signOut(): Promise<void>;
}
```

The shipped adapter has `productionSignInAvailable: false`. Live admin sign-in is visibly unconnected; only explicit **Admin simulation** is offered. Its sessionStorage flag remembers demo entry and contains no production credential. It is not authorization and may be changed by the browser user. The route guard and session-shape checks are navigation/presentation logic, **not a security boundary**; bundled synthetic data can be inspected without relying on the UI gate.

A future server-backed adapter must return an admin session only after the backend authenticates and authorizes that user. Do not derive production authority from localStorage/sessionStorage, a client role field, a dropdown or a hidden button. The backend must validate admin access on every protected data request and command, reject unauthorized/non-admin/expired sessions, and supply trusted audit actors. Agree actual session/sign-in/sign-out endpoints, credential handling and data-adapter failure behavior with the backend teammate. Existing backend admin-key validation is not a browser login contract; no admin or ElevenLabs webhook key is collected or embedded in the frontend.

Admins retain assignment and receipt-status inspection. The frontend-only `simulateAcknowledgement` command is available only in Admin simulation, labeled **Demo: simulate acknowledgement**, and records **Demo acknowledgement simulated** in Activity. The original receipt-state function is preserved for the teammate's responder integration. An admin session in the UI does not expose that simulation button, and no real responder acknowledgement endpoint is assumed or invoked. Backend validation must enforce who may record actual responder receipt. Acknowledgement remains separate from en-route/arrival state.

Inspection note for the backend teammate: `backend/app/api/incidents.py` attaches `require_admin_api_key` to POST/PATCH, while incident list/detail/history GET routes currently do not declare that dependency. `backend/app/main.py` includes the router without an additional global authorization dependency. Those backend files were not changed. Before connecting live admin data, the backend owner must protect the relevant reads as well as writes using the agreed admin authorization mechanism; the frontend route gate cannot supply that protection.
