# Official Timor-Leste Government Forms

This directory contains official forms downloaded from Timor-Leste government websites for reference.

## Tax Forms (ATTL - Autoridade Tributaria Timor-Leste)

| File | Description | Source |
|------|-------------|--------|
| `ATTL_Monthly_Tax_Form_English.xlsx` | Consolidated Monthly Taxes Form (Excel with auto-calc) | attl.gov.tl |
| `ATTL_Monthly_Tax_Form_Guide.pdf` | Guide for completing monthly tax form | attl.gov.tl |
| `ATTL_2023_Income_Tax_Form.pdf` | Annual Income Tax Form (2023) | attl.gov.tl |
| `ATTL_2023_Income_Tax_Form_Instructions.pdf` | Instructions for annual income tax | attl.gov.tl |
| `ATTL_TIN_Application_Enterprise.pdf` | TIN registration form for companies | attl.gov.tl |

## Immigration Forms (Migracao)

| File | Description | Source |
|------|-------------|--------|
| `Immigration_Visa_Application_Form.pdf` | Universal visa application (includes Work Visa) | migracao.gov.tl |

## Usage Notes

### Monthly Tax Form (ATTL_Monthly_Tax_Form_English.xlsx)
- Contains Section 1: Wage Income Tax (WIT)
- Fill in gross wages (Line 5) and WIT withheld (Line 10)
- Submit 3 copies to BNU bank by 15th of following month
- Amounts in whole USD (no cents)

### Work Visa Form
- Fillable PDF - can type directly into fields
- Used for all visa types including Work Visa (Type C)
- Submit to Immigration Service - cannot apply at border

## Download Sources

- ATTL Forms: https://attl.gov.tl/documents-forms/
- Immigration Forms: https://www.migracao.gov.tl/html/sub0202.php

## System Integration

Our system generates filled Excel templates matching the official ATTL Consolidated Monthly Taxes Form:

- **Export Location**: Reports > ATTL Monthly WIT > "Official Form" button
- **Format**: Excel (.xlsx) with two sheets:
  1. **Monthly Tax Form** - Matches official ATTL structure (Lines 5, 10, etc.)
  2. **Employee Details** - Supplementary breakdown by employee
- **Data**: Pre-filled with WIT totals from payroll data
- **Usage**: Print for BNU submission or reference when using e-Tax portal

## Last Updated
January 2026
