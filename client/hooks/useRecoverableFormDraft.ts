import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createDraftOperationId,
  readRecoverableFormDraft,
  removeRecoverableFormDraft,
  UNSAVED_FORM_CONTEXT_CHANGE_EVENT,
  writeRecoverableFormDraft,
  type RecoverableFormDraft,
} from "@/lib/recoverableFormDraft";

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

interface RecoverableDraftOptions<T> {
  storageKey: string;
  data: T;
  enabled: boolean;
  shouldSave: boolean;
  onRestore: (data: T) => void;
  debounceMs?: number;
}

export function useRecoverableFormDraft<T>({
  storageKey,
  data,
  enabled,
  shouldSave,
  onRestore,
  debounceMs = 700,
}: RecoverableDraftOptions<T>) {
  const initialDraft = useMemo(() => {
    const storage = browserStorage();
    return storage
      ? readRecoverableFormDraft<T>(storage, storageKey)
      : null;
  }, [storageKey]);
  const [availableDraft, setAvailableDraft] = useState<RecoverableFormDraft<T> | null>(initialDraft);
  const [recoveryResolved, setRecoveryResolved] = useState(!initialDraft);
  const [operationId, setOperationId] = useState(
    () => initialDraft?.operationId || createDraftOperationId(),
  );
  const restoreRef = useRef(onRestore);
  restoreRef.current = onRestore;

  useEffect(() => {
    setAvailableDraft(initialDraft);
    setRecoveryResolved(!initialDraft);
    setOperationId(initialDraft?.operationId || createDraftOperationId());
  }, [initialDraft]);

  const serializedData = useMemo(() => {
    try {
      return JSON.stringify(data);
    } catch {
      return "";
    }
  }, [data]);

  useEffect(() => {
    const storage = browserStorage();
    if (
      !storage ||
      !enabled ||
      !recoveryResolved ||
      !shouldSave ||
      !serializedData
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      writeRecoverableFormDraft(storage, storageKey, {
        version: 1,
        updatedAt: Date.now(),
        operationId,
        data,
      });
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [data, debounceMs, enabled, operationId, recoveryResolved, serializedData, shouldSave, storageKey]);

  const restoreDraft = useCallback(() => {
    if (!availableDraft) return;
    restoreRef.current(availableDraft.data);
    setOperationId(availableDraft.operationId);
    setAvailableDraft(null);
    setRecoveryResolved(true);
  }, [availableDraft]);

  const discardDraft = useCallback(() => {
    const storage = browserStorage();
    if (storage) removeRecoverableFormDraft(storage, storageKey);
    setAvailableDraft(null);
    setRecoveryResolved(true);
    setOperationId(createDraftOperationId());
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    const storage = browserStorage();
    if (storage) removeRecoverableFormDraft(storage, storageKey);
    setAvailableDraft(null);
    setRecoveryResolved(true);
    setOperationId(createDraftOperationId());
  }, [storageKey]);

  return {
    availableDraft,
    operationId,
    restoreDraft,
    discardDraft,
    clearDraft,
  };
}

export function useUnsavedChangesWarning(active: boolean, message: string) {
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    const handleContextChange = (event: Event) => {
      if (!window.confirm(message)) event.preventDefault();
    };
    window.addEventListener(UNSAVED_FORM_CONTEXT_CHANGE_EVENT, handleContextChange);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener(UNSAVED_FORM_CONTEXT_CHANGE_EVENT, handleContextChange);
    };
  }, [active, message]);

  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const handleLink = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        anchor.origin !== window.location.origin ||
        anchor.href === window.location.href
      ) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", handleLink, true);
    return () => document.removeEventListener("click", handleLink, true);
  }, [active, message]);

  return useCallback(() => {
    if (!active || typeof window === "undefined") return true;
    return window.confirm(message);
  }, [active, message]);
}
