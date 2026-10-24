import { enterAdminSimulation } from "./fixtures/admin";
import { test, expect, type Page } from "@playwright/test";
import { mockMapTiles } from "./fixtures/tiles";
test.beforeEach(async ({ page }) => {
  await mockMapTiles(page);
  await enterAdminSimulation(page);
});
const camera = async (page: Page) => {
  const element = page.locator(".map-contents");
  return {
    zoom: Number(await element.getAttribute("data-map-zoom")),
    lat: Number(await element.getAttribute("data-map-latitude")),
    lng: Number(await element.getAttribute("data-map-longitude")),
  };
};
async function expectCamera(
  page: Page,
  before: Awaited<ReturnType<typeof camera>>,
) {
  await expect
    .poll(async () => {
      const now = await camera(page);
      return (
        now.zoom === before.zoom &&
        Math.abs(now.lat - before.lat) < 0.0001 &&
        Math.abs(now.lng - before.lng) < 0.0001
      );
    })
    .toBe(true);
}

test("presets configure different layers and extents without changing style or category filters", async ({
  page,
}) => {
  await page.goto("/#/map/R4-004");
  await expect(
    page.getByRole("combobox", { name: "Map style", exact: true }),
  ).toHaveValue("streets");
  await expect(
    page.getByRole("option", { name: "Satellite — unavailable", exact: true }),
  ).toHaveJSProperty("disabled", true);
  await expect(
    page.getByRole("option", { name: "Terrain — unavailable", exact: true }),
  ).toHaveJSProperty("disabled", true);
  await page
    .getByRole("combobox", { name: "Response preset", exact: true })
    .selectOption("fire");
  await expect(
    page.getByRole("region", { name: "Fire response context", exact: true }),
  ).toContainText("pressure: Unknown");
  await expect(page.locator(".gis-list-item")).toHaveCount(6);
  await expect(page.locator(".context-hydrants")).toHaveCount(1);
  await expect(page.locator(".context-building-entrances")).toHaveCount(1);
  await expect(page.locator(".context-fire-hazards")).toHaveCount(1);
  await expect(page.locator(".context-fire-units")).toHaveCount(1);
  await expect(
    page.locator('.context-legend-entry[data-layer-id="hydrants"]'),
  ).toContainText("Synthetic");
  const fireZoom = (await camera(page)).zoom;
  await page.getByRole("button", { name: "Accidents", exact: true }).click();
  await expect(page.locator(".gis-list-item")).toHaveCount(1);
  await expect(page.locator(".gis-selected")).toContainText("Fire hazard");
  await expect(
    page.getByRole("combobox", { name: "Response preset", exact: true }),
  ).toHaveValue("fire");
  await page
    .getByRole("combobox", { name: "Response preset", exact: true })
    .selectOption("accident");
  await expect(page.locator(".context-vehicle-locations")).toHaveCount(2);
  await expect(page.locator(".context-hydrants")).toHaveCount(0);
  await expect(
    page.locator('.context-legend-entry[data-layer-id="hydrants"]'),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Accidents", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect((await camera(page)).zoom).toBeGreaterThanOrEqual(fireZoom);
  await page.getByRole("button", { name: "Fire", exact: true }).click();
  await expect(
    page.locator(".gis-list-item").filter({ hasText: "Vehicle collision" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Response preset", exact: true })
    .selectOption("medical");
  await expect(page.locator(".context-access-points")).toHaveCount(1);
  await expect(page.locator(".context-ems-units")).toHaveCount(1);
  await expect(page.locator(".context-hospitals")).toHaveCount(1);
  await expect(
    page.getByRole("region", { name: "Medical response context", exact: true }),
  ).toContainText("receiving status");
  await page
    .getByRole("combobox", { name: "Response preset", exact: true })
    .selectOption("weather");
  await expect(page.locator(".context-weather-alerts")).toHaveCount(1);
  await expect(page.locator(".context-waterways")).toHaveCount(1);
  await expect(page.locator(".context-flood-zones")).toHaveCount(1);
  expect((await camera(page)).zoom).toBeLessThanOrEqual(10);
  await expect(
    page.getByRole("combobox", { name: "Map style", exact: true }),
  ).toHaveValue("streets");
  await expect(
    page.getByRole("button", { name: "Fire", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("link", { name: "OpenStreetMap contributors", exact: true }),
  ).toBeVisible();
});

test("manual viewport and per-preset layer overrides survive filters, navigation and expansion", async ({
  page,
}) => {
  await page.goto("/#/map/R4-004");
  await page
    .getByRole("combobox", { name: "Response preset", exact: true })
    .selectOption("fire");
  const originalZoom = (await camera(page)).zoom;
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect
    .poll(async () => (await camera(page)).zoom)
    .toBe(originalZoom + 1);
  const zoom = (await camera(page)).zoom;
  const beforePan = (await camera(page)).lng;
  await page
    .getByRole("region", { name: "Interactive incident map", exact: true })
    .focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await camera(page)).lng).not.toBe(beforePan);
  const manual = await camera(page);
  await page.locator(".gis-layers summary").click();
  await page.getByRole("checkbox", { name: "Hydrants", exact: true }).uncheck();
  await expect(page.locator(".context-hydrants")).toHaveCount(0);
  await expectCamera(page, manual);
  await page.getByRole("button", { name: "Medical", exact: true }).click();
  await expectCamera(page, manual);
  await page.getByRole("link", { name: "Calls", exact: true }).click();
  await page
    .getByRole("heading", { name: "Call records", exact: true })
    .waitFor();
  await page.getByRole("link", { name: "Map", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Response preset", exact: true }),
  ).toHaveValue("fire");
  await expect(
    page.getByRole("button", { name: "Medical", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expectCamera(page, manual);
  await page.locator(".gis-layers summary").click();
  await expect(
    page.getByRole("checkbox", { name: "Hydrants", exact: true }),
  ).not.toBeChecked();
  await page
    .getByRole("button", { name: "Expand incident map", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect.poll(async () => (await camera(page)).zoom).toBe(zoom);
  await page.keyboard.press("Escape");
  await expectCamera(page, manual);
  await page
    .getByRole("combobox", { name: "Response preset", exact: true })
    .selectOption("accident");
  await page
    .getByRole("combobox", { name: "Response preset", exact: true })
    .selectOption("fire");
  await expect(
    page.getByRole("checkbox", { name: "Hydrants", exact: true }),
  ).not.toBeChecked();
  const presetZoom = (await camera(page)).zoom;
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect.poll(async () => (await camera(page)).zoom).toBe(presetZoom + 1);
  await page.getByRole("button", { name: "Recenter", exact: true }).click();
  await expect.poll(async () => (await camera(page)).zoom).toBe(presetZoom);
});

test("loading, error, unavailable and empty context remain usable with explicit retry", async ({
  page,
}) => {
  await page.route("**/src/api.ts*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `
 import {sampleData} from '/src/mockData.ts';
 export const simulationApi={
  async load(){const data=structuredClone(sampleData);for(const [id,state] of [['hydrants','error'],['access-points','loading'],['waterways','unavailable']]){const layer=data.contextLayers.find(l=>l.id===id);layer.state=state;layer.features=[];layer.message='Demo adapter state for verification';}return data;},
  async reloadContextLayer(id){await new Promise(resolve=>setTimeout(resolve,400));return structuredClone(sampleData.contextLayers.find(layer=>layer.id===id));}
 };`,
    }),
  );
  await page.goto("/#/map/R4-004");
  await page.reload();
  await page
    .getByRole("combobox", { name: "Response preset", exact: true })
    .selectOption("fire");
  const initialZoom = (await camera(page)).zoom;
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect
    .poll(async () => (await camera(page)).zoom)
    .toBe(initialZoom + 1);
  const before = await camera(page);
  await page.locator(".gis-layers summary").click();
  await expect(
    page.locator('[data-layer-id="hydrants"]').filter({
      has: page.getByRole("checkbox", { name: "Hydrants", exact: true }),
    }),
  ).toContainText("Error");
  await expect(
    page.getByRole("checkbox", { name: "Medical access points", exact: true }),
  ).toBeDisabled();
  await expect(
    page.locator('.gis-layer[data-layer-id="access-points"]'),
  ).toContainText("Loading context records");
  await expect(
    page.getByRole("checkbox", { name: "Waterways", exact: true }),
  ).toBeDisabled();
  await expect(
    page.locator('.context-legend-entry[data-layer-id="hydrants"]'),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Retry Hydrants", exact: true })
    .click();
  await expect(
    page.locator('.gis-layer[data-layer-id="hydrants"]'),
  ).toContainText("Loading context records");
  await expect(page.locator(".context-hydrants")).toHaveCount(1);
  await expect(
    page.locator('.context-legend-entry[data-layer-id="hydrants"]'),
  ).toContainText("Synthetic");
  await expectCamera(page, before);
  await page
    .getByRole("checkbox", { name: "Assigned EMS", exact: true })
    .check();
  await expect(
    page.locator('.gis-layer[data-layer-id="assigned-ems"]'),
  ).toContainText("Empty");
  await expect(
    page.locator('.gis-layer[data-layer-id="assigned-ems"]'),
  ).toContainText("No records supplied");
});

test("unknown coordinates never produce invented preset pins or boundaries", async ({
  page,
}) => {
  await page.route("**/src/api.ts*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `import {sampleData} from '/src/mockData.ts';export const simulationApi={async load(){const data=structuredClone(sampleData);data.incidents.forEach(i=>i.coordinates=null);data.units.forEach(u=>u.coordinates=null);for(const layer of data.contextLayers)for(const feature of layer.features){if(feature.geometry.type==='point')feature.geometry.position=null;else feature.geometry.positions=[];}return data;}};`,
    }),
  );
  await page.goto("/#/map");
  await page.reload();
  await page
    .getByRole("combobox", { name: "Response preset", exact: true })
    .selectOption("fire");
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(0);
  await expect(page.locator(".context-feature")).toHaveCount(0);
  await expect(page.locator(".map-location-note")).toContainText(
    "Exact location unknown",
  );
  await page.getByRole("button", { name: "Recenter", exact: true }).click();
  expect((await camera(page)).zoom).toBeLessThan(8);
  await expect(page.locator(".gis-legend")).toContainText("No mapped features");
});

test("mobile preset and style controls fit and navigation preserves the selected preset", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/map/R4-004");
  await page
    .getByRole("combobox", { name: "Response preset", exact: true })
    .selectOption("weather");
  await expect(page.locator(".context-waterways")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/relay4-presets-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page
    .getByRole("heading", { name: "Dispatch overview", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Map", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Response preset", exact: true }),
  ).toHaveValue("weather");
  await expect(
    page.getByRole("combobox", { name: "Map style", exact: true }),
  ).toHaveValue("streets");
});
