import { enterAdminSimulation } from "./fixtures/admin";
import { test, expect } from "@playwright/test";
import { mockMapTiles } from "./fixtures/tiles";
test.beforeEach(async ({ page }) => {
  await mockMapTiles(page);
  await enterAdminSimulation(page);
});

test("dispatcher corrections, approval, responder receipt and history stay consistent", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Dispatch overview" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open incident details" }).click();
  await page
    .getByRole("combobox", { name: "Field", exact: true })
    .selectOption("hazards");
  await page.getByLabel("Corrected value").fill("Unknown");
  await page
    .getByLabel("Evidence or reason")
    .fill("CALL-002 does not verify the water report.");
  await page.getByRole("button", { name: "Save correction" }).click();
  await expect(page.getByRole("status")).toContainText("Correction saved");
  await expect(
    page.getByRole("button", { name: "Approve assignment" }),
  ).toBeDisabled();
  await page
    .getByRole("combobox", { name: "Responder unit", exact: true })
    .selectOption("U07");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Approve assignment" }).click();
  await page.getByRole("button", { name: "Review assignment" }).click();
  await expect(
    page.getByRole("combobox", { name: "Review unit", exact: true }),
  ).toHaveValue("U07");
  await expect(page.locator(".hazard-notice")).toContainText("Unknown");
  await page
    .getByRole("button", { name: "Demo: simulate acknowledgement" })
    .click();
  await expect(
    page.getByRole("button", { name: "Demo acknowledgement recorded" }),
  ).toBeDisabled();
  await expect(
    page.locator(".admin-assignment-review .unit-meta"),
  ).toContainText("Travel statusUnknown");
  await page.getByRole("link", { name: "Activity", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Demo acknowledgement simulated" }),
  ).toBeVisible();
  await expect(
    page.getByText("CALL-002 does not verify the water report.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Responders", exact: true }).click();
  await expect(
    page
      .locator(".panel")
      .filter({ has: page.getByRole("heading", { name: "Engine 07" }) }),
  ).toContainText("Acknowledged");
});

test("queue search, review filters, selection, call review, transcripts and links", async ({
  page,
}) => {
  await page.goto("/");
  const search = page.getByRole("textbox", {
    name: "Search incidents, locations, and hazards",
  });
  await search.fill("Bayou Oak Lane");
  await expect(page.locator(".incident-row")).toHaveCount(1);
  await page.locator(".incident-select").click();
  await expect(page.locator(".summary")).toContainText("Road blocked");
  await page.getByRole("button", { name: "Clear search" }).click();
  await page.getByRole("button", { name: "Needs review", exact: true }).click();
  await expect(page.locator(".incident-row")).toHaveCount(3);
  await page.getByRole("button", { name: "Open incident details" }).click();
  await page
    .locator(".related-row")
    .filter({ hasText: "CALL-002" })
    .getByRole("button", { name: "Link here" })
    .click();
  await expect(page.getByRole("status")).toContainText("Call linked");
  await page.getByRole("link", { name: "Calls", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Call records" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Incident", exact: true })
    .selectOption("R4-002");
  await expect(page.locator(".call-card")).toHaveCount(2);
  await page
    .locator(".call-card")
    .filter({ hasText: "CALL-002" })
    .getByRole("button", { name: /Open linked incident/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Road blocked", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.locator(".incident-row")).toHaveCount(3);
  await search.fill("no matching location");
  await expect(
    page.getByText("No incidents match these filters."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".incident-row")).toHaveCount(3);
});

test("mobile navigation and responder layout remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
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
    page.getByRole("button", { name: "Demo: simulate acknowledgement" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/relay4-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("desktop overview renders without overflow or browser errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator(".incident-row")).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/relay4-dashboard.png", fullPage: true });
  expect(errors).toEqual([]);
});
