import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("browser email queue boundary", () => {
  it("denies every direct Firestore mail create", () => {
    const rules = read("firestore.rules");
    const mailMatch = rules.slice(
      rules.indexOf("match /mail/{emailId}"),
      rules.indexOf("// Money module collections"),
    );
    expect(mailMatch).toContain("allow create: if false;");
  });

  it("routes the shared client service through queueTenantEmail", () => {
    const service = read("client/services/notificationService.ts");
    expect(service).toMatch(/["']queueTenantEmail["']/);
    expect(service).not.toMatch(/addDoc\(collection\(db, ['"]mail['"]\)/);
    expect(service).not.toMatch(/batch\.set\([^\n]*['"]mail['"]/);
  });

  it("claims an announcement only in the transaction that queues its audience", () => {
    const source = read("functions/src/email.ts");
    const resolver = source.slice(
      source.indexOf("async function resolveRecipients"),
      source.indexOf("async function allowedReplyToAddresses"),
    );
    const atomicQueue = source.slice(
      source.indexOf("async function enqueueAnnouncementAtomically"),
      source.indexOf("Browser mail boundary"),
    );

    expect(resolver).not.toContain("transaction.update(announcementRef");
    expect(atomicQueue).toContain("db.runTransaction");
    expect(atomicQueue).toContain('transaction.set(db.collection("mail").doc()');
    expect(atomicQueue).toContain("delete queueBase.text");
    expect(atomicQueue).toContain("transaction.set(outboxRef");

    const sender = source.slice(source.indexOf("export const sendQueuedEmail"));
    expect(sender).toContain("announcementMailOutboxes");
  });

  it("keeps announcement outbox content server-only", () => {
    const rules = read("firestore.rules");
    const outboxMatch = rules.slice(
      rules.indexOf("match /announcementMailOutboxes/{announcementId}"),
      rules.indexOf("// EXPENSES SUBCOLLECTION"),
    );
    expect(outboxMatch).toContain("allow read, write: if false;");
  });
});
