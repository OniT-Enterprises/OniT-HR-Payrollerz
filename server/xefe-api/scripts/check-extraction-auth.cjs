#!/usr/bin/env node
/**
 * Is document extraction still able to authenticate?
 *
 * Extraction runs on a Claude Code **subscription** OAuth token
 * (CLAUDE_CODE_OAUTH_TOKEN), not a metered API key, and those expire or get
 * revoked. When that happens every bill, receipt and attendance upload fails —
 * and nothing notices until a customer reports it, because the failure is a 502
 * on a path no health check exercises.
 *
 * This runs the smallest real extraction there is: a two-line table through
 * extractTableRows(), which walks the same path as an upload (token -> SDK ->
 * claude CLI) without needing a file, an HTTP request or Firebase auth.
 *
 *   node scripts/check-extraction-auth.cjs
 *
 * Exit 0 = extraction works. Exit 1 = it does not, with the reason on stderr.
 * Never prints the token or any document content.
 */
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { extractTableRows } = require(path.resolve(__dirname, '..', 'extract'));

// Deliberately trivial and synthetic — no customer data in a monitoring probe.
const PROBE_TABLE = [
  'Employee\tDate\tClock In\tClock Out',
  'Probe Worker\t01/07/2026\t08:00\t17:00',
].join('\n');

const TIMEOUT_MS = Number(process.env.EXTRACTION_PROBE_TIMEOUT_MS) || 120_000;

async function main() {
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    console.error('FAIL: CLAUDE_CODE_OAUTH_TOKEN is not set — extraction cannot run at all.');
    process.exit(1);
  }

  const started = Date.now();
  const timeout = setTimeout(() => {
    console.error(`FAIL: no response in ${Math.round(TIMEOUT_MS / 1000)}s.`);
    process.exit(1);
  }, TIMEOUT_MS);
  timeout.unref();

  let rows;
  try {
    rows = await extractTableRows(PROBE_TABLE, 'attendance');
  } catch (error) {
    clearTimeout(timeout);
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL: extraction threw after ${Math.round((Date.now() - started) / 1000)}s: ${message}`);
    console.error('If this mentions auth, usage limits or an empty response, the OAuth token '
      + 'has most likely expired — replace CLAUDE_CODE_OAUTH_TOKEN in /opt/xefe-api/.env and '
      + 'restart with `pm2 restart xefe-api`.');
    process.exit(1);
  }
  clearTimeout(timeout);

  const seconds = Math.round((Date.now() - started) / 1000);
  // The model answered; whether it parsed this tiny table perfectly is not the
  // point of an auth probe, so an empty array still counts as reachable.
  console.log(`OK: extraction answered in ${seconds}s (${rows.length} row(s) normalised).`);
  process.exit(0);
}

main().catch((error) => {
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
