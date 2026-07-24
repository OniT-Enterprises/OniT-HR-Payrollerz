# Xefe flagship presentation video

This is the short, customer-facing cut. It complements the comprehensive tour
in the parent directory rather than replacing it.

The edit follows one business workflow:

1. see what needs attention;
2. keep people and time together;
3. run payroll;
4. trace the Timor-Leste calculation engine;
5. prepare filings and bank payments;
6. keep one set of books;
7. use Xefe on a phone and in the customer's language;
8. close on trust and one clear action.

Target runtime: **2:10–2:30**. There are no chapter interstitials. Product
footage starts on the first frame, captions are supplied as an optional sidecar
file, and desktop footage is cropped cleanly to the active work area so it
remains readable on a phone. The calculation-engine scene is a local motion
graphic built from the engine-exact synthetic worked example documented in
`docs/PUBLIC_SITE.md`; it does not record the public landing page.

## Build

Run from `presentation/`:

```bash
npm run audio:flagship
npm run capture:flagship
npm run render:flagship
npm run qa:flagship
```

Useful partial capture:

```bash
node flagship/capture.mjs --shot=payroll,bank
```

After a full render, rebuild selected scenes and reassemble the delivery files:

```bash
node flagship/render.mjs --scene=4,6
```

Outputs (gitignored):

- `presentation-xefe-flagship-en.mp4` — 1080p master
- `presentation-xefe-flagship-en-web.mp4` — 720p, lower-bandwidth delivery
- `presentation-xefe-flagship-en.srt` — optional sidecar captions
- `flagship/tmp/qa/contact-sheet.png` — visual QA sheet

The capture targets `https://app.xefe.tl` for authenticated product screens and
`https://xefe.tl/engine` for the public calculation proof page. Override with
`XEFE_APP_URL` or `XEFE_PUBLIC_URL` when needed.
