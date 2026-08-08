#!/usr/bin/env python3
"""Fetch a STRATIFIED sample of real invoice/receipt attachment bytes from Graph.

Unlike fetch_attachments.py (pattern + ORDER BY size DESC, which biases hard to
huge scans), this spreads the sample across the document classes that stress the
Xefe extraction path differently: born-digital PT invoices, scanned multipage,
EN local-supplier invoices, non-resident/foreign vendors, foreign-currency
candidates, receipts (PDF, DOCX, phone photos).

Writes files into --outdir/<stratum>/ plus a manifest.json recording, per file,
the stratum, sender domain, subject and message date — the context a human needs
to hand-label ground truth.

Run from the m365-mail-export dir (load_dotenv reads ./.env, DB defaults mail.db).
"""
import os
import re
import json
import time
import base64
import sqlite3
import argparse
from urllib.parse import quote

import requests
import msal
from dotenv import load_dotenv

# This script lives outside the mail-export dir, and bare load_dotenv() resolves
# relative to the calling FILE, not the CWD — so point it at the CWD's .env.
load_dotenv(os.path.join(os.getcwd(), ".env"))

GRAPH = "https://graph.microsoft.com/v1.0"
SCOPE = ["https://graph.microsoft.com/.default"]
TENANT_ID = os.environ.get("TENANT_ID", "")
CLIENT_ID = os.environ.get("CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("CLIENT_SECRET", "")
DB = os.environ.get("DB_PATH", "mail.db")

PDF = "application/pdf"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

INVOICE_LIKE = "(lower(a.name) like '%invoice%' or lower(a.name) like '%fatura%' or lower(a.name) like '%factura%')"
RECEIPT_LIKE = "(lower(a.name) like '%receipt%' or lower(a.name) like '%recibo%')"

# Foreign/non-resident service vendors seen in TL small-business mail — these are
# the Art. 57 withholding cases, and the ones most likely to be non-USD.
FOREIGN_HINTS = ["meta", "facebook", "google", "aws", "amazon", "microsoft",
                 "zoom", "adobe", "canva", "godaddy", "namecheap", "alibaba",
                 "shopee", "tokopedia", "grab", "singapore", "airline", "garuda"]
CURRENCY_HINTS = ["idr", "rp_", "_rp", "ppn", "pajak", "aud", "eur", "sgd", "usd_"]

STRATA = [
    # (name, target, extra SQL predicate)
    ("pt_born_digital",  30, f"{INVOICE_LIKE} and a.content_type = '{PDF}' and a.size < 400000 "
                             "and (lower(a.name) like '%fatura%' or lower(a.name) like '%factura%')"),
    ("scanned_multipage", 20, f"{INVOICE_LIKE} and a.content_type = '{PDF}' and a.size >= 800000"),
    ("en_local_invoice",  30, f"lower(a.name) like '%invoice%' and a.content_type = '{PDF}' "
                              "and a.size between 20000 and 300000"),
    ("non_resident",      15, f"{INVOICE_LIKE} and a.content_type = '{PDF}' and ("
                              + " or ".join(f"lower(a.name) like '%{h}%'" for h in FOREIGN_HINTS)
                              + " or m.from_domain not like '%.tl')"),
    ("currency_risk",     10, f"{INVOICE_LIKE} and ("
                              + " or ".join(f"lower(a.name) like '%{h}%'" for h in CURRENCY_HINTS)
                              + " or m.from_domain like '%.id')"),
    ("receipt_pdf",       30, f"{RECEIPT_LIKE} and a.content_type = '{PDF}'"),
    ("receipt_docx",       5, f"{RECEIPT_LIKE} and a.content_type = '{DOCX}'"),
    ("photo_capture",     15, f"({INVOICE_LIKE} or {RECEIPT_LIKE}) and a.content_type in ('image/jpeg','image/png')"),
]

# Cap per document "series" so 30 sequential invoices from one supplier don't
# eat a whole stratum (Invoice_4669/4721/4992… from the same vendor).
SERIES_CAP = 3


def series_key(name: str) -> str:
    """Collapse a filename to its series: lowercase, digits stripped, first 14 chars."""
    return re.sub(r"[\d\s._-]+", "", name.lower())[:14]


_app = msal.ConfidentialClientApplication(
    CLIENT_ID, authority=f"https://login.microsoftonline.com/{TENANT_ID}",
    client_credential=CLIENT_SECRET)


def token():
    r = _app.acquire_token_for_client(scopes=SCOPE)
    if "access_token" not in r:
        raise RuntimeError(r.get("error_description"))
    return r["access_token"]


def get(url):
    r = None
    for attempt in range(6):
        r = requests.get(url, headers={"Authorization": f"Bearer {token()}"}, timeout=180)
        if r.status_code in (429, 503, 504):
            time.sleep(int(r.headers.get("Retry-After", 2 ** attempt)))
            continue
        return r
    return r


def select_rows(con):
    """Pick candidate rows per stratum: distinct filename, distinct message, series-capped."""
    picked = []
    seen_names, seen_msgs = set(), set()
    for stratum, target, predicate in STRATA:
        sql = f"""
            SELECT a.mailbox, a.message_id, a.attachment_id, a.name, a.size,
                   a.content_type, m.from_domain, m.subject, m.received_datetime,
                   m.internet_message_id
              FROM attachments a
              JOIN messages m ON m.mailbox = a.mailbox AND m.id = a.message_id
             WHERE a.is_inline = 0 AND {predicate}
             GROUP BY lower(a.name)
             ORDER BY a.size
        """
        rows = con.execute(sql).fetchall()
        series_count, got = {}, 0
        # Walk the size-ordered list with a stride so the sample spans small→large
        # instead of clustering at one end.
        stride = max(1, len(rows) // max(target * 4, 1))
        ordered = rows[::stride] + rows
        for row in ordered:
            if got >= target:
                break
            name, imid = row[3], row[9]
            key = series_key(name)
            if name.lower() in seen_names or (imid and imid in seen_msgs):
                continue
            if series_count.get(key, 0) >= SERIES_CAP:
                continue
            seen_names.add(name.lower())
            if imid:
                seen_msgs.add(imid)
            series_count[key] = series_count.get(key, 0) + 1
            picked.append((stratum,) + tuple(row))
            got += 1
        print(f"[{stratum}] {len(rows)} candidates -> selected {got}/{target}")
    return picked


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--outdir", required=True)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    con = sqlite3.connect(DB)
    con.execute("PRAGMA query_only=1")
    picked = select_rows(con)
    con.close()
    print(f"\nTOTAL selected: {len(picked)}")
    if a.dry_run:
        for p in picked:
            print(f"  {p[0]:18} {p[6]:>9}B  {p[4][:70]}")
        return

    manifest = []
    for i, (stratum, mbx, mid, aid, name, size, ctype, domain, subject, recv, imid) in enumerate(picked, 1):
        outdir = os.path.join(a.outdir, stratum)
        os.makedirs(outdir, exist_ok=True)
        url = (f"{GRAPH}/users/{quote(mbx)}"
               f"/messages/{quote(mid, safe='')}"
               f"/attachments/{quote(aid, safe='')}")
        r = get(url)
        if r is None or r.status_code != 200:
            print(f"  ! [{i}/{len(picked)}] {name}: HTTP {getattr(r, 'status_code', 'none')}")
            continue
        cb = r.json().get("contentBytes")
        if not cb:
            print(f"  ~ [{i}/{len(picked)}] {name}: no contentBytes")
            continue
        safe = re.sub(r"[^A-Za-z0-9._-]", "_", name)[:120]
        path = os.path.join(outdir, safe)
        with open(path, "wb") as f:
            f.write(base64.b64decode(cb))
        manifest.append({
            "file": os.path.relpath(path, a.outdir),
            "stratum": stratum,
            "original_name": name,
            "content_type": ctype,
            "size": size,
            "from_domain": domain,
            "subject": subject,
            "received": recv,
        })
        print(f"  ok [{i}/{len(picked)}] {stratum}/{safe} ({size}B)")

    with open(os.path.join(a.outdir, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\nfetched {len(manifest)} files -> {a.outdir}")


if __name__ == "__main__":
    main()
