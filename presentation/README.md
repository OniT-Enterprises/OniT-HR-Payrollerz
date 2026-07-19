# Hotel Esplanada — Website & Booking-System Video

An explainer video for the **Hotel Esplanada owner + front-desk staff** (non-technical),
covering what we built, why it's better, and how the booking system works end to end —
from a guest booking on **hotelesplanada.com** through to the reservation landing in the
**Rezerva PMS** booking calendar. English, narrated in the same "Alice" voice as the
Timor-Leste tourism video.

Same 3-stage pipeline as `../` (the minister video), re-skinned to the Hotel Esplanada
brand (navy `#214569` + amber `#F59E0B`, Aclonica headings) and pointed at different sites.

```
vo-lines.txt ─▶ generate-audio.mjs ─▶ audio/scene-NN.mp3        (ElevenLabs "Alice")
hotelesplanada.com + pms.rezerva.tl ─▶ capture.mjs ─▶ recordings/<scene>/*.webm  (Playwright)
                                                    │
assets/seo-stats.html ──────────────────────────────┤  (the "Found on Google" scene)
                                                    ▼
                    render.mjs ─▶ presentation-esplanada-en.mp4  (ffmpeg: audio+recordings+cards+music+xfades)
                    qa.mjs      ─▶ pass/fail gate + tmp/qa/*.png contact sheets
```

## Quick start

```bash
# 1. Voiceover (needs ELEVENLABS_API_KEY, or the media-monitor .env.local a few dirs up)
node generate-audio.mjs

# 2a. Website + booking-widget scenes (public, no login)
node capture.mjs --only=web

# 2b. PMS scenes (need the PMS login — email+password, NOT Google SSO)
PMS_EMAIL='admin@hotel.com' PMS_PASSWORD='...' HEADLESS=false node capture.mjs --only=pms

# 2c. The live test booking (creates ONE real booking so it shows in the PMS queue)
HEADLESS=false node capture.mjs --scene=05-booking --book-live

# 3. Assemble + QA
node render.mjs
node qa.mjs --open
```

Browsers: reuses the parent `presentation/`'s Playwright. If missing:
`npx playwright install chromium chromium-headless-shell`.

## Scenes

| # | Scene | Source | Type |
|---|-------|--------|------|
| 0 | Intro card | — | card (navy) |
| 1 | The old way (commission problem) | — | card |
| — | *Your New Website* | — | interstitial |
| 2 | Homepage tour | hotelesplanada.com | recording |
| — | *Found on Google* | — | interstitial |
| 3 | SEO stats | `assets/seo-stats.html` | recording |
| — | *Five Languages* | — | interstitial |
| 4 | Language flip (en/pt/tet/zh/id) | hotelesplanada.com | recording |
| — | *Book Direct* | — | interstitial |
| 5 | Booking flow (dates→room→details→pay→confirm) | /book/hotel-esplanada | recording |
| — | *Into Your Front Desk* | — | interstitial |
| 6 | "Awaiting Reception" queue | pms.rezerva.tl | recording |
| 7 | Assign room + booking calendar | pms.rezerva.tl | recording |
| 8 | Check-in (passport / signature / reg card) | pms.rezerva.tl | recording |
| — | *Everything in One Place* | — | interstitial |
| 9 | POS / tasks / finances / night audit | pms.rezerva.tl | recording |
| 10 | Close card ("Powered by Rezerva · Built by OniT") | — | card |

## Facts baked into the script (verified)

- **SEO (Google Search Console, hotelesplanada.com, ~Apr–Jul 2026):** 6,866 impressions,
  221 clicks, avg position 8.4 (trending to 5–7); `hotel esplanada dili` pos ~2.
  Visitors from Timor-Leste, Australia, Singapore, USA, UK, Indonesia. Site indexed ~April 2026.
- Rooms from **$80/night**, breakfast included; **direct price = Booking.com − $2**.
- Established **1972**. OTA commission cited as **15–18%**.
- Booking reference codes are real: `ESP-<nights>-WB-<seq>` (WB = website channel).

## Gotchas / notes

- **PMS login is email+password only for automation.** Google/Apple SSO fails in a
  controlled browser ("Couldn't sign you in — browser may not be secure"). Use the
  `#email` / `#password` form.
- **Live test booking doesn't work via automation.** Cloudflare **Turnstile** on the
  booking submit refuses controlled browsers (same as Google SSO), so `--book-live`
  can't complete the submit — scene 5 therefore ends on the clean "availability
  request" review screen (accurate: it IS a request, not an instant booking). To show
  a booking in the PMS queue, use a real booking already in the system. This build
  features the owner-created **"test tino"** booking (a real website booking →
  Awaiting/Confirmed), shown via its calendar tooltip ("via website").
- The PMS account (`admin@hotel.com`) is the **super-admin** over all hotels; the
  current hotel is pinned to `hotel-esplanada` via `localStorage['hotel-state']`
  (seeded in `capturePms`). PMS runs in **dark theme**.
- **Cold Firestore load** (~5–20s) is trimmed off the front of each PMS clip:
  each PMS scene returns a `contentStart` offset and `capturePms` `-ss`-trims it,
  padding the content to the VO window. Do NOT click the List/Calendar **view
  toggles** — they trigger a second cold re-query that the front-trim can't remove.
- **Known cosmetic QA fail:** scene 5 (booking) reports a white page-load lead-in
  (the widget UI is white). It is fully absorbed by the 0.4s crossfade from the
  "Book Direct" chapter card — not visible in the final.
- PMS scene routes in `capture.mjs` (`/rooms/bookings`, `/pos`, `/finances`,
  `/rooms/night-audit`, …) are best-effort; verify/adjust against the live nav.
- Recordings speed-fit to the VO in `render.mjs`; keep scripted actions within each
  scene's VO window (see `durationFor`) so nothing plays too fast.

Gitignored outputs: `audio/`, `recordings/`, `tmp/`, `*.mp4`.
