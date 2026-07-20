# SEFOPE-based contract template bodies

Cleaned, tokenized bodies of the official SEFOPE work-contract template,
ready to paste into **Admin → Contract Templates** (the feature fills
`{{tokens}}` from the employee/company record — see
`client/lib/contractFill.ts` for the token list).

Source: the official SEFOPE templates (Google Drive folder linked in
CLAUDE.md / provided by Tony, Jul 2026). PT is the authoritative language;
`sefope-fixed-term-pt.md` is the cleaned PT body. An EN body can be derived
the same way if needed (the raw EN file had more damage — see below).

## Cleanup applied (vs the raw .docx)
- "………" blanks → `{{tokens}}` where a token exists; bracketed prompts where
  a human must choose (e.g. the Art. 12 fixed-term motive).
- Citation artifacts normalized: the raw files' "artigo 140 n0.3", "Article
  270/300/440" are `.º`-suffix typing artifacts → Art. 14.º (probation),
  27.º (overtime), 30.º (weekly rest), 44.º (subsídio anual). Annual LEAVE is
  cited as Art. 32.º (the raw file cited "30.º ss", which is weekly rest —
  corrected).
- Removed an editorial annotation present in the raw EN file
  ("(SEPFOPE illegally imposes 1 year contract for foreign workers)") — an
  author's opinion, not template text; must never ship to users.
- Removed the hardcoded "1 year" duration/end-date clauses; duration should
  come from the offer/contract data (the app stamps contractEndDate and the
  Art. 12 motive per the contract-lifecycle features, Jul 2026).
- Dropped the raw file's clause 5.1 parenthetical spelling of the amount
  ("…hundred US Dollars") — the fill can't spell numbers; amount renders as
  USD {{employee.monthlySalary}}.

## ⚠️ Before shipping to a tenant
- Have Nico (or any TL lawyer) skim the cleaned body once — the raw SEFOPE
  text has known oddities and our citation fixes, while statute-checked,
  deserve a professional glance.
- The raw .docx files are NOT committed (annotation + damage); keep them in
  Drive. This cleaned body is the canonical source for the app.
