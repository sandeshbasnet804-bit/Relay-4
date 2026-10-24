import { useEffect, useRef, useState } from "react";
import { FlaskConical, ShieldCheck } from "lucide-react";
import App from "../App";
import RelayLogo from "../components/RelayLogo";
import {
  adminAuth,
  adminReturnPath,
  isAdminSession,
  type AdminSession,
  type AdminAuthAdapter,
} from "./adminAuth";
import "./AdminPortal.css";

export default function AdminPortal({
  adapter = adminAuth,
}: {
  adapter?: AdminAuthAdapter;
}) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const returnTo = useRef(adminReturnPath(window.location.hash));
  const authorizedView = useRef(false);
  const ready = useRef(false);
  useEffect(() => {
    let mounted = true;
    adapter
      .getAdminSession()
      .then((value) => {
        if (!mounted) return;
        if (value && !isAdminSession(value)) {
          setError("Admin access was not established.");
          return;
        }
        authorizedView.current = !!value;
        setSession(value);
        if (value && window.location.hash === "#/sign-in")
          window.location.hash = returnTo.current;
      })
      .catch(() => {
        if (mounted)
          setError(
            "Admin session could not be checked. Live access remains unavailable.",
          );
      })
      .finally(() => {
        if (!mounted) return;
        ready.current = true;
        setChecking(false);
        if (!authorizedView.current) window.location.hash = "/sign-in";
      });
    const guard = () => {
      if (!ready.current) return;
      if (authorizedView.current) {
        if (window.location.hash === "#/sign-in")
          window.location.hash = "/home";
        return;
      }
      if (window.location.hash === "#/sign-in") return;
      returnTo.current = adminReturnPath(window.location.hash);
      window.location.hash = "/sign-in";
    };
    window.addEventListener("hashchange", guard);
    return () => {
      mounted = false;
      window.removeEventListener("hashchange", guard);
    };
  }, [adapter]);
  async function enter(simulation: boolean) {
    setBusy(true);
    setError("");
    try {
      const next = simulation
        ? await adapter.enterAdminSimulation()
        : await adapter.signInAdmin();
      if (!isAdminSession(next))
        throw new Error("Admin access was not established.");
      authorizedView.current = true;
      setSession(next);
      window.location.hash = returnTo.current;
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Admin sign-in could not complete.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await adapter.signOut();
      authorizedView.current = false;
      returnTo.current = "/home";
      setSession(null);
      window.location.hash = "/sign-in";
    } catch {
      setError("Sign-out could not complete. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  if (checking)
    return (
      <div className="loading" role="status">
        Checking admin access…
      </div>
    );
  if (session)
    return (
      <>
        <App session={session} onSignOut={signOut} signingOut={busy} />
        {error && (
          <div className="admin-session-error" role="alert">
            {error}
          </div>
        )}
      </>
    );
  return (
    <div className="admin-entry">
      <main className="admin-sign-in" aria-labelledby="admin-sign-in-title">
        <div className="admin-entry-brand">
          <RelayLogo />
          <span>LOUISIANA · INTERNAL ADMIN PORTAL</span>
        </div>
        <div className="admin-entry-content">
          <span className="admin-entry-icon">
            <ShieldCheck size={26} />
          </span>
          <p className="eyebrow">GEEKS FROM SLU · TEAM 404</p>
          <h1 id="admin-sign-in-title">Admin sign-in</h1>
          <p>
            Internal tools for incident review, GIS coordination, calls,
            activity and responder management.
          </p>
          <button
            type="button"
            className="button wide"
            disabled={busy || !adapter.productionSignInAvailable}
            onClick={() => enter(false)}
          >
            Sign in as admin
          </button>
          {!adapter.productionSignInAvailable && (
            <p className="admin-entry-unavailable">
              Live admin sign-in is not connected.
            </p>
          )}
          <div className="admin-demo-entry">
            <h2>
              <FlaskConical size={18} />
              Admin simulation
            </h2>
            <p>
              Explore synthetic incidents and demo assignments. No live dispatch
              or responder messaging.
            </p>
            <button
              type="button"
              className="button secondary wide"
              disabled={busy}
              onClick={() => enter(true)}
            >
              {busy ? "Opening admin workspace…" : "Enter Admin simulation"}
            </button>
          </div>
          {error && (
            <p className="admin-entry-error" role="alert">
              {error}
            </p>
          )}
          <p className="admin-entry-boundary">
            Admin simulation is a frontend demo gate. Live data and actions
            require backend-validated admin authorization.
          </p>
        </div>
      </main>
    </div>
  );
}
