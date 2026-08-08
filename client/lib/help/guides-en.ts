/**
 * Operational guides, English.
 *
 * These have a different reader from the law-positions article. That one is
 * for an accountant checking our arithmetic; these are for the person running
 * the business — first-time software user, on a phone, usually not an
 * accountant, and usually stuck mid-task when they open them.
 *
 * ONE RULE holds all of them together: describe what is TRUE, never where to
 * click. "Press Next, then Next, then Finish" rots the moment a button moves,
 * and it rots SILENTLY — no test fails, no build breaks, the doc just starts
 * lying. Deadlines, the order operations must happen in, and what the law
 * requires do not move when we redesign a screen.
 */
import type { HelpArticle } from "./content";

export const MONTH_EN: HelpArticle = {
  slug: "your-month",
  kind: "guide",
  locale: "en",
  updated: "2026-08-08",
  title: "Your month, start to finish",
  summary:
    "Payroll in Timor-Leste is a monthly rhythm with two government deadlines in it. This is the whole cycle, in the order it has to happen.",
  keywords: [
    "monthly",
    "cycle",
    "deadline",
    "INSS",
    "WIT",
    "declaration",
    "DR",
    "filing",
    "approve",
  ],
  intro: [
    "Every month has the same shape. Once you have seen it once, nothing in Xefe is a surprise.",
    "Two of these steps have legal deadlines and the rest do not. The deadlines are what this page is really for — miss one and it costs money, and neither government office will remind you.",
  ],
  groups: [
    {
      id: "each-month",
      heading: "Every month",
      blurb: "In this order. Each step needs the one before it.",
      entries: [
        {
          id: "record-differences",
          heading: "1. Record what was different",
          body: [
            "You do not need to record that people came to work. Xefe assumes everyone worked their normal month and pays them in full — which is both what the law asks for and what is true on most days.",
            "What you record is the exceptions: someone was away, someone worked extra. Timor-Leste law wants exactly those two things — a register of justified and unjustified absences, and a register of overtime start and end times.",
          ],
          when: "Any time during the month. Easiest as it happens.",
        },
        {
          id: "run-payroll",
          heading: "2. Run the payroll",
          body: [
            "Xefe works out gross pay, the wage income tax to withhold, both social-security contributions, and what actually lands in each person's hands.",
            "You can change any figure before you submit it. If you do, Xefe marks that person as manually adjusted so the person approving can see it — a changed number should never look like a computed one.",
          ],
          when: "Once your absences and overtime for the month are in.",
        },
        {
          id: "approval",
          heading: "3. Somebody else approves it",
          body: [
            "The person who prepares a payroll cannot be the person who approves it. This is not a Xefe preference — it is enforced in the database, so nobody can work around it by using a different screen.",
            "It exists because payroll is the easiest money in any business to divert, and a second pair of eyes is the control that catches it. If you are a one-person business, you can be granted permission to approve your own runs — but that is a decision you make deliberately, not a default.",
          ],
          when: "Before anyone is paid.",
        },
        {
          id: "pay-and-record",
          heading: "4. Pay everyone, then tell Xefe you did",
          body: [
            "Approving a run does not move money — you still pay by bank transfer or cash. What Xefe needs afterwards is that you confirm it happened.",
            "That confirmation is what closes the wages off in your books and turns the tax and social-security amounts into debts you owe the government, ready for the two filings below. Skip it and your accounts will show wages you never paid.",
          ],
          when: "As soon as people have their money.",
        },
        {
          id: "inss",
          heading: "5. Declare and pay social security (INSS)",
          body: [
            "Two separate things, with two separate dates: the declaration listing every worker and what they earned, then the payment of 4% withheld from each worker plus 6% from you.",
            "Xefe produces the declaration file for the INSS portal. It does not upload it and it does not pay — you do both.",
            "Late contributions carry interest of 1% for every month or part of a month.",
          ],
          when: "Declare in the first 10 days of the following month. Pay between the 10th and the 20th.",
        },
        {
          id: "wit",
          heading: "6. File and pay wage income tax",
          body: [
            "The tax you withheld from wages is not yours — you are holding it for the tax authority, and this is the month you hand it over.",
            "Xefe prepares the return and the figures. As with INSS, filing and paying are yours to do.",
          ],
          when: "By the 15th of the following month (Taxes and Duties Act, Sec. 23).",
        },
      ],
    },
    {
      id: "each-year",
      heading: "Once a year",
      blurb: "Two more dates, both easy to forget because they only come round once.",
      entries: [
        {
          id: "subsidio",
          heading: "The thirteenth month (subsídio anual)",
          body: [
            "Every worker is owed one extra month of salary a year. Somebody who has been with you less than a full year gets a proportional share, not nothing.",
            "It is a legal entitlement, not a bonus you choose to give.",
          ],
          when: "By 20 December (Labour Law, Art. 44).",
        },
        {
          id: "annual-tax",
          heading: "The annual income tax return",
          body: [
            "Xefe assembles the workings your accountant needs and keeps a record of who reviewed them.",
            "It does not produce the official form and it does not file it. Anything that says otherwise would be telling you a job is done when it is not.",
          ],
          when: "After year end, with your accountant.",
        },
      ],
    },
  ],
};

export const LEAVER_EN: HelpArticle = {
  slug: "when-someone-leaves",
  kind: "guide",
  locale: "en",
  updated: "2026-08-08",
  title: "When someone leaves",
  summary:
    "The rarest thing you will do and the easiest to get wrong. What a leaver is owed, what Xefe works out for you, and the one deadline that keeps charging you if you miss it.",
  keywords: [
    "termination",
    "resignation",
    "dismissal",
    "final pay",
    "severance",
    "leaver",
    "notice",
    "cessation",
  ],
  intro: [
    "Most of Xefe you use every month, so you get fluent. Final pay you might do twice a year — and it is the single largest payment you will ever make to one person.",
    "Xefe computes all of it. This page is so you can tell whether the number looks right, and so you do not miss the step that is not about money at all.",
  ],
  groups: [
    {
      id: "what-is-owed",
      heading: "What a leaver is owed",
      blurb:
        "Xefe works each of these out and puts them on the final payslip. They are entitlements, not gestures.",
      entries: [
        {
          id: "why-they-left",
          heading: "Start with the date and the reason",
          body: [
            "Everything below depends on these two facts, so they are the first thing Xefe asks for and the one thing you should not guess.",
            "Dismissal for serious misconduct is the only reason that removes the service compensation — and only when the process was properly followed: a written accusation, a chance to answer, and a formal decision. Xefe asks someone to confirm that actually happened rather than inferring it from a dropdown, because a dismissal that skipped those steps keeps the entitlement.",
          ],
        },
        {
          id: "untaken-leave",
          heading: "Annual leave they never took is paid in cash",
          body: [
            "Untaken days do not expire on the way out — they are converted to money on the final payslip.",
            "There is a separate rule worth knowing: if the worker was *prevented* from taking their leave, those days are paid at double. Leave they simply chose to defer carries no penalty. Xefe asks which it was; it never assumes you were at fault.",
          ],
        },
        {
          id: "service-compensation",
          heading: "Service compensation, for longer service",
          body: [
            "One month of salary for every five years worked. This is usually the largest line on the final payslip.",
            "Xefe counts complete five-year blocks, which is the smaller reading where the law is silent — seven years pays one month, not 1.4. That interpretation is set out in *Where Xefe takes a position on the law*, and it is worth a word with your accountant if the amount is large.",
          ],
        },
        {
          id: "thirteenth",
          heading: "A share of the thirteenth month",
          body: [
            "Somebody leaving in June has earned half a thirteenth month. It is paid out with the rest of the final pay rather than waiting for December.",
          ],
        },
        {
          id: "notice",
          heading: "Notice — worked or paid",
          body: [
            "Either they work their notice period or you pay it instead. In a redundancy the worker is also owed paid time off during that notice to look for other work.",
          ],
        },
      ],
    },
    {
      id: "the-trap",
      heading: "The step that is not about money",
      blurb:
        "Missing this one keeps costing you after the person has gone, and nothing on your screen will tell you.",
      entries: [
        {
          id: "declare-cessation",
          heading: "Tell INSS the employment ended",
          body: [
            "Until you declare it, **the employment is legally presumed to still exist** — and so are the contributions on it. Paying the person nothing changes that; the obligation follows the declaration, not the payslip.",
            "So an undeclared leaver quietly accrues contributions you owe, month after month, with 1% interest for each one.",
          ],
          when: "By the 10th of the month after they leave (DL 20/2017, Art. 5).",
        },
        {
          id: "paid-once",
          heading: "Each of these is paid exactly once",
          body: [
            "If a leaver's dates overlap two payroll runs, everything above could plausibly be paid twice — and it would look correct on both runs.",
            "Xefe blocks that: each final-pay entitlement is marked as settled the first time it is paid, and a second run over the same period will not pay it again.",
          ],
        },
      ],
    },
  ],
};

export const BOUNDARIES_EN: HelpArticle = {
  slug: "what-xefe-does-not-do",
  kind: "guide",
  locale: "en",
  updated: "2026-08-08",
  title: "What Xefe does not do",
  summary:
    "The jobs that are still yours, and the places Xefe deliberately stops instead of guessing. Worth reading once, because assuming a filing happened is the most expensive mistake available.",
  keywords: [
    "file",
    "filing",
    "submit",
    "upload",
    "portal",
    "payment",
    "register",
    "advice",
    "limits",
  ],
  intro: [
    "Software that quietly does *almost* the whole job is more dangerous than software that does half of it, because you find out at the wrong moment.",
    "So this page is the honest boundary. Nothing here is a gap we forgot — each one is either a job that is legally yours, or a place where guessing would cost you more than stopping does.",
  ],
  groups: [
    {
      id: "still-yours",
      heading: "Still yours to do",
      blurb:
        "Xefe prepares each of these completely. None of them is finished until you act.",
      entries: [
        {
          id: "no-filing",
          heading: "Xefe does not file anything with the government",
          body: [
            "It produces the INSS declaration file and the tax return figures, correct and ready. It does not log in to the INSS portal, and it does not submit to the tax authority.",
            "This is the one worth being clear about, because a generated file looks a lot like a filed one. If nobody uploaded it, nothing was filed — and the deadline passed anyway.",
          ],
        },
        {
          id: "no-payments",
          heading: "Xefe does not move money",
          body: [
            "No bank in Timor-Leste offers an interface that would let it. Salaries move when you make the transfer or hand over the cash.",
            "For a bank salary batch, Xefe assembles the pack the bank actually wants and a covering letter in Portuguese. Sending it and signing the payment order are yours.",
          ],
        },
        {
          id: "no-registration",
          heading: "Xefe does not register your business or enrol your workers",
          body: [
            "Company registration, your employer social-security number, tax numbers for you or your staff — all of those happen at the relevant office, not in here.",
            "Xefe records the numbers once they exist, and tells you when one is missing before it blocks something. It cannot obtain one for you.",
          ],
        },
      ],
    },
    {
      id: "refuses",
      heading: "Where Xefe stops on purpose",
      blurb:
        "In each of these, producing a confident number would be worse than producing none.",
      entries: [
        {
          id: "petroleum",
          heading: "It refuses payroll for a petroleum contractor",
          body: [
            "Employees of a party to a Petroleum Agreement are taxed under an entirely separate schedule, with different rates and a different desk. Xefe has not built that regime.",
            "Running them at ordinary rates would under-withhold — and the shortfall is legally the employer's to pay, not the worker's. So the wizard stops rather than computing something plausible.",
          ],
        },
        {
          id: "dismissal",
          heading: "It does not decide whether a dismissal was lawful",
          body: [
            "Whether a dismissal for cause removes the service compensation depends on whether a proper process happened: a written accusation, a real chance to answer, a formal decision.",
            "No dropdown can establish that. Xefe asks a named person to attest to it, and treats a dismissal that skipped those steps as keeping the entitlement.",
          ],
        },
        {
          id: "no-guessing",
          heading: "It does not guess when the law is genuinely unclear",
          body: [
            "Where the statute admits more than one reading, Xefe takes the conservative side — over-withholding rather than under, disclosing rather than inferring — and says so on the screen where it matters.",
            "Every one of those choices is written down in *Where Xefe takes a position on the law*, with the article it rests on, so your accountant can disagree with a specific sentence rather than with a total.",
          ],
        },
      ],
    },
    {
      id: "not-advice",
      heading: "And it is not advice",
      blurb:
        "The last boundary, and the one that matters most when the amounts are large.",
      entries: [
        {
          id: "professional-advice",
          heading: "Xefe is not your accountant or your lawyer",
          body: [
            "It applies Timor-Leste law as carefully as it can and shows its working — the article behind each rule, the amounts, and where it was unsure.",
            "That is meant to make a professional's job faster, not to replace it. For anything large or contested — a long-service payout, a dismissal, an audit — the figures here are a starting point for that conversation.",
          ],
        },
      ],
    },
  ],
};
