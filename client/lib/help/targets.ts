/** Stable guide destinations used when a statutory export cannot continue. */
export function statutoryReviewHelpPath(source: "payroll" | "employer") {
  return source === "employer"
    ? "/help/guide/getting-started#first-run-setup"
    : "/help/guide/running-payroll#before-you-run";
}
