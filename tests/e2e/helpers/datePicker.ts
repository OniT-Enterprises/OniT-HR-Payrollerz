/**
 * Driving the app's DatePicker from Playwright.
 *
 * The product no longer uses <input type="date"> anywhere — its popup ignores
 * our theme, its targets are small, and its MM/DD/YYYY segments are ambiguous
 * for readers of Tetun and Portuguese. So a test cannot `.fill()` a date; it
 * has to open the popover and pick the day, like a user.
 *
 * Two stable hooks make that deterministic, because the accessible names are
 * localized prose and therefore not addressable across locales:
 *   - `[data-datepicker="YYYY-MM-DD"]` on the trigger, carrying its value
 *   - `[data-date="YYYY-MM-DD"]` on every day button in the calendar
 */
import { expect, type Locator, type Page } from "@playwright/test";

/** How many months we are willing to page through before giving up. */
const MAX_MONTH_STEPS = 36;

/**
 * Pick `iso` (YYYY-MM-DD) in the DatePicker opened by `trigger`.
 *
 * Day lookups are scoped to the OPEN popover. A page-wide `[data-date]` lookup
 * is wrong: several pickers can be on screen, and their calendars can render
 * the same day, so a global locator cannot tell whose calendar it found.
 */
export async function pickDate(
  page: Page,
  trigger: Locator,
  iso: string,
): Promise<void> {
  // react-day-picker's single mode TOGGLES: clicking the already-selected day
  // deselects it and leaves the popover open. Nothing to do in that case.
  if ((await trigger.getAttribute("data-datepicker")) === iso) return;

  await trigger.click();

  // Radix renders popover content in a portal; the most recently opened one
  // is ours.
  const popover = page.locator("[data-radix-popper-content-wrapper]").last();
  await expect(popover).toBeVisible({ timeout: 5_000 });

  const day = popover.locator(`[data-date="${iso}"]`);
  const target = Date.parse(`${iso}T00:00:00Z`);

  for (let step = 0; step < MAX_MONTH_STEPS; step += 1) {
    if (await day.count()) break;

    const shown = await popover
      .locator("[data-date]")
      .first()
      .getAttribute("data-date");
    if (!shown) throw new Error("Calendar rendered no days");

    const forward = Date.parse(`${shown}T00:00:00Z`) < target;
    await popover
      .getByRole("button", { name: forward ? /next/i : /previous/i })
      .click();
  }

  await expect(day).toHaveCount(1, { timeout: 5_000 });
  await day.click();

  // Confirm the pick landed rather than assuming the popover unmounted.
  await expect(trigger).toHaveAttribute("data-datepicker", iso, {
    timeout: 5_000,
  });
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
