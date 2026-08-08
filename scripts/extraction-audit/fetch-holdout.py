#!/usr/bin/env python3
"""Fetch a HELD-OUT random sample: documents never seen by the earlier audit.

Two groups, both chosen at random rather than stratified or size-ordered, so the
result reflects "whatever a customer happens to upload":

  invoiceish : 20 invoice/receipt-named documents  -> should extract fields
  anydoc     : 10 documents of ANY name at all     -> most should be refused
                                                      ('other'/'payment_proof')

Excludes every filename already fetched into doc-extract-audit (manifest.json and
the tables/ dir), so nothing here has been processed before.

Run from the m365-mail-export dir.
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

load_dotenv(os.path.join(os.getcwd(), ".env"))

GRAPH = "https://graph.microsoft.com/v1.0"
SCOPE = ["https://graph.microsoft.com/.default"]
DB = os.environ.get("DB_PATH", "mail.db")
ACCEPTED = ("application/pdf", "image/jpeg", "image/png", "image/webp")

_app = msal.ConfidentialClientApplication(
    os.environ["CLIENT_ID"],
    authority=f"https://login.microsoftonline.com/{os.environ['TENANT_ID']}",
    client_credential=os.environ["CLIENT_SECRET"])


def token():
    r = _app.acquire_token_for_client(scopes=SCOPE)
    if "access_token" not in r:
        raise RuntimeError(r.get("error_description"))
    return r["access_token"]


def get(url):
    for attempt in range(6):
        r = requests.get(url, headers={"Authorization": f"Bearer {token()}"}, timeout=180)
        if r.status_code in (429, 503, 504):
            time.sleep(int(r.headers.get("Retry-After", 2 ** attempt)))
            continue
        return r
    return None


def already_seen(audit_dir):
    seen = set()
    manifest = os.path.join(audit_dir, "manifest.json")
    if os.path.exists(manifest):
        for entry in json.load(open(manifest)):
            seen.add(entry["original_name"].lower())
    for root, _dirs, files in os.walk(audit_dir):
        for name in files:
            seen.add(name.lower())
    return seen


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--audit-dir", required=True)
    ap.add_argument("--outdir", required=True)
    ap.add_argument("--invoiceish", type=int, default=20)
    ap.add_argument("--anydoc", type=int, default=10)
    a = ap.parse_args()

    seen = already_seen(a.audit_dir)
    print(f"{len(seen)} filenames already processed — excluded")

    con = sqlite3.connect(DB)
    con.execute("PRAGMA query_only=1")
    mimes = ",".join("?" * len(ACCEPTED))
    invoice_like = ("(lower(a.name) like '%invoice%' or lower(a.name) like '%fatura%' "
                    "or lower(a.name) like '%factura%' or lower(a.name) like '%receipt%' "
                    "or lower(a.name) like '%recibo%')")

    groups = {
        "invoiceish": (invoice_like, a.invoiceish),
        "anydoc": ("1=1", a.anydoc),
    }

    picked = []
    used_names = set(seen)
    for group, (predicate, target) in groups.items():
        rows = con.execute(
            f"""SELECT a.mailbox, a.message_id, a.attachment_id, a.name, a.size,
                       a.content_type, m.from_domain, m.subject, m.received_datetime
                  FROM attachments a
                  JOIN messages m ON m.mailbox = a.mailbox AND m.id = a.message_id
                 WHERE a.is_inline = 0 AND a.content_type IN ({mimes})
                   AND a.size BETWEEN 5000 AND 9000000 AND {predicate}
                 GROUP BY lower(a.name)
                 ORDER BY random() LIMIT ?""",
            (*ACCEPTED, target * 6)).fetchall()
        taken = 0
        for row in rows:
            if taken >= target:
                break
            name = row[3]
            if name.lower() in used_names:
                continue
            used_names.add(name.lower())
            picked.append((group,) + tuple(row))
            taken += 1
        print(f"[{group}] selected {taken}/{target}")
    con.close()

    manifest = []
    for i, (group, mbx, mid, aid, name, size, ctype, domain, subject, recv) in enumerate(picked, 1):
        outdir = os.path.join(a.outdir, group)
        os.makedirs(outdir, exist_ok=True)
        url = (f"{GRAPH}/users/{quote(mbx)}/messages/{quote(mid, safe='')}"
               f"/attachments/{quote(aid, safe='')}")
        r = get(url)
        if r is None or r.status_code != 200:
            print(f"  ! [{i}] {name}: HTTP {getattr(r, 'status_code', 'none')}")
            continue
        cb = r.json().get("contentBytes")
        if not cb:
            continue
        safe = re.sub(r"[^A-Za-z0-9._-]", "_", name)[:120]
        path = os.path.join(outdir, safe)
        with open(path, "wb") as f:
            f.write(base64.b64decode(cb))
        manifest.append({"file": os.path.relpath(path, a.outdir), "stratum": group,
                         "original_name": name, "content_type": ctype, "size": size,
                         "from_domain": domain, "subject": subject, "received": recv})
        print(f"  ok [{i}/{len(picked)}] {group}/{safe} ({size}B)")

    os.makedirs(a.outdir, exist_ok=True)
    with open(os.path.join(a.outdir, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\nfetched {len(manifest)} held-out documents -> {a.outdir}")


if __name__ == "__main__":
    main()
