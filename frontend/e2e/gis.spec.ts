import { enterAdminSimulation } from "./fixtures/admin";
import { test, expect } from "@playwright/test";
import { mockMapTiles } from "./fixtures/tiles";
test.beforeEach(async ({ page }) => {
  await mockMapTiles(page);
  await enterAdminSimulation(page);
});

test("category chips include secondary fire tags and synchronize markers with the list", async ({
  page,
}) => {
  await page.goto("/#/map");
  await expect(
    page.getByRole("heading", { name: "Incident map", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".gis-list-item")).toHaveCount(6);
  await page.getByRole("button", { name: "Accidents", exact: true }).click();
  await expect(page.locator(".gis-list-item")).toHaveCount(1);
  await expect(page.locator(".gis-selected")).toContainText(
    "Fuel leakage and smoke reported",
  );
  await expect(page.locator(".gis-selected")).toContainText("Fire hazard");
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(1);
  await page.getByRole("button", { name: "Fire", exact: true }).click();
  await expect(page.locator(".gis-list-item")).toHaveCount(2);
  await page
    .locator(".gis-list-item")
    .filter({ hasText: "Smoke report" })
    .click();
  await expect(page.locator(".map-location-note")).toContainText(
    "Exact location unknown",
  );
  await page.locator('.leaflet-marker-icon[title^="R4-004"]').click();
  await expect(page.locator(".gis-selected")).toContainText(
    "Vehicle collision",
  );
  await expect(
    page.locator(".gis-list-item").filter({ hasText: "Vehicle collision" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".leaflet-marker-icon")).toHaveAttribute(
    "title",
    /Accident, Fire hazard/,
  );
  for (const [filter, title] of [
    ["Medical", "Medical assistance"],
    ["Flood", "Stranded vehicle"],
    ["Weather", "Strong winds report"],
  ]) {
    await page.getByRole("button", { name: filter, exact: true }).click();
    await expect(page.locator(".gis-list-item")).toHaveCount(1);
    await expect(page.locator(".gis-selected")).toContainText(title);
  }
  await page
    .getByRole("button", { name: "Fit visible incidents", exact: true })
    .click();
  await expect(page.locator(".map-contents")).toHaveAttribute(
    "data-map-zoom",
    "12",
  );
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.locator(".gis-list-item")).toHaveCount(6);
  await page
    .getByRole("button", { name: "Fit visible incidents", exact: true })
    .click();
  const mapBox = (await page.locator(".relay-leaflet-map").boundingBox())!;
  for (const marker of await page.locator(".leaflet-marker-icon").all()) {
    const point = (await marker.boundingBox())!;
    expect(point.x + point.width / 2).toBeGreaterThan(mapBox.x);
    expect(point.x + point.width / 2).toBeLessThan(mapBox.x + mapBox.width);
    expect(point.y + point.height / 2).toBeGreaterThan(mapBox.y);
    expect(point.y + point.height / 2).toBeLessThan(mapBox.y + mapBox.height);
  }
  await page
    .getByRole("textbox", { name: "Search incidents, locations, and hazards" })
    .fill("not-a-report");
  await expect(page.locator(".gis-empty")).toBeVisible();
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Fit visible incidents", exact: true }),
  ).toBeDisabled();
});

test("context toggles retain provenance and tolerate empty or unavailable layers", async ({
  page,
}) => {
  await page.goto("/#/map");
  await page.locator(".gis-layers summary").click();
  await page
    .getByRole("checkbox", { name: "Hospital locations", exact: true })
    .check();
  await expect(page.locator(".context-hospitals")).toHaveCount(1);
  await expect(page.locator(".gis-layer-records")).toContainText(
    "Capabilities, capacity, resource availability and receiving status: Unknown",
  );
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await page.locator(".context-hospitals").click();
  await expect(page.locator(".leaflet-popup")).toContainText(
    "SYNTHETIC CONTEXT",
  );
  for (const [label, id] of [
    ["Flood-risk zones", "flood-zones"],
    ["Weather alerts", "weather-alerts"],
    ["Reported closures", "closures"],
  ]) {
    await page.getByRole("checkbox", { name: label, exact: true }).check();
    await expect(page.locator(`.context-${id}`)).toHaveCount(1);
  }
  await page
    .getByRole("checkbox", { name: "Reported road blockages", exact: true })
    .check();
  await expect(
    page.locator(".gis-layer").filter({
      has: page.getByRole("checkbox", {
        name: "Reported road blockages",
        exact: true,
      }),
    }),
  ).toContainText("Exact location unknown · not mapped");
  await page
    .getByRole("checkbox", { name: "Assigned EMS", exact: true })
    .check();
  await expect(
    page.locator(".gis-layer").filter({
      has: page.getByRole("checkbox", { name: "Assigned EMS", exact: true }),
    }),
  ).toContainText("No records supplied");
  await expect(
    page.getByRole("checkbox", { name: "Live alert connection", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "Hospital locations", exact: true })
    .uncheck();
  await expect(page.locator(".context-hospitals")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "OpenStreetMap contributors" }),
  ).toBeVisible();
});

test("collision fire and EMS approvals stay separate across admin Map, Home, Details and assignment review", async ({
  page,
}) => {
  await page.goto("/#/map/R4-004");
  await expect(page.locator(".gis-selected")).toContainText(
    "No approved assignments",
  );
  await page
    .getByRole("button", { name: "Open incident", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Incident details", exact: true }),
  ).toBeVisible();
  for (const unit of ["U07", "U09"]) {
    await page
      .getByRole("combobox", { name: "Responder unit", exact: true })
      .selectOption(unit);
    await expect(
      page.getByRole("button", { name: "Approve assignment", exact: true }),
    ).toBeDisabled();
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Approve assignment", exact: true })
      .click();
  }
  await expect(page.locator(".assignment-entry")).toHaveCount(2);
  await page
    .locator(".assignment-entry")
    .filter({ hasText: "EMS 09" })
    .getByRole("button", { name: "Review assignment", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Review unit", exact: true }),
  ).toHaveValue("U09");
  await expect(page.locator(".hazard-notice")).toContainText(
    "Fuel leakage and smoke reported",
  );
  await page
    .getByRole("button", {
      name: "Demo: simulate acknowledgement",
      exact: true,
    })
    .click();
  await page.getByRole("link", { name: "Map", exact: true }).click();
  await expect(page.locator(".gis-selected")).toContainText(
    "2 approved · 1 acknowledged",
  );
  await expect(
    page.locator(".gis-response-need").filter({ hasText: "Engine 07" }),
  ).toContainText("Awaiting acknowledgement");
  await expect(
    page.locator(".gis-response-need").filter({ hasText: "EMS 09" }),
  ).toContainText("Acknowledged");
  await page.locator(".gis-layers summary").click();
  await page
    .getByRole("checkbox", { name: "Assigned EMS", exact: true })
    .check();
  await expect(page.locator(".context-assigned-ems")).toHaveCount(1);
  await expect(page.locator(".gis-layer-records")).toContainText(
    "Receipt acknowledged",
  );
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.locator(".summary")).toContainText("Vehicle collision");
  await expect(page.locator(".incident-row")).toHaveCount(3);
  await expect(page.locator(".pending-action")).toHaveCount(2);
  await page.getByRole("button", { name: "Open incident details" }).click();
  await page
    .getByRole("combobox", { name: "Field", exact: true })
    .selectOption("hazards");
  await page.getByLabel("Corrected value").fill("Unknown");
  await page
    .getByLabel("Evidence or reason")
    .fill("Caller withdrew the hazard report.");
  await page.getByRole("button", { name: "Save correction" }).click();
  await page.getByRole("link", { name: "Map", exact: true }).click();
  await expect(page.locator(".gis-selected")).toContainText(
    "Reported hazardsUnknown",
  );
});

test("GIS controls and side panel fit mobile screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/map/R4-004");
  await page.getByRole("button", { name: "Accidents", exact: true }).click();
  await expect(page.locator(".gis-selected")).toContainText(
    "Vehicle collision",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".gis-layers summary").click();
  await page.getByRole("checkbox", { name: "Fire units", exact: true }).check();
  await expect(page.locator(".context-fire-units")).toHaveCount(1);
  await page.screenshot({
    path: "/tmp/relay4-gis-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Expand incident map" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.getByRole("button", { name: "Close expanded map" }).click();
  await page
    .getByRole("button", { name: "Open incident", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Incident details", exact: true }),
  ).toBeVisible();
});
