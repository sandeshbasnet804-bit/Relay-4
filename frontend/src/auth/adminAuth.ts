export type AdminSession = {
  userId: string;
  displayName: string;
  mode: "simulation" | "admin";
};
export interface AdminAuthAdapter {
  readonly productionSignInAvailable: boolean;
  getAdminSession(): Promise<AdminSession | null>;
  signInAdmin(): Promise<AdminSession>;
  enterAdminSimulation(): Promise<AdminSession>;
  signOut(): Promise<void>;
}
type SimulationStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const simulationKey = "relay4.admin-simulation";
const demoSession = (): AdminSession => ({
  userId: "demo-admin",
  displayName: "Demo admin",
  mode: "simulation",
});

// This is a simulation entry gate, not authentication or authorization. Only a
// future server-backed adapter may return mode:'admin' after admin validation.
// No role/token from localStorage is accepted and no backend API key is collected.
export function createSimulationAdminAuth(
  storage?: SimulationStorage,
): AdminAuthAdapter {
  let active = false;
  return {
    productionSignInAvailable: false,
    async getAdminSession() {
      let remembered = false;
      try {
        remembered = storage?.getItem(simulationKey) === "1";
      } catch {
        /* Memory-only simulation if storage is unavailable. */
      }
      return active || remembered ? demoSession() : null;
    },
    async signInAdmin() {
      throw new Error(
        "Live admin sign-in is not connected. Use Admin simulation for synthetic data.",
      );
    },
    async enterAdminSimulation() {
      active = true;
      try {
        storage?.setItem(simulationKey, "1");
      } catch {
        /* Keep the current demo usable without browser storage. */
      }
      return demoSession();
    },
    async signOut() {
      active = false;
      try {
        storage?.removeItem(simulationKey);
      } catch {
        /* No browser credential is stored. */
      }
    },
  };
}
function browserSessionStorage() {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}
export const adminAuth: AdminAuthAdapter = createSimulationAdminAuth(
  browserSessionStorage(),
);

// Hash navigation only. This allowlist is UX, never a security boundary.
export function adminReturnPath(hash: string): string {
  const route = hash.replace(/^#/, "");
  if (route === "/responder" || route.startsWith("/responder/"))
    return "/responders";
  return /^\/(home|map|incidents|calls|responders|activity)(\/[A-Za-z0-9_-]+)?$/.test(
    route,
  )
    ? route
    : "/home";
}

// Shape validation for UI rendering only; it does not validate server authority.
export function isAdminSession(value: unknown): value is AdminSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Record<string, unknown>;
  return (
    (session.mode === "simulation" || session.mode === "admin") &&
    typeof session.userId === "string" &&
    !!session.userId.trim() &&
    typeof session.displayName === "string" &&
    !!session.displayName.trim()
  );
}
