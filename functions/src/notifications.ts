/**
 * Ekipa employee push notifications delivered through Expo Push Service.
 *
 * Device tokens are registered by the mobile app at
 * `users/{uid}/devices/{tokenId}`. These triggers deliberately send only
 * short summaries; sensitive payroll amounts remain inside authenticated
 * Ekipa screens.
 */
import { getFirestore, type DocumentReference } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";

const db = getFirestore();
const REGION = "asia-southeast1";
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100;

type SupportedLanguage = "tet" | "en" | "pt" | "id";

interface DeviceTarget {
  token: string;
  language: SupportedLanguage;
  ref: DocumentReference;
}

interface NotificationCopy {
  title: string;
  body: string;
  route: string;
  type: string;
  entityId?: string;
  tenantId: string;
}

interface ExpoPushResult {
  status?: "ok" | "error";
  details?: { error?: string };
}

function asLanguage(value: unknown): SupportedLanguage {
  return value === "en" || value === "pt" || value === "id" ? value : "tet";
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function localized(
  language: SupportedLanguage,
  copy: Record<SupportedLanguage, string>,
): string {
  return copy[language] || copy.tet;
}

async function getDeviceTargets(userIds: string[]): Promise<DeviceTarget[]> {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  const snapshots = await Promise.all(
    uniqueUserIds.map((uid) => db.collection(`users/${uid}/devices`).get()),
  );

  const targets: DeviceTarget[] = [];
  for (const snapshot of snapshots) {
    for (const device of snapshot.docs) {
      const data = device.data();
      if (data.enabled === false || data.provider !== "expo") continue;
      const token = asString(data.token);
      if (!token) continue;
      targets.push({
        token,
        language: asLanguage(data.language),
        ref: device.ref,
      });
    }
  }
  return targets;
}

async function getTenantTargets(tenantId: string): Promise<DeviceTarget[]> {
  const members = await db.collection(`tenants/${tenantId}/members`).get();
  return getDeviceTargets(members.docs.map((member) => member.id));
}

async function getEmployeeTargets(
  tenantId: string,
  employeeId: string,
): Promise<DeviceTarget[]> {
  if (!tenantId || !employeeId) return [];
  const members = await db
    .collection(`tenants/${tenantId}/members`)
    .where("employeeId", "==", employeeId)
    .get();
  return getDeviceTargets(members.docs.map((member) => member.id));
}

async function sendPush(
  targets: DeviceTarget[],
  makeCopy: (language: SupportedLanguage) => NotificationCopy,
): Promise<void> {
  if (targets.length === 0) return;

  for (let offset = 0; offset < targets.length; offset += EXPO_BATCH_SIZE) {
    const chunk = targets.slice(offset, offset + EXPO_BATCH_SIZE);
    const messages = chunk.map((target) => {
      const copy = makeCopy(target.language);
      return {
        to: target.token,
        sound: "default",
        channelId: "ekipa-updates",
        title: copy.title,
        body: copy.body,
        data: {
          route: copy.route,
          type: copy.type,
          tenantId: copy.tenantId,
          ...(copy.entityId ? { entityId: copy.entityId } : {}),
        },
      };
    });

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      throw new Error(`Expo push service returned ${response.status}`);
    }

    const payload = await response.json() as { data?: ExpoPushResult[] };
    const results = Array.isArray(payload.data) ? payload.data : [];
    const invalidTokenDeletes: Promise<unknown>[] = [];
    results.forEach((result, index) => {
      if (result.status === "error" && result.details?.error === "DeviceNotRegistered") {
        invalidTokenDeletes.push(chunk[index].ref.delete());
      }
    });
    await Promise.all(invalidTokenDeletes);
  }
}

async function deliverSafely(
  eventName: string,
  targetsPromise: Promise<DeviceTarget[]>,
  makeCopy: (language: SupportedLanguage) => NotificationCopy,
): Promise<void> {
  try {
    const targets = await targetsPromise;
    await sendPush(targets, makeCopy);
    logger.info("Ekipa push notification delivered", {
      eventName,
      deviceCount: targets.length,
    });
  } catch (error) {
    // A notification outage must not fail or roll back the HR/payroll event.
    logger.error("Ekipa push notification failed", { eventName, error });
  }
}

export const notifyEkipaAnnouncement = onDocumentCreated(
  {
    document: "tenants/{tenantId}/announcements/{announcementId}",
    region: REGION,
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const tenantId = event.params.tenantId;
    const announcementId = event.params.announcementId;
    const announcementTitle = truncate(asString(data.title, "New announcement"), 80);
    const announcementBody = truncate(asString(data.body, "Open Ekipa to read the update."), 180);

    await deliverSafely(
      "announcement.created",
      getTenantTargets(tenantId),
      () => ({
        title: announcementTitle,
        body: announcementBody,
        route: "/screens/Announcements",
        type: "announcement",
        entityId: announcementId,
        tenantId,
      }),
    );
  },
);

export const notifyEkipaLeaveDecision = onDocumentUpdated(
  {
    document: "leave_requests/{requestId}",
    region: REGION,
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.status === after.status) return;
    if (after.status !== "approved" && after.status !== "rejected") return;

    const tenantId = asString(after.tenantId);
    const employeeId = asString(after.employeeId);
    const approved = after.status === "approved";
    const requestId = event.params.requestId;

    await deliverSafely(
      `leave.${after.status}`,
      getEmployeeTargets(tenantId, employeeId),
      (language) => ({
        title: approved
          ? localized(language, {
            tet: "Lisensa aprova ona",
            en: "Leave approved",
            pt: "Licença aprovada",
            id: "Cuti disetujui",
          })
          : localized(language, {
            tet: "Lisensa rejeita ona",
            en: "Leave request declined",
            pt: "Pedido de licença recusado",
            id: "Permintaan cuti ditolak",
          }),
        body: approved
          ? localized(language, {
            tet: "Haree detallu pedidu iha Ekipa.",
            en: "Open Ekipa to see the approved dates.",
            pt: "Abra a Ekipa para ver as datas aprovadas.",
            id: "Buka Ekipa untuk melihat tanggal yang disetujui.",
          })
          : localized(language, {
            tet: "Haree komentáriu no detallu iha Ekipa.",
            en: "Open Ekipa to review the decision.",
            pt: "Abra a Ekipa para rever a decisão.",
            id: "Buka Ekipa untuk melihat keputusan.",
          }),
        route: "/(tabs)/leave",
        type: "leave_decision",
        entityId: requestId,
        tenantId,
      }),
    );
  },
);

export const notifyEkipaExpenseDecision = onDocumentUpdated(
  {
    document: "tenants/{tenantId}/expenses/{expenseId}",
    region: REGION,
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.status === after.status) return;
    if (after.status !== "approved" && after.status !== "rejected") return;

    const tenantId = event.params.tenantId;
    const employeeId = asString(after.employeeId);
    const approved = after.status === "approved";
    const expenseId = event.params.expenseId;

    await deliverSafely(
      `expense.${after.status}`,
      getEmployeeTargets(tenantId, employeeId),
      (language) => ({
        title: approved
          ? localized(language, {
            tet: "Despeza aprova ona",
            en: "Expense approved",
            pt: "Despesa aprovada",
            id: "Pengeluaran disetujui",
          })
          : localized(language, {
            tet: "Despeza rejeita ona",
            en: "Expense declined",
            pt: "Despesa recusada",
            id: "Pengeluaran ditolak",
          }),
        body: localized(language, {
          tet: "Haree detallu iha Ekipa.",
          en: "Open Ekipa to review the details.",
          pt: "Abra a Ekipa para rever os detalhes.",
          id: "Buka Ekipa untuk melihat detail.",
        }),
        route: "/screens/Expenses",
        type: "expense_decision",
        entityId: expenseId,
        tenantId,
      }),
    );
  },
);

export const notifyEkipaPayslipReady = onDocumentCreated(
  {
    document: "tenants/{tenantId}/payruns/{period}/payslips/{employeeId}",
    region: REGION,
  },
  async (event) => {
    const tenantId = event.params.tenantId;
    const employeeId = event.params.employeeId;
    const period = event.params.period;

    await deliverSafely(
      "payslip.ready",
      getEmployeeTargets(tenantId, employeeId),
      (language) => ({
        title: localized(language, {
          tet: "Recibo saláriu prontu ona",
          en: "Your payslip is ready",
          pt: "O seu recibo está pronto",
          id: "Slip gaji Anda sudah siap",
        }),
        body: localized(language, {
          tet: "Loke Ekipa atu haree no fahe recibo.",
          en: "Open Ekipa to view or share your payslip.",
          pt: "Abra a Ekipa para ver ou partilhar o recibo.",
          id: "Buka Ekipa untuk melihat atau membagikan slip gaji.",
        }),
        route: "/(tabs)/payslips",
        type: "payslip_ready",
        entityId: period,
        tenantId,
      }),
    );
  },
);

export const notifyEkipaDocumentRequest = onDocumentUpdated(
  {
    document: "tenants/{tenantId}/employees/{employeeId}/document_requests/{requestId}",
    region: REGION,
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.status === after.status) return;
    if (after.status !== "ready" && after.status !== "rejected") return;

    const tenantId = event.params.tenantId;
    const employeeId = event.params.employeeId;
    const ready = after.status === "ready";

    await deliverSafely(
      `document_request.${after.status}`,
      getEmployeeTargets(tenantId, employeeId),
      (language) => ({
        title: ready
          ? localized(language, {
            tet: "Dokumentu prontu ona",
            en: "Your document is ready",
            pt: "O seu documento está pronto",
            id: "Dokumen Anda sudah siap",
          })
          : localized(language, {
            tet: "Pedidu dokumentu rejeita ona",
            en: "Document request declined",
            pt: "Pedido de documento recusado",
            id: "Permintaan dokumen ditolak",
          }),
        body: localized(language, {
          tet: "Loke Ekipa atu haree detallu.",
          en: "Open Ekipa to review the details.",
          pt: "Abra a Ekipa para rever os detalhes.",
          id: "Buka Ekipa untuk melihat detail.",
        }),
        route: "/screens/EmploymentLetterRequest",
        type: "document_request",
        entityId: event.params.requestId,
        tenantId,
      }),
    );
  },
);
