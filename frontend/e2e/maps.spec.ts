import { enterAdminSimulation } from "./fixtures/admin";
import { test, expect } from "@playwright/test";
import { mockMapTiles } from "./fixtures/tiles";
test.beforeEach(async ({ page }) => {
  await mockMapTiles(page);
  await enterAdminSimulation(page);
});

test("zoom buttons, wheel, dragging, keyboard pan and recenter change only the viewport", async ({
  page,
}) => {
  await page.goto("/");
  const contents = page.locator(".map-contents");
  const map = page.getByRole("region", {
    name: "Interactive incident map",
    exact: true,
  });
  await expect(contents).toHaveAttribute("data-map-zoom", "11");
  await expect(page.locator(".map-location-note")).toContainText(
    "Simulated coordinates",
  );
  await expect(
    page.getByRole("link", { name: "OpenStreetMap contributors" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(contents).toHaveAttribute("data-map-zoom", "12");
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await expect(contents).toHaveAttribute("data-map-zoom", "11");
  await map.hover();
  await page.mouse.wheel(0, -180);
  await expect
    .poll(async () => Number(await contents.getAttribute("data-map-zoom")))
    .toBeGreaterThan(11);
  await page.getByRole("button", { name: "Recenter", exact: true }).click();
  await expect(contents).toHaveAttribute("data-map-zoom", "11");
  const box = (await map.boundingBox())!;
  const beforeDrag = await contents.getAttribute("data-map-longitude");
  await page.mouse.move(box.x + 80, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 190, box.y + 140, { steps: 12 });
  await page.mouse.up();
  await expect
    .poll(() => contents.getAttribute("data-map-longitude"))
    .not.toBe(beforeDrag);
  await page.getByRole("button", { name: "Recenter", exact: true }).click();
  await expect
    .poll(async () => Number(await contents.getAttribute("data-map-latitude")))
    .toBeCloseTo(30.2, 2);
  await expect
    .poll(async () => Number(await contents.getAttribute("data-map-longitude")))
    .toBeCloseTo(-90.65, 2);
  const beforeKeyboardPan = await contents.getAttribute("data-map-longitude");
  await map.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => contents.getAttribute("data-map-longitude"))
    .not.toBe(beforeKeyboardPan);
  await expect(page.locator(".summary .location")).toContainText(
    "Cypress Bend Market",
  );
  await page.getByRole("link", { name: "Activity", exact: true }).click();
  await expect(page.locator(".timeline article")).toHaveCount(2);
});

test("popups and incident selection keep source labels and unknown locations accurate", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('.leaflet-marker-icon[title^="R4-001"]').click();
  await expect(page.locator(".incident-map-popup")).toContainText("R4-001");
  await expect(page.locator(".incident-map-popup")).toContainText(
    "Cypress Bend Market",
  );
  await expect(page.locator(".incident-map-popup")).toContainText(
    "Location updated",
  );
  await expect(page.locator(".incident-map-popup")).toContainText(
    "not a verified real location",
  );
  await page
    .locator(".incident-select")
    .filter({ hasText: "Road blocked" })
    .click();
  await expect(page.locator(".map-location-note")).toContainText(
    "Exact location unknown",
  );
  await expect(page.locator(".map-location-note")).toContainText("R4-002");
  await expect(
    page.locator('.leaflet-marker-icon[title^="R4-002"]'),
  ).toHaveCount(0);
  await expect
    .poll(async () =>
      Number(await page.locator(".map-contents").getAttribute("data-map-zoom")),
    )
    .toBeLessThan(8);
  await page.getByRole("button", { name: "Open incident details" }).click();
  await expect(
    page.getByRole("heading", { name: "Incident details", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".map-location-note")).toContainText(
    "Exact location unknown",
  );
  await page
    .getByRole("combobox", { name: "Incident", exact: true })
    .selectOption("R4-001");
  await expect(page.locator(".map-location-note")).toContainText(
    "Simulated coordinates",
  );
  await expect(page.locator(".map-contents")).toHaveAttribute(
    "data-map-zoom",
    "11",
  );
  await page.getByRole("button", { name: "Expand incident map" }).click();
  await page
    .getByRole("combobox", { name: "Map incident" })
    .selectOption("R4-002");
  await expect(page).toHaveURL(/incidents\/R4-002$/);
  await page
    .getByRole("button", { name: "Fit visible incidents", exact: true })
    .click();
  await page.locator('.leaflet-marker-icon[title^="R4-001"]').click();
  await expect(page.locator(".incident-map-popup")).toBeVisible();
  await expect(page.locator(".map-location-note")).toContainText("R4-001");
  await expect(page).toHaveURL(/incidents\/R4-001$/);
});

test("text correction removes the stale pin on all routes; approval updates popup status", async ({
  page,
}) => {
  await page.goto("/#/incidents/R4-001");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Approve assignment", exact: true })
    .click();
  await page.locator('.leaflet-marker-icon[title^="R4-001"]').click();
  await expect(page.locator(".incident-map-popup")).toContainText("Assigned");
  await page
    .getByRole("combobox", { name: "Field", exact: true })
    .selectOption("location");
  await page.getByLabel("Corrected value").fill("Unknown");
  await page
    .getByLabel("Evidence or reason")
    .fill("Caller could not verify the location.");
  await page.getByRole("button", { name: "Save correction" }).click();
  await expect(page.locator(".map-location-note")).toContainText(
    "Exact location unknown",
  );
  await expect(
    page.locator('.leaflet-marker-icon[title^="R4-001"]'),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Review assignment", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Responder management", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".map-location-note")).toContainText(
    "Exact location unknown",
  );
  await expect(
    page.locator('.leaflet-marker-icon[title^="R4-001"]'),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.locator(".map-location-note")).toContainText(
    "Exact location unknown",
  );
});

test("expanded map supports incident switching, focus restoration and Escape", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Expand incident map" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect
    .poll(async () =>
      Number(
        await dialog
          .locator(".map-contents")
          .getAttribute("data-map-longitude"),
      ),
    )
    .toBeCloseTo(-90.65, 2);
  await expect(page.locator(".leaflet-container")).toHaveCount(1);
  await dialog.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(dialog.locator(".map-contents")).toHaveAttribute(
    "data-map-zoom",
    "12",
  );
  await dialog
    .getByRole("combobox", { name: "Map incident" })
    .selectOption("R4-002");
  await expect(dialog.locator(".map-location-note")).toContainText(
    "Exact location unknown",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Expand incident map" }),
  ).toBeFocused();
  await expect(page.locator(".summary-title")).toContainText("Road blocked");
});

test("tile failures show a helpful fallback with attribution and a working manual retry", async ({
  page,
}) => {
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await page.goto("/");
  await expect(page.locator(".map-tile-message")).toContainText(
    "Map tiles unavailable or incomplete",
  );
  await expect(
    page.getByRole("link", { name: "OpenStreetMap contributors" }),
  ).toBeVisible();
  await expect(page.locator(".location").first()).toContainText(
    "Cypress Bend Market",
  );
  await page.unroute("https://tile.openstreetmap.org/**");
  await mockMapTiles(page);
  await page.getByRole("button", { name: "Retry map tiles" }).click();
  await expect(page.locator(".map-tile-message")).toContainText(
    "browse to explore",
  );
});

test("mobile map, dialog and responder map fit small screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const box = (await page.locator(".relay-leaflet-map").boundingBox())!;
  expect(box.width).toBeGreaterThan(250);
  expect(box.width).toBeLessThan(375);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Expand incident map" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Zoom in", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").locator(".map-contents"),
  ).toHaveAttribute("data-map-zoom", "12");
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/relay4-interactive-mobile.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Close expanded map" }).click();
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Responders", exact: true }).click();
  await page
    .locator(".unit-grid .panel")
    .filter({
      has: page.getByRole("heading", { name: "Rescue 04", exact: true }),
    })
    .getByRole("button", { name: "Review assignment", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Responder management", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".map-location-note")).toContainText(
    "Exact location unknown",
  );
  await expect(
    page.getByRole("button", {
      name: "Demo: simulate acknowledgement",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("touch pinch zoom works without changing incident facts", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await mockMapTiles(page);
  await enterAdminSimulation(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Expand incident map" }).click();
  const map = page.getByRole("region", {
    name: "Interactive incident map",
    exact: true,
  });
  const box = (await map.boundingBox())!;
  const session = await context.newCDPSession(page);
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  const touch = (distance: number) => [
    { x: x - distance, y, id: 0 },
    { x: x + distance, y, id: 1 },
  ];
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: touch(30),
  });
  for (const distance of [40, 50, 65, 80])
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: touch(distance),
    });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(async () =>
      Number(
        await page
          .getByRole("dialog")
          .locator(".map-contents")
          .getAttribute("data-map-zoom"),
      ),
    )
    .toBeGreaterThan(11);
  await expect(
    page.getByRole("dialog").locator(".map-location-note"),
  ).toContainText("30.2000, -90.6500");
  await context.close();
});
