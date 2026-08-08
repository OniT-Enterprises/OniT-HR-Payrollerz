/**
 * Converting a real attendance spreadsheet into text the extractor can read.
 *
 * Every case here comes from a real TL workbook in the mined corpus. The bug that
 * motivated the module: a clock-in of 09:23 is stored by Excel as a Date on the
 * 1899-12-30 epoch, and the old conversion rendered every Date as YYYY-MM-DD — so
 * "1899-12-30" was sent to the extractor instead of "09:23", every time in the
 * file was lost, and those sheets imported zero rows. Both import paths (strict
 * parse and AI fallback) share this conversion.
 */
import { describe, it, expect } from 'vitest';
import {
  MAX_EXTRACTION_CHUNKS,
  chunkTableText,
  dedupeAttendanceRows,
  excelCellToText,
  looksLikeLegacyXls,
  looksLikeWideMatrix,
  pickWorksheetName,
  planExtraction,
  worksheetToTableText,
} from '@/lib/attendance/spreadsheet-text';

/** An Excel time-only cell: the time of day on the 1899-12-30 epoch, in UTC. */
const excelTime = (hours: number, minutes: number) =>
  new Date(Date.UTC(1899, 11, 30, hours, minutes));

function fakeWorksheet(rows: unknown[][], name = 'Sheet1') {
  return {
    name,
    // ExcelJS row.values is 1-based, so index 0 is a hole.
    eachRow: (callback: (row: { values?: unknown }) => void) => {
      for (const row of rows) callback({ values: [undefined, ...row] });
    },
  };
}

describe('excelCellToText', () => {
  it('renders an Excel time-only cell as a clock time, not a date', () => {
    expect(excelCellToText(excelTime(9, 23))).toBe('09:23');
    expect(excelCellToText(excelTime(8, 48))).toBe('08:48');
    expect(excelCellToText(excelTime(17, 11))).toBe('17:11');
    expect(excelCellToText(excelTime(0, 5))).toBe('00:05');
  });

  it('renders a real calendar date as a date', () => {
    expect(excelCellToText(new Date(Date.UTC(2026, 6, 1)))).toBe('2026-07-01');
  });

  it('keeps both parts when a cell holds a date AND a time', () => {
    expect(excelCellToText(new Date(Date.UTC(2026, 6, 1, 8, 30)))).toBe('2026-07-01 08:30');
  });

  it('reads times in UTC so the machine timezone cannot shift them', () => {
    // The corpus workbooks parse as GMT+0100 on a European machine while the
    // business is in Dili (UTC+9). A local read would move every clock time.
    expect(excelCellToText(excelTime(23, 59))).toBe('23:59');
    expect(excelCellToText(excelTime(1, 0))).toBe('01:00');
  });

  it('unwraps formula, rich-text, hyperlink and error cells', () => {
    expect(excelCellToText({ result: excelTime(7, 30) })).toBe('07:30');
    expect(excelCellToText({ result: 42 })).toBe('42');
    expect(excelCellToText({ richText: [{ text: 'Maria ' }, { text: 'S.' }] })).toBe('Maria S.');
    expect(excelCellToText({ text: 'Nilton Amaral' })).toBe('Nilton Amaral');
    expect(excelCellToText({ hyperlink: 'mailto:a@b.c', text: 'a@b.c' })).toBe('a@b.c');
    expect(excelCellToText({ error: '#REF!' })).toBe('');
  });

  it('handles blanks, numbers and booleans', () => {
    expect(excelCellToText(null)).toBe('');
    expect(excelCellToText(undefined)).toBe('');
    expect(excelCellToText('  Maria  ')).toBe('Maria');
    expect(excelCellToText(7)).toBe('7');
    expect(excelCellToText(false)).toBe('false');
  });
});

describe('worksheetToTableText', () => {
  it('keeps header rows and every row carrying a time, dropping spacer rows', () => {
    // The real RNB timesheet layout: a spacer row follows each data row, holding
    // only the weekday and day-of-month labels.
    const text = worksheetToTableText(fakeWorksheet([
      ['July', 'July', '', 1, '', '', 2],
      ['July', 'July', 'Nilton Amaral', 'Nilton Amaral', 'Nilton Amaral', 'Camilo', 'Camilo'],
      [2017, 2017, 'Start', 'Finish', 'Hours', 'Start', 'Finish'],
      ['Saturday', 1, excelTime(8, 48), excelTime(17, 11), excelTime(8, 23), '', ''],
      ['Saturday', 1, '', '', '', '', ''],
      ['Sunday', 2, excelTime(8, 49), excelTime(17, 9), excelTime(8, 20), '', ''],
      ['Sunday', 2, '', '', '', '', ''],
    ]));
    const lines = text.split('\n');
    expect(lines).toHaveLength(5); // 3 header + 2 data
    expect(lines[3]).toContain('08:48\t17:11');
    expect(text).not.toContain('1899');
  });

  it('drops entirely empty rows', () => {
    const text = worksheetToTableText(fakeWorksheet([
      ['Employee', 'Date', 'In'],
      ['', '', ''],
      ['Maria', '2026-07-01', '08:00'],
    ]));
    expect(text.split('\n')).toHaveLength(2);
  });

  it('keeps every row when the sheet has no times or dates at all', () => {
    // Nothing to anchor on — better to send it all than to send nothing.
    const text = worksheetToTableText(fakeWorksheet([['a', 'b'], ['c', 'd']]));
    expect(text.split('\n')).toHaveLength(2);
  });
});

describe('pickWorksheetName', () => {
  // Spellings taken verbatim from a real 73-sheet workbook.
  const sheets = ['July17', 'October17', 'November 17', 'December 2017', 'January 2018',
    'Jully 2022', 'Agust 2022', '0ct 2019', 'Octoberber 2023', 'Sheet2'];

  it('matches a month with a four-digit year', () => {
    expect(pickWorksheetName(sheets, { year: 2017, month: 12 })).toBe('December 2017');
    expect(pickWorksheetName(sheets, { year: 2018, month: 1 })).toBe('January 2018');
  });

  it('tolerates the misspellings these files actually contain', () => {
    expect(pickWorksheetName(sheets, { year: 2022, month: 7 })).toBe('Jully 2022');
    expect(pickWorksheetName(sheets, { year: 2022, month: 8 })).toBe('Agust 2022');
    expect(pickWorksheetName(sheets, { year: 2019, month: 10 })).toBe('0ct 2019');
    expect(pickWorksheetName(sheets, { year: 2023, month: 10 })).toBe('Octoberber 2023');
  });

  it('matches a two-digit year when no four-digit year is present', () => {
    expect(pickWorksheetName(sheets, { year: 2017, month: 7 })).toBe('July17');
    expect(pickWorksheetName(sheets, { year: 2017, month: 11 })).toBe('November 17');
  });

  it('falls back to the first sheet rather than guessing a year', () => {
    // "May 2020" is absent; a month-only match across a 73-sheet archive would
    // pick an arbitrary year.
    expect(pickWorksheetName(sheets, { year: 2020, month: 5 })).toBe('July17');
    expect(pickWorksheetName(sheets)).toBe('July17');
    expect(pickWorksheetName(['Only'], { year: 2026, month: 1 })).toBe('Only');
    expect(pickWorksheetName([])).toBeUndefined();
  });
});

describe('looksLikeWideMatrix', () => {
  it('recognises employees repeated across Start/Finish/Hours column groups', () => {
    const matrix = [
      'July\tJuly\t\t1\t\t\t2',
      'July\tJuly\tNilton\tNilton\tNilton\tCamilo\tCamilo\tCamilo\tGeralda\tGeralda\tGeralda',
      '2017\t2017\tStart\tFinish\tHours\tStart\tFinish\tHours\tStart\tFinish\tHours',
    ].join('\n');
    expect(looksLikeWideMatrix(matrix)).toBe(true);
  });

  it('does not mistake a normal one-row-per-punch export for a matrix', () => {
    const rows = [
      'Employee\tDate\tClock In\tClock Out',
      'Maria S.\t01/07/2026\t08:00\t17:00',
      'Joao P.\t01/07/2026\t08:05\t17:02',
    ].join('\n');
    expect(looksLikeWideMatrix(rows)).toBe(false);
  });
});

describe('planExtraction', () => {
  const dataLine = (day: number) => `Day${day}\t${day}\t08:00\t17:00\t09:00`;

  it('sends a small row-per-punch sheet as a single call', () => {
    const text = ['Employee\tDate\tIn\tOut', 'Maria\t2026-07-01\t08:00\t17:00'].join('\n');
    const plan = planExtraction(text);
    expect(plan.layout).toBe('rows');
    expect(plan.chunks).toHaveLength(1);
    expect(plan.skippedLines).toBe(0);
  });

  /** A matrix header with `groups` employees, each owning Start/Finish/Hours. */
  const matrixText = (groups: number, rows: number) => {
    const names = Array.from({ length: groups }, (_, i) => `E${i}`);
    return [
      ['M', 'M', ...names.flatMap((n) => [n, n, n])].join('\t'),
      ['Y', 'Y', ...names.flatMap(() => ['Start', 'Finish', 'Hours'])].join('\t'),
      '2017\t2017',
      ...Array.from({ length: rows }, (_, i) => dataLine(i + 1)),
    ].join('\n');
  };

  it('scales rows per call inversely with the number of employees', () => {
    // A matrix row expands into one record per employee, and measured throughput
    // is ~30 records per call (2 rows of a 30-employee sheet took 88s; 4 rows
    // exceeded the ceiling). So chunk size must follow the employee count.
    const wide = planExtraction(matrixText(30, 30));
    const narrow = planExtraction(matrixText(3, 30));
    expect(wide.layout).toBe('matrix');
    expect(narrow.layout).toBe('matrix');
    const rowsPerChunk = (plan: typeof wide) => plan.chunks[0].split('\n').length - 3;
    expect(rowsPerChunk(wide)).toBe(1);
    expect(rowsPerChunk(narrow)).toBeGreaterThan(rowsPerChunk(wide));
    // Records per call stays in the range one call can actually return.
    expect(rowsPerChunk(wide) * 30).toBeLessThanOrEqual(30);
    expect(rowsPerChunk(narrow) * 3).toBeLessThanOrEqual(30);
  });

  it('covers a small team\'s whole month without hitting the cap', () => {
    // The realistic case: 3-8 staff. It must not be truncated.
    const plan = planExtraction(matrixText(3, 30));
    expect(plan.chunks.length).toBeLessThanOrEqual(MAX_EXTRACTION_CHUNKS);
    expect(plan.skippedLines).toBe(0);
  });

  it('caps the number of calls and reports what it left out', () => {
    // 30 employees x 30 days is minutes of extraction; the import covers what it
    // can and states the remainder rather than looking complete.
    const plan = planExtraction(matrixText(30, 30));
    expect(plan.chunks).toHaveLength(MAX_EXTRACTION_CHUNKS);
    expect(plan.skippedLines).toBe(30 - MAX_EXTRACTION_CHUNKS);
  });

  it('returns nothing for an empty sheet', () => {
    expect(planExtraction('   ').chunks).toHaveLength(0);
  });
});

describe('chunkTableText', () => {
  it('repeats the header rows in every chunk', () => {
    const lines = ['H1', 'H2', 'H3', ...Array.from({ length: 100 }, (_, i) => `row ${i}`)];
    const chunks = chunkTableText(lines.join('\n'), { maxDataLines: 10, maxChars: 100_000 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.startsWith('H1\nH2\nH3\n')).toBe(true);
    }
  });

  it('loses no data line across the split', () => {
    const dataLines = Array.from({ length: 47 }, (_, i) => `row ${i}`);
    const chunks = chunkTableText(['H1', 'H2', 'H3', ...dataLines].join('\n'), { maxDataLines: 5 });
    const seen = chunks.flatMap((chunk) => chunk.split('\n').slice(3));
    expect(seen).toEqual(dataLines);
  });
});

describe('dedupeAttendanceRows', () => {
  it('drops rows repeated where chunks overlap, case-insensitively on the name', () => {
    const rows = [
      { employee: 'Maria S.', date: '2026-07-01', clockIn: '08:00', clockOut: '17:00' },
      { employee: 'maria s.', date: '2026-07-01', clockIn: '08:00', clockOut: '17:00' },
      { employee: 'Maria S.', date: '2026-07-02', clockIn: '08:00', clockOut: '17:00' },
    ];
    expect(dedupeAttendanceRows(rows)).toHaveLength(2);
  });

  it('keeps two genuine punches on the same day', () => {
    const rows = [
      { employee: 'Maria', date: '2026-07-01', clockIn: '08:00', clockOut: '12:00' },
      { employee: 'Maria', date: '2026-07-01', clockIn: '13:00', clockOut: '17:00' },
    ];
    expect(dedupeAttendanceRows(rows)).toHaveLength(2);
  });
});

describe('looksLikeLegacyXls', () => {
  const ole2 = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00]);
  const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x08, 0x00]);

  it('recognises a legacy .xls by its OLE2 signature', () => {
    // Ten of twenty-four real attendance exports are this format, straight off
    // fingerprint devices, and exceljs cannot read any of them.
    expect(looksLikeLegacyXls(ole2)).toBe(true);
  });

  it('does not flag a modern .xlsx, which is a ZIP', () => {
    expect(looksLikeLegacyXls(zip)).toBe(false);
  });

  it('does not flag CSV or an empty/truncated file', () => {
    expect(looksLikeLegacyXls(new TextEncoder().encode('Employee,Date,In\n'))).toBe(false);
    expect(looksLikeLegacyXls(new Uint8Array())).toBe(false);
    expect(looksLikeLegacyXls(new Uint8Array([0xd0, 0xcf]))).toBe(false);
  });
});
