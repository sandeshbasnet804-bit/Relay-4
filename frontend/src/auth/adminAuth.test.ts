import { describe, expect, it } from "vitest";
import {
  createSimulationAdminAuth,
  adminReturnPath,
  isAdminSession,
} from "./adminAuth";
import { sampleData } from "../mockData";
import { simulateAcknowledgement } from "../state";
const storage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
};
describe("admin entry adapter and demo boundary", () => {
  it("starts signed out and never treats an unconnected live sign-in as success", async () => {
    const auth = createSimulationAdminAuth(storage());
    expect(auth.productionSignInAvailable).toBe(false);
    expect(await auth.getAdminSession()).toBeNull();
    await expect(auth.signInAdmin()).rejects.toThrow("not connected");
  });
  it("ignores local production-role claims and persists only an explicit simulation flag", async () => {
    const store = storage();
    store.setItem("role", "admin");
    store.setItem("token", "pretend-admin");
    const auth = createSimulationAdminAuth(store);
    expect(await auth.getAdminSession()).toBeNull();
    const session = await auth.enterAdminSimulation();
    expect(session.mode).toBe("simulation");
    expect(
      (await createSimulationAdminAuth(store).getAdminSession())?.mode,
    ).toBe("simulation");
    await auth.signOut();
    expect(await auth.getAdminSession()).toBeNull();
  });
  it("uses a memory-only demo if browser storage is unavailable", async () => {
    const fail = () => {
      throw new Error("Storage blocked");
    };
    const auth = createSimulationAdminAuth({
      getItem: fail,
      setItem: fail,
      removeItem: fail,
    });
    await auth.enterAdminSimulation();
    expect((await auth.getAdminSession())?.mode).toBe("simulation");
    await auth.signOut();
    expect(await auth.getAdminSession()).toBeNull();
  });
  it("keeps return navigation inside admin routes and maps the old responder URL to management", () => {
    expect(adminReturnPath("#/map/R4-004")).toBe("/map/R4-004");
    expect(adminReturnPath("#/responder")).toBe("/responders");
    for (const route of [
      "https://other.example",
      "javascript:alert(1)",
      "#/signup",
      "#/caller",
      "#/roles",
    ])
      expect(adminReturnPath(route)).toBe("/home");
    expect(
      isAdminSession({ mode: "responder", userId: "1", displayName: "Unit" }),
    ).toBe(false);
  });
  it("records admin acknowledgement simulation explicitly and remains idempotent", () => {
    const original = structuredClone(sampleData);
    const next = simulateAcknowledgement(original, "AS-001");
    expect(next.activity[0].title).toBe("Demo acknowledgement simulated");
    expect(next.activity[0].detail).toContain("Demo admin simulated receipt");
    expect(next.activity[0].detail).toContain("Travel status: Unknown");
    expect(simulateAcknowledgement(next, "AS-001")).toBe(next);
    expect(original.assignments[0].acknowledged).toBe(false);
  });
});
