import { test, expect } from "@playwright/test";
import { mockMapTiles } from "./fixtures/tiles";
test.beforeEach(async ({ page }) => {
  await mockMapTiles(page);
});

test("admin sign-in gates deep links and offers only explicit Admin simulation access", async ({
  page,
}) => {
  await page.goto("/#/map/R4-004");
  await expect(
    page.getByRole("heading", { name: "Admin sign-in", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#\/sign-in$/);
  await expect(
    page.getByRole("button", { name: "Sign in as admin", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "Incident map", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await expect(
    page.getByRole("link", {
      name: /sign up|register|caller access|responder view/i,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Admin simulation is a frontend demo gate.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Enter Admin simulation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Incident map", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".gis-selected")).toContainText("R4-004");
  await expect(page.locator(".simulation")).toContainText("Admin simulation");
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }).getByRole("link"),
  ).toHaveCount(6);
  await expect(
    page.getByRole("link", { name: "Responder view", exact: true }),
  ).toHaveCount(0);
});

test("legacy responder URL routes to admin management and demo acknowledgement remains explicit", async ({
  page,
}) => {
  await page.goto("/#/responder");
  await page
    .getByRole("button", { name: "Enter Admin simulation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Responder management", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#\/responders$/);
  await expect(
    page.getByRole("heading", { name: "Your assignment", exact: true }),
  ).toHaveCount(0);
  await page
    .locator(".unit-grid .panel")
    .filter({
      has: page.getByRole("heading", { name: "Rescue 04", exact: true }),
    })
    .getByRole("button", { name: "Review assignment", exact: true })
    .click();
  const review = page.getByRole("region", {
    name: "Admin assignment review",
    exact: true,
  });
  await expect(review).toContainText("Awaiting responder acknowledgement");
  await expect(review.locator(".map-location-note")).toContainText(
    "Exact location unknown",
  );
  await page
    .getByRole("button", {
      name: "Demo: simulate acknowledgement",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Demo acknowledgement recorded",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(review.locator(".unit-meta")).toContainText(
    "Travel statusUnknown",
  );
  await page.getByRole("link", { name: "Activity", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Demo acknowledgement simulated",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".timeline")).toContainText(
    "Demo admin simulated receipt",
  );
});

test("exiting simulation removes the demo session and unrecognized local role claims do not create an admin session", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("role", "admin");
    sessionStorage.setItem("role", "admin");
  });
  await page.goto("/#/incidents/R4-001");
  await expect(
    page.getByRole("heading", { name: "Admin sign-in", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Enter Admin simulation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Incident details", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Exit Admin simulation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Admin sign-in", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("relay4.admin-simulation"),
    ),
  ).toBeNull();
  await page.goto("/#/calls");
  await expect(
    page.getByRole("heading", { name: "Admin sign-in", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".transcript")).toHaveCount(0);
});

test("admin-mode adapter fixture exposes receipt status without a simulated acknowledgement action", async ({
  page,
}) => {
  await page.route("**/src/auth/adminAuth.ts*", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const replaced = body.replace(
      /export const adminAuth = createSimulationAdminAuth\(browserSessionStorage\(\)\);/,
      `export const adminAuth={productionSignInAvailable:true,getAdminSession:async()=>({userId:'test-server-admin',displayName:'Test admin',mode:'admin'}),signInAdmin:async()=>({userId:'test-server-admin',displayName:'Test admin',mode:'admin'}),enterAdminSimulation:async()=>({userId:'demo',displayName:'Demo admin',mode:'simulation'}),signOut:async()=>{}};`,
    );
    expect(replaced).not.toBe(body);
    await route.fulfill({
      response,
      body: replaced,
      contentType: "text/javascript",
    });
  });
  await page.goto("/#/responders");
  await expect(
    page.getByRole("heading", { name: "Responder management", exact: true }),
  ).toBeVisible();
  await page
    .locator(".unit-grid .panel")
    .filter({
      has: page.getByRole("heading", { name: "Rescue 04", exact: true }),
    })
    .getByRole("button", { name: "Review assignment", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Admin assignment review" }),
  ).toContainText("Awaiting responder acknowledgement");
  await expect(
    page.getByRole("button", {
      name: /simulate acknowledgement|acknowledge assignment/i,
    }),
  ).toHaveCount(0);
});

test("mobile admin sign-in and navigation fit without public roles", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Admin sign-in", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/relay4-admin-sign-in-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Enter Admin simulation", exact: true })
    .click();
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await expect(
    page.getByRole("link", { name: "Responder view", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Responders", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Responder management", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
