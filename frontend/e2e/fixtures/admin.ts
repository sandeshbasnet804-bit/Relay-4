import { expect, type Page } from "@playwright/test";
export async function enterAdminSimulation(page: Page) {
  await page.goto("/#/sign-in");
  await page
    .getByRole("button", { name: "Enter Admin simulation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dispatch overview", exact: true }),
  ).toBeVisible();
}
