/**
 * Bank payment pack — verified for BNU; best-effort for BNCTL until a
 * branch-approved sample is obtained.
 * actually use in Timor-Leste.
 *
 * Verified against real-world TL banking practice during compliance research
 * (2019–2026; internal evidence notes, kept out of the repo): salary batches
 * are NOT uploaded as CSV. Each month the business emails its branch a short
 * Portuguese cover message plus an Excel workbook whose transfer sheet has
 * exactly four columns — Nº Ord | Nome | Conta <bank> | Salário líquido —
 * with a total at the bottom, accompanied by a numbered, signed payment order
 * ("Ordem de Transferência / OT n / year"). The bank executes and returns a
 * stamped confirmation PDF.
 *
 * This module generates that pack: an .xlsx with the transfer-list sheet and
 * an Ordem de Pagamento sheet ready to print and sign, plus the Portuguese
 * cover email text. Bank-facing text is deliberately Portuguese regardless of
 * the app locale — that is the language the banks correspond in.
 *
 * PROVENANCE: the 4-column transfer list is the format BNU branches accept
 * (a bank requirement, minimal by nature); the Ordem de Pagamento sheet and
 * cover email are Xefe's own composition. No client or firm workbook layout
 * is imitated.
 */
import type { BankTransferSummary } from "./index";

export interface PaymentPackCompany {
  name: string;
  accountNumber: string;
}

const ACCOUNT_COLUMN_LABEL: Partial<
  Record<BankTransferSummary["bankCode"], string>
> = {
  BNU: "Conta BNU",
  BNCTL: "Conta BNCTL",
};

const BANK_LETTER_NAME: Partial<
  Record<BankTransferSummary["bankCode"], string>
> = {
  BNU: "Banco Nacional Ultramarino, S.A.",
  BNCTL: "Banco Nacional de Comércio de Timor-Leste",
};

export function supportsPaymentPack(
  bankCode: BankTransferSummary["bankCode"],
): boolean {
  return bankCode === "BNU" || bankCode === "BNCTL";
}

function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDatePT(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const months = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  if (!y || !m || !d) return isoDate;
  return `${d} de ${months[m - 1]} de ${y}`;
}

/** "2026-04" → "Abril de 2026" for letter/sheet headings. */
function formatPeriodPT(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return formatDatePT(`${period}-01`).replace(/^1 de /, "");
}

/**
 * The cover email the business sends to its branch, modelled on the messages
 * banks have accepted for years. Shown in the UI with a copy button.
 */
export function buildBankCoverEmail(
  summary: BankTransferSummary,
  company: PaymentPackCompany,
): string {
  const period = formatPeriodPT(summary.payrollPeriod);
  const date = formatDatePT(summary.valueDate);
  return [
    `Assunto: Transferências de pagamento de salários de ${period} — ${company.name}`,
    "",
    "Exmos. Senhores,",
    "",
    "Vimos por este meio solicitar a V. Exas. que procedam às transferências de",
    `pagamento dos salários de ${period}, conforme a lista e a ordem de pagamento`,
    "assinada em anexo.",
    "",
    `Conta a debitar: ${company.accountNumber}`,
    `Número de transferências: ${summary.transactionCount}`,
    `Montante total: ${formatUSD(summary.totalAmount)}`,
    `Data de execução pretendida: ${date}`,
    "",
    "Agradecemos a confirmação após a execução.",
    "",
    "Com os melhores cumprimentos,",
    company.name,
  ].join("\n");
}

/**
 * A one-off payment order — the same signed "Ordem de Pagamento" ritual used
 * for statutory payments (INSS contributions, ATTL taxes) and supplier bills.
 * In practice BNU executes these as internal transfers with a credit
 * description like "Ref <NISS> Seg Soc <TIN> <MES> <ANO>"; one-off supplier
 * payments follow the "Pagamento <vendor> Fatura n.º …" convention.
 */
export interface SinglePaymentOrder {
  company: PaymentPackCompany;
  /** Addressee bank, e.g. "Banco Nacional Ultramarino, S.A." */
  bankDisplayName: string;
  /** Portuguese purpose fragment: "das contribuições à Segurança Social de Julho de 2026" */
  purpose: string;
  beneficiaryName: string;
  /** May contain a fill-in blank when the account is not stored. */
  beneficiaryAccount: string;
  /** Credit / transfer description the bank should carry through. */
  reference?: string;
  amount: number;
  valueDate: string; // ISO yyyy-mm-dd
  /** e.g. "INSS_Pagamento_2026-07" — ".xlsx" is appended. */
  fileBaseName: string;
  /** Optional extra instruction line, e.g. ATTL's "electronic payment" marking. */
  extraNote?: string;
}

export function buildSinglePaymentCoverEmail(
  order: SinglePaymentOrder,
): string {
  const date = formatDatePT(order.valueDate);
  return [
    `Assunto: Pagamento — ${order.purpose} — ${order.company.name}`,
    "",
    "Exmos. Senhores,",
    "",
    "Vimos por este meio solicitar a V. Exas. que procedam ao pagamento",
    `${order.purpose}, conforme a ordem de pagamento assinada em anexo.`,
    "",
    `Conta a debitar: ${order.company.accountNumber}`,
    `Beneficiário: ${order.beneficiaryName}`,
    `Conta do beneficiário: ${order.beneficiaryAccount}`,
    ...(order.reference
      ? [`Descrição da transferência: ${order.reference}`]
      : []),
    `Montante: ${formatUSD(order.amount)}`,
    `Data de execução pretendida: ${date}`,
    ...(order.extraNote ? ["", order.extraNote] : []),
    "",
    "Agradecemos a confirmação após a execução.",
    "",
    "Com os melhores cumprimentos,",
    order.company.name,
  ].join("\n");
}

export async function generateSinglePaymentOrderXlsx(
  order: SinglePaymentOrder,
): Promise<{ blob: Blob; fileName: string }> {
  const { default: ExcelJSLib } = await import("exceljs");
  const wb = new ExcelJSLib.Workbook();
  const sheet = wb.addWorksheet("Ordem de Pagamento");
  sheet.columns = [{ width: 4 }, { width: 34 }, { width: 34 }, { width: 22 }];

  let rowCursor = 2;
  const put = (
    value: string,
    opts?: { bold?: boolean; size?: number; gapBefore?: number },
  ) => {
    rowCursor += opts?.gapBefore ?? 0;
    sheet.mergeCells(`B${rowCursor}:D${rowCursor}`);
    const cell = sheet.getCell(`B${rowCursor}`);
    cell.value = value;
    if (opts?.bold || opts?.size)
      cell.font = { bold: opts.bold, size: opts.size };
    rowCursor += 1;
  };

  put(order.company.name, { bold: true, size: 13 });
  put(`ORDEM DE PAGAMENTO — OT n.º ________ / ${order.valueDate.slice(0, 4)}`, {
    bold: true,
    size: 12,
    gapBefore: 1,
  });
  put(`Ao ${order.bankDisplayName}`, { gapBefore: 1 });
  put("Autorizamos o débito da nossa conta abaixo indicada para pagamento", {
    gapBefore: 1,
  });
  put(`${order.purpose}, conforme os dados seguintes.`);
  put(`Conta a debitar: ${order.company.accountNumber}`, { gapBefore: 1 });
  put(`Beneficiário: ${order.beneficiaryName}`);
  put(`Conta do beneficiário: ${order.beneficiaryAccount}`);
  if (order.reference) put(`Descrição da transferência: ${order.reference}`);
  put(`Montante: ${formatUSD(order.amount)}`);
  put(`Data de execução pretendida: ${formatDatePT(order.valueDate)}`);
  if (order.extraNote) put(order.extraNote, { gapBefore: 1 });
  put(`Díli, ${formatDatePT(order.valueDate)}`, { gapBefore: 2 });
  put("_____________________________          _____________________________", {
    gapBefore: 3,
  });
  put(
    "Assinatura autorizada                                  Assinatura autorizada",
  );

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  return { blob, fileName: `${order.fileBaseName}.xlsx` };
}

/** Portuguese month name for period headings, e.g. "2026-07" → "Julho de 2026". */
export function formatPeriodLabelPT(period: string): string {
  return formatPeriodPT(period);
}

/** Upper-case PT month abbreviation used in bank credit descriptions ("ABR 2026"). */
export function formatPeriodRefPT(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const abbrev = [
    "JAN",
    "FEV",
    "MAR",
    "ABR",
    "MAI",
    "JUN",
    "JUL",
    "AGO",
    "SET",
    "OUT",
    "NOV",
    "DEZ",
  ];
  if (!y || !m) return period;
  return `${abbrev[m - 1]} ${y}`;
}

/**
 * Build the two-sheet .xlsx pack. ExcelJS (~750KB) is lazy-loaded so the
 * payroll pages don't pay for it until a pack is generated.
 */
export async function generatePaymentPackXlsx(
  summary: BankTransferSummary,
  company: PaymentPackCompany,
): Promise<{ blob: Blob; fileName: string }> {
  const { default: ExcelJSLib } = await import("exceljs");
  const wb = new ExcelJSLib.Workbook();
  const accountLabel = ACCOUNT_COLUMN_LABEL[summary.bankCode] ?? "Conta";
  const period = formatPeriodPT(summary.payrollPeriod);

  // ---- Sheet 1: the transfer list, in the accepted 4-column layout ----
  const list = wb.addWorksheet("Transferências");
  list.columns = [{ width: 8 }, { width: 38 }, { width: 18 }, { width: 16 }];

  list.mergeCells("A1:D1");
  list.getCell("A1").value = company.name;
  list.getCell("A1").font = { bold: true, size: 13 };
  list.mergeCells("A2:D2");
  list.getCell("A2").value =
    `Transferências de pagamento de salários — ${period}`;
  list.getCell("A2").font = { bold: true };
  list.mergeCells("A3:D3");
  list.getCell("A3").value =
    `Conta a debitar: ${company.accountNumber} · Data-valor: ${formatDatePT(summary.valueDate)}`;

  const headerRow = list.addRow([]);
  void headerRow;
  const header = list.addRow([
    "Nº Ord",
    "Nome",
    accountLabel,
    "Salário líquido",
  ]);
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.border = { bottom: { style: "thin" } };
  });

  summary.lines.forEach((line, index) => {
    const row = list.addRow([
      index + 1,
      line.accountName,
      line.accountNumber,
      line.amount,
    ]);
    row.getCell(3).numFmt = "@"; // account numbers are text, never scientific
    row.getCell(4).numFmt = "#,##0.00";
  });

  const totalRow = list.addRow(["", "", "Total", summary.totalAmount]);
  totalRow.font = { bold: true };
  totalRow.getCell(4).numFmt = "#,##0.00";
  totalRow.eachCell((cell) => {
    cell.border = { top: { style: "thin" } };
  });

  // ---- Sheet 2: Ordem de Pagamento (print, number, sign, attach) ----
  const order = wb.addWorksheet("Ordem de Pagamento");
  order.columns = [{ width: 4 }, { width: 30 }, { width: 30 }, { width: 22 }];

  const put = (
    rowNumber: number,
    value: string,
    opts?: { bold?: boolean; size?: number },
  ) => {
    order.mergeCells(`B${rowNumber}:D${rowNumber}`);
    const cell = order.getCell(`B${rowNumber}`);
    cell.value = value;
    if (opts?.bold || opts?.size)
      cell.font = { bold: opts.bold, size: opts.size };
  };

  put(2, company.name, { bold: true, size: 13 });
  put(
    4,
    `ORDEM DE PAGAMENTO — OT n.º ________ / ${summary.valueDate.slice(0, 4)}`,
    {
      bold: true,
      size: 12,
    },
  );
  put(6, `Ao ${BANK_LETTER_NAME[summary.bankCode] ?? summary.bankName}`);
  put(8, "Autorizamos o débito da nossa conta abaixo indicada para pagamento");
  put(9, `dos salários de ${period}, conforme a lista em anexo.`);
  put(11, `Conta a debitar: ${company.accountNumber}`);
  put(12, `Número de transferências: ${summary.transactionCount}`);
  put(13, `Montante total: ${formatUSD(summary.totalAmount)}`);
  put(14, `Data de execução pretendida: ${formatDatePT(summary.valueDate)}`);
  put(17, `Díli, ${formatDatePT(summary.valueDate)}`);
  put(
    21,
    "_____________________________          _____________________________",
  );
  put(
    22,
    "Assinatura autorizada                                  Assinatura autorizada",
  );

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const fileName = `${summary.bankCode}_Salarios_${summary.payrollPeriod}.xlsx`;
  return { blob, fileName };
}
