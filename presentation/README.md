# Xefe — Product Video (comprehensive cut, v4)

For the short 2:18 customer-facing cut, see
[`flagship/README.md`](flagship/README.md).

A full product tour for **Timor-Leste business owners** (non-technical), narrated in
English by ElevenLabs "Alice" ("Xefe" is spoken *Sheffy*). Covers every module —
dashboard, people, hiring, time & leave, shifts, the payroll wizard, approval &
payslips, **the engine story** (/engine page), tax filing, bank pack, invoices,
bills & expenses, accounting, reports, XefeBot, mobile, languages — plus trust and
pricing cards. ~6 minutes.

Same 3-stage pipeline as the Esplanada/minister videos, pointed at the live app
with the **demo tenant** (Kafé Knua Dili — a FICTIONAL café; never use real Dili business names in demo data).

```
vo-lines.txt ─▶ generate-audio.mjs ─▶ audio/scene-NN.mp3          (ElevenLabs "Alice")
xefe.tl (demo login) ─▶ capture.mjs ─▶ recordings/<scene>/page.webm  (Playwright recordVideo)
localhost:8080/engine ──────┘             (engine scene, until /engine is deployed)
                                              │
              render.mjs ─▶ presentation-xefe-en.mp4   (ffmpeg: cards+chapters+xfades+music)
              qa.mjs      ─▶ pass/fail gate + tmp/qa/*.png contact sheets
```

## Quick start

```bash
# 0. Credentials: presentation/.env (gitignored, loaded by env.mjs) with
#    XEFE_EMAIL=demo@xefe.tl
#    XEFE_PASSWORD=…            (see scripts/seed-demo-tenant.mjs)

# 1. Demo data (idempotent; needs ../service-account.json)
node prep-demo-data.mjs        # subscription, self-approval, advancedTax, July attendance
node prep-demo-data-2.mjs      # jobs+candidates, shifts, leave, expenses (small pass)
node prep-demo-data-3.mjs      # compliance docs + bank details
node prep-demo-data-4.mjs      # THE FULL SEED: 30 staff, customers, 12 invoices,
                               # 14 expenses, matching journals+GL, café renamed
node prep-demo-ui-2.mjs        # runs+finalizes June payroll for all 30 via the client

# 2. Voiceover (ELEVENLABS_API_KEY, falls back to media-monitor .env.local)
node generate-audio.mjs

# 3. Capture (dev server must be running for the engine scene: pnpm dev in ../)
node capture.mjs                                   # all scenes
node capture.mjs --scene=07-runpayroll             # one scene
node capture.mjs --scene=05-timeleave,06-shifts    # several

# 4. Assemble + QA
node render.mjs
node qa.mjs --open
```

## Scenes (VO numbers; chapters are silent interstitials in the 100s)

| # | Scene | Source |
|---|-------|--------|
| 0 | Intro card (wordmark) | card |
| 1 | The problem | card |
| 2 | Dashboard (+ typing to XefeBot) | rec |
| 3 | People / employee profile | rec |
| 4 | Hiring pipeline (2 jobs, 5 candidates) | rec |
| 5 | Attendance (Previous → last worked day) + pending leave | rec |
| 6 | Shift grid (NEXT week — seeded Jul 20–25) | rec |
| 7 | Run-payroll wizard (ticks compliance box; never finalizes) | rec |
| 8 | Paid June run (filter → Paid) + payslips | rec |
| 9 | **The engine page** (localhost /engine) | rec |
| 10 | Tax & INSS filing (advancedTax on; generates the WIT return) | rec |
| 11 | Bank Files dialog (June run, BNU) | rec |
| 12 | Invoices: actions menu + detail | rec |
| 13 | Expenses + new-bill withholding | rec |
| 14 | Payroll journal expanded + trial balance (Generate) | rec |
| 15 | Reports hub → payroll reports | rec |
| 16 | XefeBot live answer (over-records; render speed-fits) | rec |
| 17 | Mobile 390×844 (pillarboxed) | rec |
| 18 | Language flip EN→TET→PT | rec |
| 19 | Trust card (controls) | card |
| 20 | Close card ($4/employee · xefe.tl) | card |

## Gotchas / notes

- **Never finalize payroll or send anything during capture.** The wizard scene
  stops at review; the June run was finalized once, deliberately, by
  `prep-demo-ui.mjs` (self-approval + manual subscription were enabled by
  `prep-demo-data.mjs` — Admin SDK, demo tenant only).
- The approve dialog runs an async *allocation pre-check* and needs its
  "post as Unassigned" checkbox ticked before **Approve & Process** enables.
  The payroll wizard's employee step has a similar compliance checkbox.
- **Modern headless Chrome records the app shell fine** (the old blank-screencast
  problem is gone — verified in `tmp/probe.mjs`). Each scene is a real
  recordVideo clip; the SPA cold-boot lead-in is measured per scene and trimmed
  in capture.
- **In-scene navigation must use `navSPA()`** (pushState + popstate), never
  `page.goto()` — a full reload puts the splash screen in the middle of the
  recording.
- Scene clips should be a touch LONGER than their VO; render.mjs speed-fits.
- Engine scene: `/engine` isn't deployed yet — capture points at the local dev
  server (`ENGINE_URL`, default `http://localhost:8080`). Switch to
  `https://xefe.tl` once deployed.
- The demo tenant's "Finish setup" banner is hidden by `hideSetupBanner()`;
  don't complete setup for real — the 20% state is part of the fixture.
- Attendance is seeded for all 30 staff Mon–Sat + a Sunday crew, so "today" is never
  empty; the attendance scenes still click **Previous** once for a fuller day.
- Re-seeding (`../scripts/seed-demo-tenant.mjs`) wipes employees/shifts/etc. —
  re-run all three prep scripts afterwards, and expect a NEW pending June run
  to need approving again.

Gitignored outputs: `audio/`, `recordings/`, `tmp/`, `*.mp4`, `.env`.
