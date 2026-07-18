/**
 * PayslipExample — a marketing render of a real Xefe payslip for the landing
 * page. It mirrors the actual PayslipPDF layout (header → employee info →
 * combined earnings/deductions table → net-pay strip → TL-specific callouts)
 * and reuses the product's own lightweight `payslipStrings` so the labels are
 * trilingual (Tetun / English / Portuguese).
 *
 * Figures are illustrative but internally consistent and match the hero
 * calc card: $1,480 gross → −$98 WIT (10% over $500) → −$55.20 INSS (4%)
 * → $1,326.80 net.
 */
import {
  payslipStrings,
  type PayslipLocale,
} from "@/components/payroll/payslipStrings";

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// The two descriptions the shared payslipStrings dictionary doesn't carry.
const extra: Record<PayslipLocale, { food: string; caption: string }> = {
  en: {
    food: "Food Allowance",
    caption:
      "This is the document every employee receives — no spreadsheets, no manual maths.",
  },
  tet: {
    food: "Subsídiu Hahán",
    caption:
      "Ne'e mak dokumentu ne'ebé trabalhador hotu simu — la iha spreadsheet, la iha kalkula manuál.",
  },
  pt: {
    food: "Subsídio de Alimentação",
    caption:
      "É o documento que cada trabalhador recebe — sem folhas de cálculo, sem cálculos manuais.",
  },
};

export function PayslipExample({ locale = "en" }: { locale?: PayslipLocale }) {
  const s = payslipStrings[locale];
  const x = extra[locale];

  const basic = 1200,
    overtime = 180,
    food = 100;
  const grossEarnings = basic + overtime + food; // 1480
  const wit = 98,
    inss = 55.2;
  const totalDeductions = wit + inss; // 153.20
  const net = grossEarnings - totalDeductions; // 1326.80
  const employerInss = 82.8; // 6% of cash pay ($1,380, meal allowance excluded)
  const subsidioMonthly = +(grossEarnings / 12).toFixed(2); // 123.33

  const earnings = [
    { code: "SL_B", desc: s.auditBaseSalary, ref: "", amount: basic },
    { code: "C_O", desc: s.overtime, ref: `12.00 ${s.hrs}`, amount: overtime },
    { code: "SUB", desc: x.food, ref: "", amount: food },
  ];
  const deductions = [
    { code: "IMP", desc: `WIT · ${s.auditTaxOfMonth}`, amount: wit },
    { code: "S_S", desc: `INSS (4%) · ${s.auditSocialSecurity}`, amount: inss },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl bg-white text-zinc-800 shadow-2xl shadow-black/50 ring-1 ring-black/5 tabular-nums">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-3 border-b-2 border-blue-600 px-4 py-4 sm:flex-row sm:gap-4 sm:px-6">
        <div>
          <div className="text-lg font-bold text-blue-800">Café Timor, Lda</div>
          <div className="text-[11px] leading-tight text-zinc-500">
            Rua de Nu&apos;u Laran, Dili, Timor-Leste
            <br />
            +670 7723 4567 | folha@cafetimor.tl
          </div>
        </div>
        <div className="rounded bg-zinc-100 px-3 py-1.5 text-left sm:text-right">
          <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
            {s.monthOf}
          </div>
          <div className="text-sm font-bold text-zinc-900">
            {new Date("2026-02-15").toLocaleDateString(
              locale === "en" ? "en-GB" : "pt-PT",
              { month: "long", year: "numeric" },
            )}
          </div>
          <div className="mt-0.5 text-[10px] text-zinc-500">
            {s.payDate} 25/02/2026
          </div>
        </div>
      </div>

      {/* Title banner */}
      <div className="bg-blue-800 py-1.5 text-center text-[13px] font-bold uppercase tracking-wide text-white">
        {s.payslipTitleRow}
      </div>

      <div className="px-4 py-4 sm:px-6">
        {/* Employee + pay info */}
        <div className="mb-4 grid grid-cols-1 gap-x-6 gap-y-1 text-[11px] sm:grid-cols-2">
          <Info label={s.name} value="Domingas Soares" />
          <Info
            label={s.payFrequency}
            value={
              locale === "tet"
                ? "Mensál"
                : locale === "pt"
                  ? "Mensal"
                  : "Monthly"
            }
          />
          <Info label={s.employeeId} value="EMP-0042" />
          <Info
            label={s.department}
            value={locale === "en" ? "Operations" : "Operasaun"}
          />
          <Info
            label={s.position}
            value={locale === "en" ? "Store Supervisor" : "Supervizór Loja"}
          />
          <Info label={s.hourlyRate} value={money(6.92)} />
        </div>

        {/* Combined earnings / deductions table */}
        <div className="overflow-hidden rounded border border-zinc-200 text-[11px]">
          <div className="flex bg-zinc-100 px-2 py-1.5 font-bold uppercase tracking-wide text-zinc-500 sm:px-3">
            <div className="hidden w-[14%] sm:block">{s.code}</div>
            <div className="w-[52%] sm:w-[40%]">{s.description}</div>
            <div className="hidden w-[13%] text-right text-zinc-400 sm:block">
              {s.ref}
            </div>
            <div className="w-[24%] text-right sm:w-[16%]">{s.earningsCol}</div>
            <div className="w-[24%] text-right sm:w-[17%]">
              {s.deductionsCol}
            </div>
          </div>
          {earnings.map((r) => (
            <Row
              key={r.code}
              code={r.code}
              desc={r.desc}
              ref_={r.ref}
              earn={money(r.amount)}
            />
          ))}
          {deductions.map((r) => (
            <Row
              key={r.code}
              code={r.code}
              desc={r.desc}
              ded={money(r.amount)}
            />
          ))}
          <div className="flex border-t border-zinc-300 bg-zinc-50 px-2 py-1.5 font-bold sm:px-3">
            <div className="hidden w-[14%] sm:block" />
            <div className="w-[52%] text-zinc-600 sm:w-[40%]">
              {s.totalEarnings} / {s.totalDeductions}
            </div>
            <div className="hidden w-[13%] sm:block" />
            <div className="w-[24%] text-right sm:w-[16%]">
              {money(grossEarnings)}
            </div>
            <div className="w-[24%] text-right sm:w-[17%]">
              {money(totalDeductions)}
            </div>
          </div>
        </div>

        {/* Net pay strip */}
        <div className="mt-4 grid grid-cols-3 items-stretch gap-2 rounded bg-blue-800 px-2 py-3 text-white sm:px-5">
          <Summary label={s.grossPay} value={money(grossEarnings)} />
          <Summary label={s.totalDeductions} value={money(totalDeductions)} />
          <Summary label={s.netPay} value={money(net)} accent />
        </div>

        {/* TL-specific callouts */}
        <div className="mt-3 grid gap-3 text-[10.5px] sm:grid-cols-2">
          <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2">
            <div className="font-bold text-amber-800">
              {s.subsidioAnualAccrual}
            </div>
            <div className="mt-0.5 flex justify-between text-amber-900">
              <span>{s.subsidioAnualAccrual}</span>
              <span className="font-bold">
                {money(subsidioMonthly)}
                {s.perMonth}
              </span>
            </div>
          </div>
          <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2">
            <div className="font-bold text-amber-800">
              {s.employerContributions}
            </div>
            <div className="mt-0.5 flex justify-between text-amber-900">
              <span>{s.employerINSS}</span>
              <span className="font-bold">{money(employerInss)}</span>
            </div>
          </div>
        </div>

        <p className="mt-3 text-center text-[10px] italic text-zinc-400">
          {x.caption}
        </p>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <span className="text-zinc-400">{label}</span>
      <span className="font-semibold text-zinc-800">{value}</span>
    </div>
  );
}

function Row({
  code,
  desc,
  ref_,
  earn,
  ded,
}: {
  code: string;
  desc: string;
  ref_?: string;
  earn?: string;
  ded?: string;
}) {
  return (
    <div className="flex border-b border-zinc-100 px-2 py-1.5 sm:px-3">
      <div className="hidden w-[14%] font-bold text-zinc-700 sm:block">
        {code}
      </div>
      <div className="w-[52%] text-zinc-700 sm:w-[40%]">{desc}</div>
      <div className="hidden w-[13%] text-right text-zinc-400 sm:block">
        {ref_ || ""}
      </div>
      <div className="w-[24%] text-right text-zinc-800 sm:w-[16%]">
        {earn || ""}
      </div>
      <div className="w-[24%] text-right text-zinc-800 sm:w-[17%]">
        {ded || ""}
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="text-[9px] uppercase tracking-wide text-blue-200">
        {label}
      </div>
      <div
        className={`font-bold ${accent ? "text-amber-300 text-lg" : "text-white text-sm"}`}
      >
        {value}
      </div>
    </div>
  );
}
