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
  status: PositionStatus;
  /** The statutory text, quoted. Empty when the point is not textual. */
  quote?: string;
  quoteCite?: string;
  /** The reasoning, as paragraphs. */
  body: string[];
  /** What the product does right now — always stated, never implied. */
  today: string;
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
    "One rule governs all of them: **where the answer was uncertain, Xefe took the conservative side.** It over-withholds rather than under-withholds, discloses rather than silently infers, and never auto-pays a contested amount. So nothing on this page can be causing you to underpay a worker or under-remit to INSS or the tax authority. What the uncertainty costs is precision — and, in a few places, a judgement you are asked to make that the software could have made for you.",
    "The statutory text quoted here was read from clean Jornal da República copies. Where a reading has been confirmed by an independent Timor-Leste practitioner, it says so.",
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
            "Three provisions decide it. DL 20/2017 Art. 8(2)(c) expressly puts shift and night-work supplements **inside** the contribution base. Art. 9(c) expressly puts payments for *trabalho extraordinário* **outside** it. And Lei 4/2012 puts the rest-day and holiday double-pay rule inside Art. 27, an article headed \"Horas extraordinárias\", while Art. 2(y) defines trabalho extraordinário as work beyond the normal period — which a rest day is by definition.",
            "So the doubled portion reads as overtime pay, and Art. 9(c) excludes it. The counter-argument is Art. 8(2)(f), a residual clause sweeping in \"outros subsídios\" — but a specific exclusion normally beats a residual inclusion.",
          ],
          synonyms: ["sunday pay", "holiday pay", "double pay", "overtime", "social security"],
          today:
            "Premiums are excluded from the contribution base, which is the smaller base and therefore the conservative side for the employer's own cost — but it also means less is contributed on the worker's behalf.",
          impact:
            "4% employee plus 6% employer on every premium hour. Structural rather than marginal for a seven-day business.",
          open:
            "Whether that is how it is actually declared on the monthly DR in practice.",
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
          heading: "Does the $115 minimum wage prorate for a part-timer?",
          status: "asks-you",
          body: [
            "Xefe enforces $115 a month as an absolute floor. That makes a genuinely part-time arrangement below the floor hard to process, even where the hourly rate is well above minimum.",
          ],
          synonyms: ["part time", "part-time", "wage floor"],
          today: "Absolute monthly floor, regardless of contracted hours.",
          open:
            "Does the minimum wage prorate by contracted hours, or is $115 absolute?",
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
            "Whether there is a deadline to enrol a new worker with INSS — Xefe's wording says the number is \"needed before your first filing\", and if enrolment is actually due within days of hiring, that wording says the opposite of the truth.",
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
          id: "working-week",
          heading: "Sunday is the default rest day, not a rule",
          status: "settled",
          quote:
            "O dia de descanso semanal só pode deixar de ser ao domingo quando o trabalhador preste trabalhos indispensáveis à continuidade de serviços que não podem ser interrompidos ou que tenham, necessariamente, de ser prestados ao domingo.",
          quoteCite: "Lei 4/2012, Art. 30(2)",
          body: [
            "A hotel, restaurant, clinic or security firm lawfully works Sundays, and those workers rest on another day. Xefe used to assume Monday to Friday for everybody, which was wrong in both directions at once: it paid a double premium for an ordinary working day, and single time for the day that was actually the worker's rest day. Leave duration was wrong the same way.",
          ],
          synonyms: ["saturday", "sunday", "rest day", "working days", "six-day week"],
          today:
            "The working week is a company setting. It still defaults to Monday–Friday, so no existing company's figures moved without someone choosing to move them.",
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

export const HELP_ARTICLES: HelpArticle[] = [LAW_POSITIONS];

export function getArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.slug === slug);
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
    entry.today,
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
export function searchHelp(query: string): HelpSearchHit[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const hits: HelpSearchHit[] = [];
  for (const article of HELP_ARTICLES) {
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
