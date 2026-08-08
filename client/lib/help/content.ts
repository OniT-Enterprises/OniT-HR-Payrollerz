/**
 * In-app documentation.
 *
 * Deliberately NOT the public /docs section on xefe.tl. That one is marketing
 * surface and carries only settled statute, deadlines and product guarantees.
 * This one is for people who are already signed in and running payroll, so it
 * can be candid about the places Xefe had to READ the law rather than merely
 * apply it.
 *
 * Article bodies are authored data, not translated UI strings. The shell
 * around them (search, headings, empty states) is fully localized; a body is
 * served in the reader's language when it exists and falls back to English
 * otherwise, with a visible note. Machine-translating statutory analysis into
 * Tetun would produce confident-sounding text nobody has checked, which is
 * worse for this content than an honest English fallback.
 */

import { MONTH_EN, LEAVER_EN, BOUNDARIES_EN } from "./guides-en";
import { MONTH_PT, LEAVER_PT, BOUNDARIES_PT } from "./guides-pt";
import { MONTH_TET, LEAVER_TET, BOUNDARIES_TET } from "./guides-tet";

export type ArticleLocale = "en" | "pt" | "tet";

/** How settled a position is. Drives the badge and the search filter. */
export type PositionStatus =
  /** Xefe has taken a side and is waiting on a practitioner to confirm it. */
  | "confirming"
  /** Settled against a written source, and live in the product. */
  | "settled"
  /** Genuinely undecided; Xefe asks the operator rather than guessing. */
  | "asks-you";

export interface HelpEntry {
  id: string;
  heading: string;
  /** Positions articles only. A guide step has no "side" to be on. */
  status?: PositionStatus;
  /** The statutory text, quoted. Empty when the point is not textual. */
  quote?: string;
  quoteCite?: string;
  /** The reasoning, as paragraphs. */
  body: string[];
  /**
   * Guides only: the deadline, stated as a date rather than buried in prose.
   * These are the lines a reader is scanning for.
   */
  when?: string;
  /** What the product does right now — always stated, never implied. */
  today?: string;
  /** Money at stake, when there is any. */
  impact?: string;
  /** What remains unanswered. Absent for settled entries. */
  open?: string;
  /**
   * Words a reader might search that do not appear in the prose. The statute
   * says "compensação por tempo de serviço"; everyone types "severance". An
   * entry that only matches its own vocabulary is unfindable by the people it
   * was written for.
   */
  synonyms?: string[];
}

export interface HelpGroup {
  id: string;
  heading: string;
  blurb: string;
  entries: HelpEntry[];
}

export interface HelpArticle {
  slug: string;
  /**
   * `positions` — where Xefe reads the law, for the accountant checking us.
   * `guide` — how the work actually goes, for the owner doing it. Guides are
   * the ones that get translated: their reader is a Timor-Leste small
   * business, not a reviewer.
   */
  kind: "positions" | "guide";
  /** Which language THIS object is written in. */
  locale: ArticleLocale;
  /** ISO date of the last substantive edit. */
  updated: string;
  title: string;
  summary: string;
  /** Words that should match this article in search beyond its visible text. */
  keywords: string[];
  intro: string[];
  groups: HelpGroup[];
}

const LAW_POSITIONS: HelpArticle = {
  slug: "how-xefe-reads-the-law",
  kind: "positions",
  locale: "en",
  updated: "2026-08-08",
  title: "Where Xefe takes a position on the law",
  summary:
    "Timor-Leste's labour and tax statutes leave real questions open. This is every place Xefe had to choose a reading in order to compute a number — what it does, why, and what is still being confirmed.",
  keywords: [
    "severance",
    "justa causa",
    "INSS",
    "withholding",
    "WIT",
    "annual leave",
    "maternity",
    "minimum wage",
    "probation",
    "sick leave",
    "rest day",
    "childcare",
    "Art. 56",
    "Art. 32",
    "Art. 64",
    "Lei 4/2012",
    "Lei 8/2008",
    "DL 20/2017",
    "DL 18/2017",
  ],
  intro: [
    "Software that computes wages cannot be undecided. Every payslip needs one number, so wherever the statute is genuinely open to more than one reading, Xefe has had to pick one to be able to ship at all.",
    "This page lists those choices. It exists because the honest thing to do with an interpretation is to name it, not to let it disappear into a total.",
    "The general rule is that **where the answer was uncertain, Xefe took the conservative side** — over-withholding rather than under-withholding, disclosing rather than silently inferring, never auto-paying a contested amount.",
    "**But that is a tendency, not a guarantee, and one entry below is an exception worth your attention.** Excluding rest-day and holiday premiums from the social-security base lowers what you contribute, and if that reading is wrong the arrears are yours. Read that one properly rather than trusting the general rule.",
    "Where a number here is a **statutory minimum**, it says so. That distinction matters more than any single figure on this page: the Labour Code is a floor throughout, a contract may promise more, and what your contract says beats what the minimum says.",
    "The statutory text quoted here was read from clean Jornal da República copies. Where a reading has been confirmed by an independent Timor-Leste practitioner, it says so — and where it has not, the badge says \"confirming\" rather than \"settled\".",
  ],
  groups: [
    {
      id: "money",
      heading: "Questions that change what someone is paid",
      blurb:
        "These reach real amounts on a real payslip. If your accountant disagrees with any of them, that is worth telling us.",
      entries: [
        {
          id: "severance-cause",
          heading:
            "Does dismissal for cause remove the service compensation?",
          status: "confirming",
          quote:
            "Independentemente do motivo, em caso de cessação do contrato de trabalho o trabalhador tem direito a uma compensação por tempo de serviço no valor correspondente a 1 mês de salário por cada período de 5 anos de trabalho ao serviço do empregador.",
          quoteCite: "Lei 4/2012, Art. 56",
          body: [
            "Read alone, that sentence is unqualified: *regardless of the reason*. But Art. 23(4)(d) says a worker dismissed for just cause leaves \"sem qualquer indemnização ou compensação\", and the specific provision is normally taken to prevail over the general one.",
            "Xefe follows the second reading, on written advice from a Timor-Leste practitioner. But this is the largest single number on a final payslip, so it is worth asking twice rather than being wrong once.",
            "What Xefe will not do is infer the answer from a dropdown. \"Valid\" just cause means a written accusation, a right of defence and a formal decision — so Xefe asks a named reviewer to attest that the process actually happened. A procedurally defective dismissal keeps the entitlement.",
          ],
          synonyms: [
            "severance",
            "redundancy pay",
            "final pay",
            "dismissal",
            "termination",
          ],
          today:
            "Service compensation is withheld only when a reviewer attests to a valid just-cause process. Selecting a departure reason is never enough on its own.",
          impact: "One month of salary per completed five years of service.",
          open:
            "Whether Art. 23(4)(d) really does carve out Art. 56's \"independentemente do motivo\" — and whether Art. 55 sits on top of it in an unlawful-dismissal finding.",
        },
        {
          id: "severance-blocks",
          heading:
            "Is service counted in complete five-year blocks, or prorated?",
          status: "confirming",
          body: [
            "\"1 mês de salário por cada período de 5 anos\" does not say what happens to a partial final block. A worker with seven years has one complete block and two loose years.",
            "Statutes that intend proration usually say so, and this one is silent, which favours complete blocks. Four independent sources — two written advisories, an unrelated HR coordinator, and one real final payment — all state the rule per block. But every worked example anyone has produced has a tenure that is an exact multiple of five, where both readings give the same answer, so none of them actually settles it.",
          ],
          synonyms: ["severance", "final pay", "seniority", "long service"],
          today:
            "Complete blocks only — the smaller amount. Seven years pays one month, not 1.4.",
          impact:
            "On $600 a month and seven years of service: $600 under Xefe's reading, $840 under the prorated one.",
          open:
            "For a leaver with exactly seven years — one month, or 1.4? And does a partial final block count at all?",
        },
        {
          id: "inss-premiums",
          heading:
            "Are Sunday and public-holiday premiums inside the INSS base?",
          status: "confirming",
          body: [
            "This one moves for every business that opens on Sundays, so it matters most in hospitality.",
            "Xefe currently excludes these premiums, reading the doubled portion as overtime pay under DL 20/2017 Art. 9(c). **On the text of the statutes that reading is weak, and we say so because it is your money.**",
            "Art. 27 separates the two kinds of work rather than merging them: n.º 3 caps rest-day and holiday work at 8 hours a day, n.º 4 caps *trabalho extraordinário* at 4 hours a day and 16 a week, and n.º 5 refers to them as two distinct limits. If rest-day work simply *were* extraordinary work, the 8-hour allowance could never lawfully be used. The definition points the same way: Art. 5(y) defines *trabalho extraordinário* as work \"para além do período normal de trabalho\", which Art. 25(1) fixes at 8 hours a day and 44 a week — it turns on hours, not on which day of the week. And under Art. 30(2) your rest day may lawfully sit somewhere other than Sunday, so a worker can be on duty on a Sunday and still be well inside normal hours.",
            "Nor is there a tie-break in our favour. Art. 8(2)(f) brings in other supplements \"quando previstos em **disposição legal**, contrato ou de acordo coletivo\" — and Lei 4/2012 Art. 27(2) is exactly such a provision. It is a conditional inclusion, not a residual one, so the usual \"specific beats residual\" argument has nothing to operate on.",
          ],
          synonyms: ["sunday pay", "holiday pay", "double pay", "overtime", "social security"],
          today:
            "Premiums are excluded from the contribution base, and this is the setting most likely to change. Excluding them lowers this month's cost, but it is **not** the safe side: if the reading is wrong you owe the arrears, and in practice you would carry both the 6% employer and the 4% employee share, because you cannot lawfully recover the employee half out of wages already paid. It also lowers your worker's contributory record, which is what their INSS benefits are calculated from.",
          impact:
            "4% employee plus 6% employer on every premium hour. Structural rather than marginal for a seven-day business.",
          open:
            "Whether that is how it is actually declared on the monthly DR in practice. We are seeking written confirmation from INSS; until it arrives, treat the exclusion as provisional rather than settled.",
        },
        {
          id: "maternity-fallback",
          heading:
            "If a worker does not qualify for the INSS parental subsidy, does the employer have to pay?",
          status: "confirming",
          quote:
            "A atribuição dos subsídios depende de os beneficiários, à data do facto determinante da proteção, terem cumprido um prazo de garantia de seis meses civis, seguidos ou interpolados, com registo de remunerações nos últimos 12 meses.",
          quoteCite: "DL 18/2017, Art. 15(1)",
          body: [
            "Since DL 18/2017, INSS pays the parental subsidy at 100% of the reference wage directly to the worker, and the employer normally pays nothing during the leave. The question is what happens to a worker who misses that six-months-in-twelve test.",
            "Neither instrument creates an employer fallback. DL 18/2017 governs only the subsidy and says nothing about the employer. Lei 4/2012 Art. 61 conditioned the employer's duty on \"até ao estabelecimento do sistema de segurança social\" — a condition about the *system* existing, not about an individual qualifying. The system exists, so on the plain text the duty is spent for everyone, and a worker who misses the qualifying period is simply unprotected.",
            "Two related points from the same decree are worth knowing because they cost money quietly: the reference wage excludes the thirteenth month (Art. 18), and subsidies are only due from the first day of the month *following* the claim (Art. 19(1)) — so a late claim permanently loses months.",
          ],
          synonyms: ["maternity pay", "parental leave", "paternity", "birth"],
          today:
            "Employer-unpaid by default, with a note to confirm with your accountant. You can configure a paid percentage if you choose to pay anyway.",
          impact: "Up to twelve weeks of salary for an affected worker.",
          open:
            "Whether employers in practice pay regardless. If they do, this is a money default Xefe has wrong.",
        },
        {
          id: "working-week",
          heading:
            "Sunday is the default rest day — and the rest day itself is never optional",
          status: "confirming",
          quote:
            "1. O trabalhador tem direito a um período de descanso semanal remunerado de, no mínimo, 24 horas consecutivas. 2. O dia de descanso semanal só pode deixar de ser ao domingo quando o trabalhador preste trabalhos indispensáveis à continuidade de serviços que não podem ser interrompidos ou que tenham, necessariamente, de ser prestados ao domingo.",
          quoteCite: "Lei 4/2012, Art. 30(1)–(2)",
          body: [
            "Every worker is owed a paid weekly rest of at least 24 **consecutive** hours. Art. 30(2) lets you move which day that falls on, but only where the worker performs work indispensable to services that cannot be interrupted, or that must necessarily be done on a Sunday.",
            "A clinic ward or a security post is the clear case. Where a business could simply close on Sunday the ground is weaker — the article says the day may \"only\" move. **The statute names no industries**, so if you are relying on this, take advice rather than our list.",
            "Note also that Art. 30(2) attaches the test to **the worker**, not the business. Xefe's setting is company-wide, which is the coarser instrument.",
          ],
          synonyms: ["saturday", "sunday", "rest day", "working days", "six-day week"],
          today:
            "The company working week in Settings now drives BOTH leave duration and the double rest-day rate. Set your week and the premium follows your actual rest day. Two limits worth knowing: if your company works every day, Xefe will not guess which day is the rest day and leaves those hours at ordinary rate for you to enter by hand; and a five-day week still treats **Sunday** as the rest day and Saturday as an ordinary day off, because Art. 30(1) grants one rest period, not two.",
          open:
            "Art. 30(2) applies its test to \"o trabalhador\", so two people in one business can lawfully rest on different days. Xefe's working week is company-wide, so a per-employee rest day still needs entering on the payroll row by hand.",
        },
        {
          id: "leave-year",
          heading: "Is the leave year the calendar year, or the worker's own?",
          status: "confirming",
          quote:
            "O trabalhador tem direito a férias remuneradas por cada ano de trabalho prestado.",
          quoteCite: "Lei 4/2012, Art. 32(1)",
          body: [
            "\"Por cada ano de trabalho prestado\" — per year of work *rendered* — sounds like the employment anniversary. Xefe counts the calendar year, January to December.",
            "Over a full year the two agree on twelve days. They diverge for anyone hired mid-year, and the divergence reaches money at termination, because untaken leave is cashed out. Someone hired on 1 July who leaves the following 31 March has accrued three days on Xefe's reading; on an anniversary reading they are nine months into an incomplete cycle, and Art. 32(3) gives one day per month worked — nine days.",
            "In practice the earlier leave year has usually been taken or paid already, which is probably why this rarely surfaces.",
          ],
          synonyms: ["annual leave", "holiday", "vacation", "accrual"],
          today: "Calendar year, January to December.",
          impact:
            "Up to six days of pay on a mid-year hire who leaves early in the following year.",
          open:
            "Which basis Timor-Leste employers actually use, and whether a prior year's untaken balance carries into that calculation.",
        },
      ],
    },
    {
      id: "precision",
      heading: "Smaller amounts, same principle",
      blurb:
        "These are worth a few dollars, or nothing at all — but each is still a place where the software is guessing on your behalf.",
      entries: [
        {
          id: "wit-month",
          heading:
            "For the $500 resident exemption, is a \"month\" earned or paid?",
          status: "confirming",
          body: [
            "Xefe uses the wage-period month everywhere except one place, where the per-period slice of the $500 allowance is divided by the number of paydays falling in the *pay-date* month.",
            "With weekly Friday paydays, a June period paid on 3 July lands in a five-payday month, so June's income receives $475 of allowance instead of $500. The error is small and always in the over-withholding direction, so the worker is never short at year end — the excess comes back on assessment.",
          ],
          synonyms: ["income tax", "withholding", "tax free", "exemption", "WIT"],
          today:
            "As described. No code has changed, because the correct fix depends on the answer.",
          impact:
            "About $2.50 per affected employee-month, always over-withheld rather than under.",
          open:
            "Earned-month or paid-month? If earned, the divisor should key on the period month.",
        },
        {
          id: "job-search-credit",
          heading: "Does a partial week of notice earn the job-search credit?",
          status: "confirming",
          body: [
            "Art. 53(4) gives a paid credit of \"dois dias de trabalho por semana\" during a redundancy notice period. The statute does not address a trailing part-week.",
          ],
          today:
            "Complete weeks only, and the figure is labelled as a minimum — \"at least N days\" — rather than presented as final.",
          impact: "Up to two days' pay per redundancy leaver.",
          open:
            "Does a trailing partial week earn the two days, a pro-rata share, or nothing?",
        },
        {
          id: "minimum-wage",
          heading: "The $115 minimum wage — and whether it prorates",
          status: "asks-you",
          body: [
            "**We cannot point you at a law for this figure.** US$115 a month is the amount in use, set by a government decision in 2012, but we have not found it published as an instrument in the Jornal da República — the only official record we can cite is a government communique. Lei 4/2012 Art. 38(2) delegates the amount to \"o valor mínimo definido por lei\" and Art. 100(c) gives the national labour council the job of proposing it.",
            "Confirm the current figure with SEFOPE or your accountant before relying on it, particularly if you are close to the floor.",
            "The second question is what the floor applies to. Xefe enforces $115 a **month** as an absolute amount, which makes a genuinely part-time arrangement hard to process even where the hourly rate is well above minimum. We do not know whether the minimum is expressed monthly or hourly, and that is exactly what decides it.",
          ],
          synonyms: ["part time", "part-time", "wage floor", "SEFOPE"],
          today:
            "Absolute monthly floor, regardless of contracted hours. The figure is overridable in settings, which is the escape hatch if yours differs.",
          open:
            "Whether $115 is current, whether it is expressed monthly or hourly, and therefore whether it prorates for a part-timer.",
        },
        {
          id: "small-employer-inss",
          heading: "How are workers counted for the small-employer INSS rate?",
          status: "confirming",
          body: [
            "The reduced employer contribution rate turns on thresholds — a worker count and a percentage — but not on how those workers are counted. Heads, or full-time equivalents? And do foreign rotational workers count?",
            "This is all-or-nothing per company: the rate either applies to the whole payroll or none of it.",
          ],
          synonyms: ["social security", "contribution rate", "discount"],
          today:
            "Every employee on the run is counted as one head, full-time or not.",
          impact: "A contribution-rate change across every employee.",
          open:
            "Heads or full-time equivalents, and whether rotational foreign workers count toward the thresholds.",
        },
        {
          id: "sick-certificate",
          heading: "Is a medical certificate a condition of sick leave?",
          status: "confirming",
          quote:
            "O trabalhador pode igualmente faltar justificadamente ao trabalho por motivo de doença ou acidente, mediante a apresentação de atestado médico, até 12 dias por ano, dos quais 6 são remunerados por inteiro e os 6 dias restantes remunerados a 50 por cento do valor da remuneração diária.",
          quoteCite: "Lei 4/2012, Art. 33(4)",
          body: [
            "The pay banding — six days in full, six at half — is exactly what Xefe's engine computes, so no money turns on this.",
            "What is less obvious is \"mediante a apresentação de atestado médico\", which reads as a *condition* of the absence being justified rather than an employer option. Xefe used to offer a company toggle for the certificate; that toggle is gone and the requirement is now stated as law.",
          ],
          synonyms: ["doctor's note", "medical certificate", "illness"],
          today:
            "The certificate is required, but a sick day is never blocked for lack of one — Xefe records that a certificate is outstanding, because in practice it usually arrives after the absence has already started.",
          open:
            "Confirmation of the citation, and whether recording an outstanding certificate is the right posture or whether the absence should be blocked.",
        },
        {
          id: "leave-waiting-period",
          heading:
            "May a company make a new worker wait before taking annual leave?",
          status: "confirming",
          body: [
            "Xefe lets a company set a waiting period — three months by default — before a new worker may take annual leave, and the setting cites Art. 14.",
            "But Art. 14 probation runs 8, 15, 30 or 90 *days* depending on the category, so a three-month wait exceeds statutory probation for everyone except managerial staff. No provision has been found that permits deferring Art. 32 leave specifically.",
          ],
          synonyms: ["probation", "waiting period", "new hire"],
          today:
            "The setting exists, is badged as pending confirmation, and tells the owner to ask their accountant.",
          open:
            "Whether the practice is lawful, and under what provision. If it is not, the setting should be removed.",
        },
        {
          id: "childcare-floor",
          heading:
            "Is the five days for caring for a sick child a floor or a ceiling?",
          status: "confirming",
          quote:
            "Os trabalhadores com filhos menores de 10 anos têm direito a faltar ao trabalho, até ao limite máximo de 5 dias por ano, para prestar assistência, inadiável e imprescindível, em caso de doença ou acidente daquele, devendo apresentar justificação.",
          quoteCite: "Lei 4/2012, Art. 64(1)",
          body: [
            "Xefe reads \"limite máximo\" as capping what the *worker* may claim, which makes five days the minimum an *employer* must offer — the same direction as the twelve days of annual leave. Settings therefore warns when the figure is set below five and leaves it alone above.",
            "Art. 64(2) matters as much as 64(1): the absence \"determina **apenas** a perda de remuneração relativa aos dias em causa\". That *apenas* is the protection. The day costs its own pay and nothing further, so it is never taken out of annual leave and never recorded as an unjustified absence.",
          ],
          synonyms: ["sick child", "family", "parent", "dependant"],
          today:
            "Its own leave type: five days, unpaid, justification required, its own entitlement so it can never be netted off annual leave.",
          open:
            "Whether the floor reading is right — and whether \"filhos\" reaches adopted, fostered or dependent children of the household. Xefe does not ask who the child is, which is the permissive reading.",
        },
        {
          id: "worker-student-minor",
          heading:
            "May a young worker-student align leave with school holidays?",
          status: "asks-you",
          body: [
            "Art. 76(4) gives a worker-student who is a minor the right to line their annual leave up with the school holidays. Xefe implements Art. 76(3) — paid absence to sit exams — but has no concept of a worker-student at all, so nothing prompts this when leave is scheduled.",
            "Date of birth is already recorded, so the minor half would be free; the student half would be a new fact about the employee.",
          ],
          today: "Not implemented. Nothing prompts it.",
          open:
            "Whether employers here actually field this, or whether it is dormant in practice.",
        },
        {
          id: "identifiers",
          heading: "When are social-security and tax numbers actually required?",
          status: "confirming",
          body: [
            "Xefe lets you add an employee without their social-security number and chase it afterwards, because the form was previously unusable for a shop owner who did not have the card to hand. The monthly INSS declaration then refuses to generate for any employee still missing one, naming that employee.",
            "For individual tax numbers, the only identifier-conditional rule found anywhere in Timor-Leste law is in the petroleum regime, where the withholding rate depends on whether the worker has one. No domestic threshold was invented in its absence.",
          ],
          synonyms: ["NISS", "TIN", "tax number", "social security number", "enrolment"],
          today:
            "Both are optional at hire. The social-security number blocks the monthly declaration; the tax number blocks nothing and is collected behind a disclosure.",
          open:
            "Whether an individual worker tax number is ever mandatory for ordinary non-petroleum employment. (The INSS enrolment deadline is now settled: DL 20/2017 Art. 3(2) requires enrolment \"até à data de entrega da primeira declaração de remunerações que inclua o beneficiário\" — by the date you file the first declaration covering that worker. Xefe's wording was right.)",
        },
      ],
    },
    {
      id: "settled",
      heading: "Settled — and what changed because of it",
      blurb:
        "These were open and are now closed against a written source. They are listed because each one changed how Xefe computes something, and a correction here is more valuable than an answer to anything still open above.",
      entries: [
        {
          id: "leave-cash-out",
          heading: "Untaken annual leave is paid out in cash at termination",
          status: "settled",
          body: [
            "Paid in full on exit, accruing one day per month worked, valued at the ordinary daily rate. Taxable, but outside the INSS base.",
            "The double-pay penalty in Art. 32(5) attaches to the *employer* having prevented the leave, so leave a worker chose to defer carries no penalty. Xefe asks which happened; it never infers fault from the fact that days went untaken.",
          ],
          synonyms: ["unused leave", "untaken leave", "payout", "final pay"],
          today:
            "Cashed out automatically on the final payslip, once per termination.",
        },
        {
          id: "rehire",
          heading: "A rehire within 90 days keeps its original start date",
          status: "settled",
          body: [
            "Re-engagement within 90 days carries seniority from the original start date. Beyond 90 days, service restarts unless continuity is proven.",
            "Xefe previously reset the clock unconditionally, which under-paid anyone returning after a short break.",
          ],
          synonyms: ["rehire", "re-employment", "seniority"],
          today:
            "The original date is kept inside the window, and the payslip shows which rule was applied.",
        },
        {
          id: "citations",
          heading: "Two statute citations were simply wrong",
          status: "settled",
          body: [
            "Sick leave was cited as Art. 42 in one place and Art. 34 in another. Art. 42 is wage deductions; Art. 34 is occupational-safety principles. The real provision is Art. 33(4), the same article as special leave.",
            "Withholding was cited to the wrong Part of the Taxes and Duties Act.",
            "Neither error changed a calculation — the engine was already doing the right arithmetic. But a citation is the thing an accountant checks first, and a wrong one undermines every correct number next to it.",
          ],
          today: "Both corrected everywhere they appear, including on payslips.",
        },
      ],
    },
  ],
};

/**
 * The canonical set, in reading order. Guides come first: far more people
 * need to know when the INSS declaration is due than need our reading of
 * Art. 56.
 *
 * English is the spine — every article exists here, so nothing can vanish
 * from the index by being untranslated. Other locales only need to carry the
 * articles they have.
 */
export const HELP_ARTICLES: HelpArticle[] = [
  MONTH_EN,
  LEAVER_EN,
  BOUNDARIES_EN,
  LAW_POSITIONS,
];

const TRANSLATIONS: Record<ArticleLocale, HelpArticle[]> = {
  en: [],
  pt: [MONTH_PT, LEAVER_PT, BOUNDARIES_PT],
  tet: [MONTH_TET, LEAVER_TET, BOUNDARIES_TET],
};

/**
 * The article list for a reader, English standing in wherever a translation
 * does not exist yet. Order always follows HELP_ARTICLES, so the index does
 * not reshuffle when someone switches language.
 */
export function articlesFor(locale: ArticleLocale = "en"): HelpArticle[] {
  const translated = TRANSLATIONS[locale] ?? [];
  return HELP_ARTICLES.map(
    (article) =>
      translated.find((candidate) => candidate.slug === article.slug) ?? article,
  );
}

export function getArticle(
  slug: string,
  locale: ArticleLocale = "en",
): HelpArticle | undefined {
  return articlesFor(locale).find((article) => article.slug === slug);
}

export interface HelpSearchHit {
  article: HelpArticle;
  entry: HelpEntry;
  group: HelpGroup;
  /** Lower is better. */
  rank: number;
}

/** Everything about an entry that a reader might type words from. */
function haystack(entry: HelpEntry): string {
  return [
    entry.heading,
    entry.body.join(" "),
    entry.today ?? "",
    entry.when ?? "",
    entry.impact ?? "",
    entry.open ?? "",
    entry.quote ?? "",
    entry.quoteCite ?? "",
    (entry.synonyms ?? []).join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * Every term must appear somewhere in the entry — "leave maternity" should not
 * match an entry that only mentions leave. Matching the heading ranks above
 * matching the body, so typing "severance" leads with the severance entry
 * rather than with whatever paragraph happens to mention the word.
 */
export function searchHelp(
  query: string,
  locale: ArticleLocale = "en",
): HelpSearchHit[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const hits: HelpSearchHit[] = [];
  for (const article of articlesFor(locale)) {
    for (const group of article.groups) {
      for (const entry of group.entries) {
        const heading = entry.heading.toLowerCase();
        const all = haystack(entry);
        if (!terms.every((term) => all.includes(term))) continue;
        const inHeading = terms.filter((term) => heading.includes(term)).length;
        hits.push({ article, entry, group, rank: terms.length - inHeading });
      }
    }
  }
  return hits.sort((a, b) => a.rank - b.rank);
}
