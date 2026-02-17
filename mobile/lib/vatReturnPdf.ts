/**
 * Kaixa — VAT Return PDF Generator
 *
 * Generates a DGFI-style VAT return as a printable PDF
 * using expo-print. The HTML template mimics an official
 * tax authority form layout.
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { VATReturnData, BusinessInfo } from './vatReturn';

// ============================================
// HTML Template
// ============================================

function buildHTML(data: VATReturnData, info: BusinessInfo): string {
  const $ = (n: number) => n.toFixed(2);
  const netLabel = data.netVATPayable >= 0 ? 'NET VAT PAYABLE' : 'NET VAT REFUNDABLE';
  const netColor = data.netVATPayable >= 0 ? '#FB7185' : '#34D399';
  const todayStr = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Dili',
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
      background: #fff;
      color: #1a1a1a;
      font-size: 11px;
      line-height: 1.4;
      padding: 24px;
    }

    .header {
      text-align: center;
      border-bottom: 3px double #333;
      padding-bottom: 16px;
      margin-bottom: 16px;
    }
    .header .coat {
      font-size: 24px;
      margin-bottom: 4px;
    }
    .header h1 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #555;
      font-weight: 600;
      margin-bottom: 2px;
    }
    .header h2 {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 800;
      color: #111;
    }
    .header .sub {
      font-size: 10px;
      color: #888;
      font-style: italic;
    }

    .section {
      margin-bottom: 14px;
    }
    .section-title {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      font-weight: 700;
      color: #666;
      border-bottom: 1px solid #ddd;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }
    .section-subtitle {
      font-size: 9px;
      color: #999;
      font-style: italic;
      margin-top: -6px;
      margin-bottom: 8px;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 20px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
    }
    .info-label {
      color: #888;
      font-size: 10px;
    }
    .info-value {
      font-weight: 600;
      font-size: 11px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }
    table td {
      padding: 5px 8px;
      border-bottom: 1px solid #eee;
      font-size: 11px;
    }
    table td:last-child {
      text-align: right;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    table tr.total td {
      border-top: 2px solid #333;
      border-bottom: 2px solid #333;
      font-weight: 800;
      font-size: 12px;
      padding: 7px 8px;
    }

    .net-box {
      background: #f8f8f8;
      border: 2px solid #333;
      border-radius: 6px;
      padding: 14px 16px;
      margin: 14px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .net-label {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .net-amount {
      font-size: 22px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }

    .deadline-bar {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 600;
      text-align: center;
      margin-bottom: 14px;
    }

    .signature {
      margin-top: 24px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
    }
    .sig-block {
      border-top: 1px solid #999;
      padding-top: 6px;
    }
    .sig-block .label {
      font-size: 9px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: 9px;
      color: #bbb;
      border-top: 1px solid #eee;
      padding-top: 8px;
    }
  </style>
</head>
<body>

  <div class="header">
    <div class="coat">\u{1F1F9}\u{1F1F1}</div>
    <h1>Rep\u00FAblika Demokr\u00E1tika de Timor-Leste</h1>
    <h1>Diresaun Geral Finan\u00E7as e Impostu (DGFI)</h1>
    <h2>Deklarasaun VAT / VAT Return</h2>
    <div class="sub">Form DGFI-VAT-01</div>
  </div>

  <div class="section">
    <div class="section-title">Business Information / Informasaun Neg\u00F3siu</div>
    <div class="info-grid">
      <div class="info-row">
        <span class="info-label">Business Name</span>
        <span class="info-value">${escapeHtml(info.name)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">VAT Reg. No.</span>
        <span class="info-value">${escapeHtml(info.vatRegNumber || 'N/A')}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Address</span>
        <span class="info-value">${escapeHtml(info.address || 'N/A')}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Phone</span>
        <span class="info-value">${escapeHtml(info.phone || 'N/A')}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Period</span>
        <span class="info-value">${escapeHtml(data.periodLabel)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Frequency</span>
        <span class="info-value">${data.period.type === 'monthly' ? 'Monthly / Mensal' : 'Quarterly / Trimestral'}</span>
      </div>
    </div>
  </div>

  <div class="deadline-bar">
    Filing Deadline / Prazu: ${escapeHtml(data.filingDeadline)}
  </div>

  <div class="section">
    <div class="section-title">Box 1 \u2014 Output VAT (VAT iha Vendas)</div>
    <table>
      <tr>
        <td>1a. Total Taxable Sales (net)</td>
        <td>$ ${$(data.totalTaxableSales)}</td>
      </tr>
      <tr>
        <td>1b. Standard Rate VAT (${data.standardRate}%)</td>
        <td>$ ${$(data.standardRateVATOnSales)}</td>
      </tr>
      <tr>
        <td>1c. Reduced Rate Sales</td>
        <td>$ ${$(data.reducedRateSales)}</td>
      </tr>
      <tr>
        <td>1d. Zero-Rated Sales</td>
        <td>$ ${$(data.zeroRatedSales)}</td>
      </tr>
      <tr>
        <td>1e. Exempt Sales</td>
        <td>$ ${$(data.exemptSales)}</td>
      </tr>
      <tr class="total">
        <td>1f. TOTAL OUTPUT VAT</td>
        <td>$ ${$(data.totalOutputVAT)}</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Box 2 \u2014 Input VAT (VAT iha Kompras)</div>
    <table>
      <tr>
        <td>2a. Total Taxable Purchases (net)</td>
        <td>$ ${$(data.totalTaxablePurchases)}</td>
      </tr>
      <tr>
        <td>2b. VAT on Purchases</td>
        <td>$ ${$(data.vatOnPurchases)}</td>
      </tr>
      <tr class="total">
        <td>2c. TOTAL INPUT VAT</td>
        <td>$ ${$(data.totalInputVAT)}</td>
      </tr>
    </table>
  </div>

  <div class="net-box">
    <span class="net-label">${netLabel}</span>
    <span class="net-amount" style="color: ${netColor}">$ ${$(Math.abs(data.netVATPayable))}</span>
  </div>

  <div class="section">
    <div class="section-title">Summary</div>
    <table>
      <tr>
        <td>Total Transactions</td>
        <td>${data.totalTransactions}</td>
      </tr>
      <tr>
        <td>Total Revenue</td>
        <td>$ ${$(data.totalRevenue)}</td>
      </tr>
      <tr>
        <td>Total Expenses</td>
        <td>$ ${$(data.totalExpenses)}</td>
      </tr>
    </table>
  </div>

  <div class="signature">
    <div class="sig-block">
      <div class="label">Taxpayer Signature / Asinatura</div>
    </div>
    <div class="sig-block">
      <div class="label">Date / Data</div>
    </div>
  </div>

  <div class="footer">
    Prepared by Kaixa Business System \u2014 ${todayStr}<br/>
    This document is for reference purposes. Official filing must be submitted through authorized DGFI channels.
  </div>

</body>
</html>`;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================
// Public API
// ============================================

/**
 * Generate a VAT return PDF and open the share sheet.
 * Returns the local file URI for further use.
 */
export async function generateAndShareVATReturnPDF(
  data: VATReturnData,
  info: BusinessInfo
): Promise<string> {
  const html = buildHTML(data, info);

  // Generate PDF
  const { uri } = await Print.printToFileAsync({
    html,
    width: 612, // US Letter width in points
    height: 792,
  });

  // Share the PDF file
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `VAT Return - ${data.periodLabel}`,
      UTI: 'com.adobe.pdf',
    });
  }

  return uri;
}

/**
 * Print the VAT return directly to a printer.
 */
export async function printVATReturn(
  data: VATReturnData,
  info: BusinessInfo
): Promise<void> {
  const html = buildHTML(data, info);
  await Print.printAsync({ html });
}
