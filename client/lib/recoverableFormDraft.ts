const DRAFT_PREFIX = "xefe:form-draft:v1";
const MAX_DRAFT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const UNSAVED_FORM_CONTEXT_CHANGE_EVENT = "xefe:unsaved-form-context-change";

export function allowFormContextChange(): boolean {
  if (typeof window === "undefined") return true;
  return window.dispatchEvent(new Event(UNSAVED_FORM_CONTEXT_CHANGE_EVENT, {
    cancelable: true,
  }));
}

export interface RecoverableFormDraft<T> {
  version: 1;
  updatedAt: number;
  operationId: string;
  data: T;
}

interface DraftScope {
  userId: string;
  tenantId: string;
  form: string;
}

function segment(value: string): string {
  return encodeURIComponent(value);
}

export function recoverableFormDraftKey(scope: DraftScope): string {
  return `${DRAFT_PREFIX}:${segment(scope.userId)}:${segment(scope.tenantId)}:${segment(scope.form)}`;
}

export function createDraftOperationId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function readRecoverableFormDraft<T>(
  storage: Pick<Storage, "getItem" | "removeItem">,
  key: string,
): RecoverableFormDraft<T> | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RecoverableFormDraft<T>>;
    if (
      parsed.version !== 1 ||
      typeof parsed.updatedAt !== "number" ||
      typeof parsed.operationId !== "string" ||
      !parsed.operationId ||
      Date.now() - parsed.updatedAt > MAX_DRAFT_AGE_MS ||
      parsed.data === undefined
    ) {
      storage.removeItem(key);
      return null;
    }
    return parsed as RecoverableFormDraft<T>;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // Storage is unavailable as well as unreadable.
    }
    return null;
  }
}

export function writeRecoverableFormDraft<T>(
  storage: Pick<Storage, "setItem">,
  key: string,
  draft: RecoverableFormDraft<T>,
): boolean {
  try {
    storage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    // Private browsing, storage quotas, and locked-down devices can all make
    // localStorage unavailable. Saving the real record must still work.
    return false;
  }
}

export function removeRecoverableFormDraft(
  storage: Pick<Storage, "removeItem">,
  key: string,
): void {
  try {
    storage.removeItem(key);
  } catch {
    // Best-effort device cleanup only.
  }
}

export function clearRecoverableFormDrafts(
  storage: Pick<Storage, "length" | "key" | "removeItem">,
  scope: { userId?: string; tenantId?: string } = {},
): void {
  const userPrefix = scope.userId
    ? `${DRAFT_PREFIX}:${segment(scope.userId)}:`
    : `${DRAFT_PREFIX}:`;
  const tenantPrefix = scope.userId && scope.tenantId
    ? `${userPrefix}${segment(scope.tenantId)}:`
    : null;

  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (
        key &&
        (tenantPrefix ? key.startsWith(tenantPrefix) : key.startsWith(userPrefix))
      ) {
        keys.push(key);
      }
    }
    keys.forEach((key) => storage.removeItem(key));
  } catch {
    // Best-effort device cleanup only.
  }
}
