/**
 * Driving the app's DatePicker from Playwright.
 *
 * The product no longer uses <input type="date"> anywhere — its popup ignores
 * our theme, its targets are small, and its MM/DD/YYYY segments are ambiguous
 * for readers of Tetun and Portuguese. So a test cannot `.fill()` a date; it
 * has to open the popover and pick the day, like a user.
 *
 * Two stable hooks make that deterministic:
 *   - `[data-datepicker]` on the trigger button
 *   - `[data-date="YYYY-MM-DD"]` on every day button in the calendar
 * Both exist because the accessible names are localized prose and therefore
 * not addressable across locales.
 */
import { expect, type Locator, type Page } from "@playwright/test";

/** How many months we are willing to page through before giving up. */
const MAX_MONTH_STEPS = 36;

/**
 * Pick `iso` (YYYY-MM-DD) in the DatePicker opened by `trigger`.
 *
 * Pages the calendar towards the target month, then clicks the day. The
 * calendar is rendered in a portal, so days are located on the page rather
 * than inside the trigger's subtree.
 */
export async function pickDate(
  page: Page,
  trigger: Locator,
  iso: string,
): Promise<void> {
  await trigger.click();

  const day = page.locator(`[data-date="${iso}"]`);
  const target = Date.parse(`${iso}T00:00:00Z`);

  for (let step = 0; step < MAX_MONTH_STEPS; step += 1) {
    if (await day.count()) break;

    // Any rendered day tells us which month is on screen.
    const shown = await page.locator("[data-date]").first().getAttribute("data-date");
    if (!shown) throw new Error("Calendar rendered no days");

    const forward = Date.parse(`${shown}T00:00:00Z`) < target;
    await page
      .getByRole("button", { name: forward ? /next/i : /previous/i })
      .click();
  }

  await expect(day).toHaveCount(1, { timeout: 5_000 });
  await day.click();
  // The popover closes on select; wait for it so the next action is not
  // swallowed by the dismiss overlay.
  await expect(day).toHaveCount(0, { timeout: 5_000 });
}

/**
 * Convenience for the common "the Nth date field on this screen" case that
 * replaced `page.locator('input[type="date"]').nth(n)`.
 */
export async function pickNthDate(
  page: Page,
  scope: Page | Locator,
  index: number,
  iso: string,
): Promise<void> {
  await pickDate(page, scope.locator("[data-datepicker]").nth(index), iso);
}
