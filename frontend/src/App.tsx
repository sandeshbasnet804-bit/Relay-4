import { useEffect, useState, useRef, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  Check,
  CircleCheck,
  Clock3,
  FlaskConical,
  Headphones,
  House,
  MapPin,
  Map as MapIcon,
  Menu,
  Phone,
  Search,
  ShieldCheck,
  TriangleAlert,
  Truck,
  Users,
  Waves,
  X,
} from "lucide-react";
import { simulationApi } from "./api";
import IncidentMap from "./components/IncidentMap";
import GisMapPage from "./components/GisMapPage";
import { initialMapPreferences, type MapCamera } from "./responsePresets";
import IncidentTags from "./components/IncidentTags";
import { disciplineLabel, displayTimestamp } from "./gis";
import RelayLogo from "./components/RelayLogo";
import {
  simulateAcknowledgement,
  approveAssignment,
  correctIncident,
  reviewCall,
} from "./state";
import type { Correction, Incident, Snapshot } from "./types";
import type { AdminSession } from "./auth/adminAuth";
type Route = "home" | "map" | "incidents" | "calls" | "responders" | "activity";
const navigation: { id: Route; label: string; icon: typeof House }[] = [
  { id: "home", label: "Home", icon: House },
  { id: "map", label: "Map", icon: MapIcon },
  { id: "incidents", label: "Incidents", icon: TriangleAlert },
  { id: "calls", label: "Calls", icon: Phone },
  { id: "responders", label: "Responders", icon: Users },
  { id: "activity", label: "Activity", icon: Clock3 },
];
const titles: Record<Route, string> = {
  home: "Dispatch overview",
  map: "Incident map",
  incidents: "Incident details",
  calls: "Call records",
  responders: "Responder management",
  activity: "Activity history",
};
function readRoute(): Route {
  const part = window.location.hash.slice(2).split("/")[0];
  if (part === "responder") return "responders";
  return [
    "home",
    "map",
    "incidents",
    "calls",
    "responders",
    "activity",
  ].includes(part)
    ? (part as Route)
    : "home";
}
function Badge({
  children,
  good = false,
}: {
  children: ReactNode;
  good?: boolean;
}) {
  return (
    <span className={`badge ${good ? "good" : ""}`}>
      {good ? <CircleCheck size={14} /> : <Clock3 size={14} />}
      {children}
    </span>
  );
}
function Panel({
  title,
  eyebrow,
  children,
  action,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-head">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2>{title}</h2>
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
function IncidentIcon({ incident }: { incident: Incident }) {
  return (
    <span className={`incident-icon icon-${incident.id}`}>
      <TriangleAlert size={24} />
    </span>
  );
}
export default function App({
  session,
  onSignOut,
  signingOut,
}: {
  session: AdminSession;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [route, setRoute] = useState<Route>(readRoute);
  const [selected, setSelected] = useState("R4-001");
  const [mapPreferences, setMapPreferences] = useState(initialMapPreferences);
  const mapCamera = useRef<MapCamera | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [callFilter, setCallFilter] = useState("all");
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [unit, setUnit] = useState("U04");
  const [reviewAssignment, setReviewAssignment] = useState(false);
  useEffect(() => {
    simulationApi.load().then(setData);
    const handler = () => {
      setRoute(readRoute());
      if (window.location.hash.split("/")[1] === "responder")
        window.history.replaceState(null, "", "#/responders");
      setMenu(false);
      const id = window.location.hash.split("/")[2];
      if (id) setSelected(id);
    };
    window.addEventListener("hashchange", handler);
    handler();
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  function go(next: Route, id?: string) {
    if (id) setSelected(id);
    if (next === "calls") setCallFilter(id ?? "all");
    window.location.hash = `/${next}${id ? `/${id}` : ""}`;
    setRoute(next);
    setMenu(false);
  }
  function update(fn: (state: Snapshot) => Snapshot, message: string) {
    if (!data) return;
    try {
      setData(fn(data));
      setNotice(message);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!data) return <div className="loading">Loading Admin simulation…</div>;
  const incident =
    data.incidents.find((i) => i.id === selected) ?? data.incidents[0];
  const matches = (i: Incident) =>
    `${i.id} ${i.title} ${i.location} ${i.hazards} ${i.category} ${i.tags.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase());
  const visible = data.incidents.filter(
    (i) =>
      matches(i) &&
      (filter === "all" ||
        (filter === "review"
          ? i.status !== "Assigned"
          : i.status === "Assigned")),
  );
  const pending = data.assignments.filter((a) => !a.acknowledged);
  const currentAssignments = data.assignments.filter(
    (a) => a.incidentId === incident.id,
  );
  const unitAssignment = data.assignments.find((a) => a.unitId === unit);
  const assignedIncident = data.incidents.find(
    (i) => i.id === unitAssignment?.incidentId,
  );
  const queueRows =
    route === "home"
      ? (visible.some((i) => i.id === incident.id)
          ? [incident, ...visible.filter((i) => i.id !== incident.id)]
          : visible
        ).slice(0, 3)
      : visible;
  function queue() {
    return (
      <>
        <div className="queue-labels">
          <span>Incident / location</span>
          <span>Status</span>
          <span />
        </div>
        <div className="incident-list">
          {visible.length ? (
            queueRows.map((i) => (
              <div
                className={`incident-row ${i.id === incident.id ? "selected" : ""}`}
                key={i.id}
              >
                <button
                  className="incident-select"
                  onClick={() => setSelected(i.id)}
                  aria-pressed={i.id === incident.id}
                >
                  <IncidentIcon incident={i} />
                  <span>
                    <strong>{i.title}</strong>
                    <small>
                      {i.id} · {i.callIds.length}{" "}
                      {i.callIds.length === 1 ? "call" : "calls"}
                    </small>
                    <span className="row-location">
                      <MapPin size={13} />
                      {i.location}
                    </span>
                  </span>
                </button>
                <Badge good={i.status === "Assigned"}>{i.status}</Badge>
                <button
                  className="icon-button row-open"
                  aria-label={`Open ${i.id}`}
                  onClick={() => go("incidents", i.id)}
                >
                  <ArrowRight size={18} />
                </button>
              </div>
            ))
          ) : (
            <div className="empty">
              No incidents match these filters.
              <button
                className="text-button"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
        {route === "home" && (
          <div className="home-queue-more">
            <span>
              Showing {queueRows.length} of {visible.length} matching incidents
            </span>
            <button
              className="text-button"
              onClick={() => go("map", incident.id)}
            >
              View full map <ArrowRight size={13} />
            </button>
          </div>
        )}
      </>
    );
  }
  function facts(i: Incident) {
    return (
      <div className="facts">
        <div>
          <Waves />
          <span>
            Hazards<strong>{i.hazards}</strong>
          </span>
        </div>
        <div>
          <Users />
          <span>
            People<strong>{i.people}</strong>
          </span>
        </div>
        <div>
          <ShieldCheck />
          <span>
            Injuries<strong>{i.injuries}</strong>
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="app">
      <aside className={`sidebar ${menu ? "is-open" : ""}`}>
        <RelayLogo onHome={() => go("home")} />
        <div className="workspace-label">LOUISIANA · ADMIN PORTAL</div>
        <nav aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={`#/${id}`}
              className={route === id ? "active" : ""}
              aria-current={route === id ? "page" : undefined}
            >
              <Icon size={20} />
              {label}
              {id === "incidents" && (
                <span className="nav-count">{data.incidents.length}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile">
            <span className="avatar">D</span>
            <span>
              <strong>{session.displayName}</strong>
              <small>
                {session.mode === "simulation"
                  ? "Admin simulation"
                  : "Admin workspace"}
              </small>
            </span>
          </div>
          <button
            type="button"
            className="admin-session-action"
            disabled={signingOut}
            onClick={onSignOut}
          >
            {session.mode === "simulation"
              ? "Exit Admin simulation"
              : "Sign out"}
          </button>
          <div className="team">
            <Users size={19} />
            <span>
              Geeks From SLU<strong>Team 404</strong>
            </span>
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <main>
        <header className="topbar">
          <div className="page-heading">
            <button
              className="icon-button menu-button"
              onClick={() => setMenu(!menu)}
              aria-label="Toggle navigation"
              aria-expanded={menu}
            >
              <Menu />
            </button>
            <div>
              <p className="eyebrow">INTERNAL ADMIN WORKSPACE</p>
              <h1>{titles[route]}</h1>
            </div>
          </div>
          <label className="search">
            <Search size={19} />
            <input
              aria-label="Search incidents, locations, and hazards"
              placeholder="Find incident or location"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button aria-label="Clear search" onClick={() => setQuery("")}>
                <X size={15} />
              </button>
            )}
          </label>
          <span className="feed">
            <i />
            Admin simulation
          </span>
        </header>
        <div className="simulation">
          <FlaskConical size={18} />
          <strong>Admin simulation</strong>
          <span>Synthetic incidents · no live dispatch</span>
          <span className="simulation-tag">ADMIN WORKSPACE</span>
        </div>
        {notice && (
          <div className="notice" role="status">
            <Check size={18} />
            {notice}
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              <X size={17} />
            </button>
          </div>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
            <button className="text-button" onClick={() => setError("")}>
              Dismiss
            </button>
          </div>
        )}
        {route === "map" && (
          <GisMapPage
            preferences={mapPreferences}
            onPreferencesChange={setMapPreferences}
            initialCamera={mapCamera.current}
            onCameraChange={(camera) => {
              mapCamera.current = camera;
            }}
            onLayerUpdate={(layer) =>
              setData((previous) =>
                previous
                  ? {
                      ...previous,
                      contextLayers: previous.contextLayers.map((current) =>
                        current.id === layer.id ? layer : current,
                      ),
                    }
                  : previous,
              )
            }
            data={data}
            selectedId={incident.id}
            query={query}
            onSelect={(id) => go("map", id)}
            onOpen={(id) => go("incidents", id)}
          />
        )}
        {route === "home" && (
          <>
            <div className="stats">
              <div>
                <span className="stat-icon red">
                  <TriangleAlert />
                </span>
                <strong>{data.incidents.length}</strong>
                <span>
                  Active incidents<small>In the simulation queue</small>
                </span>
              </div>
              <div>
                <span className="stat-icon amber">
                  <Clock3 />
                </span>
                <strong>
                  {data.incidents.filter((i) => i.status !== "Assigned").length}
                </strong>
                <span>
                  Need review<small>Pending dispatcher review</small>
                </span>
              </div>
              <div>
                <span className="stat-icon green">
                  <Check />
                </span>
                <strong>{pending.length}</strong>
                <span>
                  Awaiting acknowledgement
                  <small>Human-approved assignments</small>
                </span>
              </div>
            </div>
            <div className="home-grid">
              <div>
                <Panel
                  title="Needs your attention"
                  eyebrow="INCIDENT QUEUE"
                  action={
                    <div className="segmented" aria-label="Filter incidents">
                      <button
                        className={filter === "review" ? "active" : ""}
                        onClick={() => setFilter("review")}
                      >
                        Needs review
                      </button>
                      <button
                        className={filter === "all" ? "active" : ""}
                        onClick={() => setFilter("all")}
                      >
                        All active
                      </button>
                    </div>
                  }
                >
                  {queue()}
                </Panel>
                <Panel title="Pending actions" className="pending-panel">
                  <>
                    {pending.length ? (
                      pending.map((a) => (
                        <button
                          className="pending-action"
                          key={a.id}
                          onClick={() => {
                            setUnit(a.unitId);
                            setReviewAssignment(true);
                            go("responders", a.incidentId);
                          }}
                        >
                          <Truck size={23} />
                          <span>
                            <strong>
                              {data.units.find((u) => u.id === a.unitId)?.name}{" "}
                              · Awaiting acknowledgement
                            </strong>
                            <small>
                              {a.incidentId} · Assignment approved by{" "}
                              {a.approvedBy}
                            </small>
                          </span>
                          <ArrowRight size={18} />
                        </button>
                      ))
                    ) : (
                      <div className="empty">No acknowledgements pending.</div>
                    )}
                  </>
                </Panel>
                <div className="workflow-note">
                  <ShieldCheck size={17} />
                  <span>
                    People make the decisions. Every assignment requires
                    dispatcher approval.
                  </span>
                </div>
              </div>
              <Panel
                title="Selected incident"
                className="summary"
                action={<span className="subtle">{incident.id}</span>}
              >
                <div className="summary-title">
                  <IncidentIcon incident={incident} />
                  <h3>{incident.title}</h3>
                </div>
                <div className="location">
                  <MapPin size={19} />
                  <div>
                    <strong>{incident.location}</strong>
                    <span>{incident.detail}</span>
                  </div>
                </div>
                <IncidentTags incident={incident} />
                {facts(incident)}
                <IncidentMap
                  incidents={data.incidents}
                  selectedIncidentId={incident.id}
                  onSelectIncident={setSelected}
                />
                <button
                  className="button wide"
                  onClick={() => go("incidents", incident.id)}
                >
                  Open incident details
                  <ArrowRight size={17} />
                </button>
                <div className="summary-foot">
                  <ShieldCheck size={14} />
                  Human-approved dispatch
                </div>
              </Panel>
            </div>
          </>
        )}
        {route === "incidents" && (
          <>
            <div className="toolbar">
              <label>
                Incident
                <select
                  value={incident.id}
                  onChange={(e) => {
                    setSelected(e.target.value);
                    window.location.hash = `/incidents/${e.target.value}`;
                  }}
                >
                  {data.incidents.filter(matches).map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.id} · {i.title}
                    </option>
                  ))}
                  {!data.incidents.filter(matches).length && (
                    <option value={incident.id}>
                      No search matches · {incident.id}
                    </option>
                  )}
                </select>
              </label>
              <Badge good={incident.status === "Assigned"}>
                {incident.status}
              </Badge>
            </div>
            <div className="detail-grid">
              <div className="stack">
                <Panel eyebrow={incident.id} title={incident.title}>
                  <div className="location">
                    <MapPin />
                    <div>
                      <strong>{incident.location}</strong>
                      <span>{incident.detail}</span>
                    </div>
                  </div>
                  <IncidentTags incident={incident} />
                  <p className="muted small">
                    {incident.source} · Updated{" "}
                    {displayTimestamp(incident.updatedAt)}
                  </p>
                  {facts(incident)}
                  <IncidentMap
                    incidents={data.incidents}
                    selectedIncidentId={incident.id}
                    onSelectIncident={(id) => go("incidents", id)}
                  />
                  <p className="muted small">
                    Reported information requires human review.
                  </p>
                </Panel>
                <Panel
                  title="Caller evidence"
                  action={
                    <span className="count">
                      {incident.callIds.length} calls
                    </span>
                  }
                >
                  {data.calls
                    .filter((c) => c.incidentId === incident.id)
                    .map((c) => (
                      <div className="evidence" key={c.id}>
                        <div>
                          <Phone size={16} />
                          <strong>{c.id}</strong>
                          <span>
                            {c.time} · {c.language}
                          </span>
                        </div>
                        <blockquote>
                          “
                          {
                            c.transcript.find((t) => t.speaker === "Caller")
                              ?.text
                          }
                          ”
                        </blockquote>
                        <button
                          className="text-button"
                          onClick={() => go("calls", incident.id)}
                        >
                          Read full transcript
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    ))}
                  {incident.callIds.length === 0 && (
                    <p className="muted">No linked caller evidence.</p>
                  )}
                </Panel>
                <Panel title="Related-call review">
                  <p className="muted small">
                    Review evidence before linking or removing a call. No
                    automatic duplicate decisions.
                  </p>
                  {data.calls.map((c) => (
                    <div className="related-row" key={c.id}>
                      <span>
                        <strong>{c.id}</strong>
                        <small>
                          {c.incidentId
                            ? `Linked to ${c.incidentId}`
                            : "Unlinked"}{" "}
                          · {c.time}
                        </small>
                        <span className="call-preview">
                          {c.transcript[0].text}
                        </span>
                      </span>
                      <button
                        className="button secondary compact"
                        onClick={() =>
                          update(
                            (s) =>
                              reviewCall(
                                s,
                                c.id,
                                incident.id,
                                c.incidentId !== incident.id,
                              ),
                            c.incidentId === incident.id
                              ? "Call unlinked. History updated."
                              : "Call linked after human review.",
                          )
                        }
                      >
                        {c.incidentId === incident.id ? "Unlink" : "Link here"}
                      </button>
                    </div>
                  ))}
                </Panel>
              </div>
              <div className="stack">
                <CorrectionForm
                  key={incident.id}
                  incident={incident}
                  onSave={(c) =>
                    update(
                      (s) => correctIncident(s, incident.id, c),
                      "Correction saved. All screens now show the updated facts.",
                    )
                  }
                />
                <Panel
                  title="Assignment approval"
                  eyebrow="HUMAN DECISION REQUIRED"
                >
                  {incident.responseNeeds.map((need) => (
                    <p className="gis-response-need" key={need}>
                      <strong>{disciplineLabel(need)} response</strong>
                      {currentAssignments.some(
                        (a) =>
                          data.units.find((u) => u.id === a.unitId)
                            ?.discipline === need,
                      )
                        ? "Human-approved assignment below"
                        : "Human approval pending"}
                    </p>
                  ))}
                  {currentAssignments.map((assignment) => (
                    <div className="assignment-entry" key={assignment.id}>
                      <div className="assignment-unit">
                        <Truck />
                        <strong>
                          {
                            data.units.find((u) => u.id === assignment.unitId)
                              ?.name
                          }
                        </strong>
                      </div>
                      <Badge good={assignment.acknowledged}>
                        {assignment.acknowledged
                          ? "Acknowledged"
                          : "Awaiting acknowledgement"}
                      </Badge>
                      <p className="muted small">
                        Approved by {assignment.approvedBy} ·{" "}
                        {displayTimestamp(assignment.approvedAt)}. Travel
                        status: Unknown.
                      </p>
                      <button
                        className="button secondary wide"
                        onClick={() => {
                          setUnit(assignment.unitId);
                          setReviewAssignment(true);
                          go("responders");
                        }}
                      >
                        Review assignment
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  ))}
                  <AssignmentForm
                    key={`${incident.id}-${data.assignments.length}`}
                    data={data}
                    onApprove={(id) =>
                      update(
                        (s) => approveAssignment(s, incident.id, id),
                        "Assignment approved. Waiting for responder acknowledgement.",
                      )
                    }
                  />
                </Panel>
              </div>
            </div>
          </>
        )}
        {route === "calls" && (
          <Panel
            title="Caller transcripts"
            eyebrow="SOURCE EVIDENCE"
            action={
              <label className="inline-label">
                Incident
                <select
                  value={callFilter}
                  onChange={(e) => setCallFilter(e.target.value)}
                >
                  <option value="all">All incidents</option>
                  {data.incidents.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.id}
                    </option>
                  ))}
                </select>
              </label>
            }
          >
            <div className="call-grid">
              {data.calls
                .filter(
                  (c) =>
                    (callFilter === "all" || c.incidentId === callFilter) &&
                    (!query ||
                      `${c.id} ${c.incidentId ?? ""} ${c.transcript.map((t) => t.text).join(" ")} ${data.incidents.find((i) => i.id === c.incidentId)?.location ?? ""}`
                        .toLowerCase()
                        .includes(query.toLowerCase())),
                )
                .map((c) => (
                  <article className="call-card" key={c.id}>
                    <div className="call-head">
                      <span className="stat-icon blue">
                        <Headphones size={20} />
                      </span>
                      <div>
                        <h3>{c.id}</h3>
                        <small>
                          {c.time} · {c.language} · Synthetic call
                        </small>
                      </div>
                    </div>
                    <div className="transcript">
                      {c.transcript.map((t, index) => (
                        <div
                          key={index}
                          className={
                            t.speaker === "Caller" ? "caller" : "intake"
                          }
                        >
                          <strong>{t.speaker}</strong>
                          <p>{t.text}</p>
                        </div>
                      ))}
                    </div>
                    {c.incidentId ? (
                      <button
                        className="text-button"
                        onClick={() => go("incidents", c.incidentId!)}
                      >
                        {c.incidentId} · Open linked incident
                        <ArrowRight size={15} />
                      </button>
                    ) : (
                      <span className="muted">No incident linked</span>
                    )}
                  </article>
                ))}
            </div>
            {!data.calls.some(
              (c) =>
                (callFilter === "all" || c.incidentId === callFilter) &&
                (!query ||
                  `${c.id} ${c.incidentId ?? ""} ${c.transcript.map((t) => t.text).join(" ")} ${data.incidents.find((i) => i.id === c.incidentId)?.location ?? ""}`
                    .toLowerCase()
                    .includes(query.toLowerCase())),
            ) && (
              <div className="empty">No calls match your search or filter.</div>
            )}
          </Panel>
        )}
        {route === "responders" && (
          <>
            <p className="page-description">
              Track approved assignments and receipt. Acknowledgement does not
              indicate travel or arrival.
            </p>
            <div className="unit-grid">
              {data.units
                .filter((u) => {
                  const a = data.assignments.find((a) => a.unitId === u.id);
                  const i = data.incidents.find((i) => i.id === a?.incidentId);
                  return `${u.name} ${i?.id ?? ""} ${i?.location ?? ""}`
                    .toLowerCase()
                    .includes(query.toLowerCase());
                })
                .map((u) => {
                  const a = data.assignments.find((a) => a.unitId === u.id);
                  const i = data.incidents.find((i) => i.id === a?.incidentId);
                  return (
                    <Panel key={u.id}>
                      <div className="unit-heading">
                        <span className="stat-icon blue">
                          <Truck />
                        </span>
                        <div>
                          <h2>{u.name}</h2>
                          <span className="muted small">{u.capability}</span>
                        </div>
                      </div>
                      <Badge good={a?.acknowledged}>
                        {a
                          ? a.acknowledged
                            ? "Acknowledged"
                            : "Awaiting acknowledgement"
                          : "Unassigned"}
                      </Badge>
                      <div className="unit-incident">
                        {i ? (
                          <>
                            <button
                              className="text-button"
                              onClick={() => go("incidents", i.id)}
                            >
                              {i.id} · {i.title}
                              <ArrowRight size={14} />
                            </button>
                            <p>
                              <MapPin size={15} />
                              {i.location}
                            </p>
                          </>
                        ) : (
                          <p className="muted">No approved assignment.</p>
                        )}
                      </div>
                      <div className="unit-meta">
                        <span>
                          Travel status<strong>Unknown</strong>
                        </span>
                        <span>
                          Approved by
                          <strong>{a?.approvedBy ?? "Unknown"}</strong>
                        </span>
                      </div>
                      <button
                        className="button secondary wide"
                        onClick={() => {
                          setUnit(u.id);
                          setReviewAssignment(true);
                          go("responders");
                        }}
                      >
                        Review assignment
                        <ArrowRight size={16} />
                      </button>
                    </Panel>
                  );
                })}
            </div>
          </>
        )}
        {route === "activity" && (
          <Panel
            title="Correction & approval history"
            eyebrow="SIMULATION AUDIT TRAIL"
            action={
              <span className="count">{data.activity.length} events</span>
            }
          >
            <div className="timeline">
              {data.activity
                .filter((a) =>
                  `${a.title} ${a.detail} ${a.incidentId}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((a) => (
                  <article key={a.id}>
                    <span className="timeline-icon">
                      <Activity size={18} />
                    </span>
                    <div>
                      <span className="event-time">
                        {a.time} · This simulation session
                      </span>
                      <h3>{a.title}</h3>
                      <p>{a.detail}</p>
                      <button
                        className="text-button"
                        onClick={() => go("incidents", a.incidentId)}
                      >
                        {a.incidentId}
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </article>
                ))}
            </div>
            {!data.activity.some((a) =>
              `${a.title} ${a.detail} ${a.incidentId}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            ) && <div className="empty">No activity matches your search.</div>}
          </Panel>
        )}
        {route === "responders" && reviewAssignment && (
          <section
            className="admin-assignment-review"
            aria-label="Admin assignment review"
          >
            <h2>Assignment review</h2>
            <div className="responder-layout">
              <div className="toolbar">
                <label>
                  Review unit
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  >
                    {data.units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="badge good">
                  Admin simulation · assignment review
                </span>
              </div>
              {assignedIncident && unitAssignment ? (
                <Panel
                  eyebrow={`${assignedIncident.id} · APPROVED ASSIGNMENT`}
                  title={assignedIncident.title}
                >
                  <Badge good={unitAssignment.acknowledged}>
                    {unitAssignment.acknowledged
                      ? "Acknowledged"
                      : "Awaiting responder acknowledgement"}
                  </Badge>
                  <div className="responder-location location">
                    <MapPin size={25} />
                    <div>
                      <strong>{assignedIncident.location}</strong>
                      <span>{assignedIncident.detail}</span>
                    </div>
                  </div>
                  <IncidentTags incident={assignedIncident} />
                  <p className="muted small">
                    {assignedIncident.source} · Updated{" "}
                    {displayTimestamp(assignedIncident.updatedAt)}
                  </p>
                  {facts(assignedIncident)}
                  <IncidentMap
                    incidents={[assignedIncident]}
                    selectedIncidentId={assignedIncident.id}
                  />
                  <div className="hazard-notice">
                    <TriangleAlert size={20} />
                    <span>
                      <strong>Latest reported hazard</strong>
                      {assignedIncident.hazards}
                    </span>
                  </div>
                  <p className="muted">
                    Admin review of the latest reported information. Demo
                    actions simulate receipt only.
                  </p>
                  {session.mode === "simulation" && (
                    <button
                      className="button acknowledge wide"
                      disabled={unitAssignment.acknowledged}
                      onClick={() =>
                        update(
                          (s) => simulateAcknowledgement(s, unitAssignment.id),
                          "Demo acknowledgement recorded. Travel status remains Unknown.",
                        )
                      }
                    >
                      <Check />
                      {unitAssignment.acknowledged
                        ? "Demo acknowledgement recorded"
                        : "Demo: simulate acknowledgement"}
                    </button>
                  )}
                  <p className="ack-note">
                    Acknowledgement confirms receipt only. It does not mean “en
                    route.”
                  </p>
                  <div className="unit-meta">
                    <span>
                      Travel status<strong>Unknown</strong>
                    </span>
                    <span>
                      Approved by<strong>{unitAssignment.approvedBy}</strong>
                    </span>
                  </div>
                </Panel>
              ) : (
                <Panel title="No assigned incident">
                  <div className="empty">
                    <Truck size={35} />
                    <p>This unit has no human-approved assignment.</p>
                    <button
                      className="button secondary"
                      onClick={() => go("incidents")}
                    >
                      Review incidents
                    </button>
                  </div>
                </Panel>
              )}
            </div>
          </section>
        )}
        <footer>
          <div className="footer-branding">
            <RelayLogo size="compact" onHome={() => go("home")} />
            <span>Louisiana · Synthetic data</span>
          </div>
          <span>
            <ShieldCheck size={15} />
            Human-approved coordination
          </span>
        </footer>
      </main>
    </div>
  );
}
function CorrectionForm({
  incident,
  onSave,
}: {
  incident: Incident;
  onSave: (c: Correction) => void;
}) {
  const [field, setField] = useState<Correction["field"]>("location");
  const [value, setValue] = useState(incident.location);
  const [reason, setReason] = useState("");
  return (
    <Panel title="Correct incident facts" eyebrow="ADMIN REVIEW">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ field, value, reason });
          setReason("");
        }}
      >
        <label>
          Field
          <select
            value={field}
            onChange={(e) => {
              const f = e.target.value as Correction["field"];
              setField(f);
              setValue(incident[f]);
            }}
          >
            <option value="location">Location</option>
            <option value="detail">Location detail</option>
            <option value="hazards">Hazards</option>
            <option value="people">People</option>
            <option value="injuries">Injuries</option>
          </select>
        </label>
        <label>
          Corrected value
          <input
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={250}
          />
        </label>
        <label>
          Evidence or reason
          <textarea
            required
            placeholder="Reference a call and explain the correction…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={1000}
          />
        </label>
        <p className="muted small">
          Keep unverified or missing facts “Unknown.” Changes appear in
          Activity.
        </p>
        <button
          className="button wide"
          disabled={!value.trim() || !reason.trim()}
        >
          Save correction
          <Check size={16} />
        </button>
      </form>
    </Panel>
  );
}
function AssignmentForm({
  data,
  onApprove,
}: {
  data: Snapshot;
  onApprove: (id: string) => void;
}) {
  const available = data.units.filter(
    (u) => !data.assignments.some((a) => a.unitId === u.id),
  );
  const [unit, setUnit] = useState(available[0]?.id ?? "");
  const [confirmed, setConfirmed] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmed) {
          onApprove(unit);
          setConfirmed(false);
        }
      }}
    >
      <p className="muted small">
        Review caller evidence, location, and hazards before approving an
        assignment.
      </p>
      <label>
        Responder unit
        <select
          required
          value={unit}
          onChange={(e) => {
            setUnit(e.target.value);
            setConfirmed(false);
          }}
        >
          {available.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {u.capability}
            </option>
          ))}
          {!available.length && <option value="">No unassigned units</option>}
        </select>
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>
          I reviewed the incident and approve this assignment as the demo admin.
        </span>
      </label>
      <button className="button wide" disabled={!confirmed || !unit}>
        <ShieldCheck size={17} />
        Approve assignment
      </button>
      <p className="muted small">Simulation only. No responder is contacted.</p>
    </form>
  );
}
