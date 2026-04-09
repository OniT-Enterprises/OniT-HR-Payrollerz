/**
 * FaceClockIn — Self-service facial recognition clock-in dialog
 * Loads all tenant embeddings, runs matching loop, creates attendance record
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Check, UserX, Loader2, ScanFace } from 'lucide-react';
import FaceCamera from './FaceCamera';
import { useFaceEmbeddings } from '@/hooks/useFaceRecognition';
import { findBestMatch, checkLiveness, type DetectionResult } from '@/lib/face-api-loader';
import { attendanceService } from '@/services/attendanceService';
import { useTenantId } from '@/contexts/TenantContext';
import { employeeService } from '@/services/employeeService';
import { getTodayTL } from '@/lib/dateUtils';

type ClockInState = 'loading' | 'scanning' | 'matched' | 'confirming' | 'success' | 'not-recognized';

interface FaceClockInProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface MatchedEmployee {
  id: string;
  name: string;
  department: string;
}

const CONSECUTIVE_MATCH_THRESHOLD = 3;

const STATE_DESCRIPTIONS: Record<ClockInState, string> = {
  scanning: 'Look at the camera to clock in.',
  loading: 'Loading face data...',
  matched: 'Identifying...',
  confirming: 'Employee identified!',
  success: 'Clock-in recorded!',
  'not-recognized': 'Face not recognized. Try again or use manual entry.',
};

/* ─── Match tracking refs type ─── */

interface MatchTrackingRefs {
  matchCountRef: React.MutableRefObject<number>;
  lastMatchIdRef: React.MutableRefObject<string | null>;
  prevLandmarksRef: React.MutableRefObject<DetectionResult['landmarks'] | null>;
  livenessPassedRef: React.MutableRefObject<boolean>;
}

/* ─── Face matching logic (pure function) ─── */

function processFaceMatch(
  result: DetectionResult,
  embeddings: ReturnType<typeof useFaceEmbeddings>['data'],
  tracking: MatchTrackingRefs,
): { employeeId: string; employeeName: string } | null {
  // Liveness check between frames
  if (tracking.prevLandmarksRef.current && checkLiveness(tracking.prevLandmarksRef.current, result.landmarks)) {
    tracking.livenessPassedRef.current = true;
  }
  tracking.prevLandmarksRef.current = result.landmarks;

  const match = findBestMatch(result.descriptor, embeddings!);
  if (!match) {
    if (tracking.lastMatchIdRef.current) {
      tracking.matchCountRef.current = 0;
      tracking.lastMatchIdRef.current = null;
    }
    return null;
  }

  tracking.matchCountRef.current = match.employeeId === tracking.lastMatchIdRef.current
    ? tracking.matchCountRef.current + 1
    : 1;
  tracking.lastMatchIdRef.current = match.employeeId;

  if (tracking.matchCountRef.current >= CONSECUTIVE_MATCH_THRESHOLD && tracking.livenessPassedRef.current) {
    return match;
  }
  return null;
}

/* ─── Clock-in submission helper ─── */

async function submitClockIn(
  tenantId: string,
  employee: MatchedEmployee,
): Promise<string> {
  const now = new Date();
  const clockIn = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  await attendanceService.markAttendance(tenantId, {
    employeeId: employee.id, employeeName: employee.name,
    department: employee.department, date: getTodayTL(), clockIn, source: 'facial',
  });
  return clockIn;
}

/* ─── Reset match tracking refs ─── */

function resetMatchTracking(tracking: MatchTrackingRefs) {
  tracking.matchCountRef.current = 0;
  tracking.lastMatchIdRef.current = null;
  tracking.prevLandmarksRef.current = null;
  tracking.livenessPassedRef.current = false;
}

function scheduleAutoClose(
  ref: React.MutableRefObject<number | null>,
  clearFn: () => void,
  closeFn: () => void,
) {
  clearFn();
  ref.current = window.setTimeout(() => { closeFn(); ref.current = null; }, 2000);
}

function scheduleReset(
  ref: React.MutableRefObject<number | null>,
  resetFn: () => void,
) {
  ref.current = window.setTimeout(() => { resetFn(); ref.current = null; }, 3000);
}

/* ─── Custom hook: face clock-in state machine ─── */

function useFaceClockIn(
  open: boolean,
  onOpenChange: (open: boolean) => void,
  onSuccess?: () => void,
) {
  const { toast } = useToast();
  const tenantId = useTenantId();
  const { data: embeddings, isLoading: embeddingsLoading } = useFaceEmbeddings();

  const [state, setState] = useState<ClockInState>('loading');
  const [matchedEmployee, setMatchedEmployee] = useState<MatchedEmployee | null>(null);
  const [saving, setSaving] = useState(false);

  const matchCountRef = useRef(0);
  const lastMatchIdRef = useRef<string | null>(null);
  const prevLandmarksRef = useRef<DetectionResult['landmarks'] | null>(null);
  const livenessPassedRef = useRef(false);
  const tracking = useRef<MatchTrackingRefs>({ matchCountRef, lastMatchIdRef, prevLandmarksRef, livenessPassedRef }).current;
  const transitionTimeoutRef = useRef<number | null>(null);

  const clearTransitionTimeout = useCallback(() => {
    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
  }, []);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      clearTransitionTimeout();
      setState(embeddingsLoading ? 'loading' : 'scanning');
      setMatchedEmployee(null);
      resetMatchTracking(tracking);
    }
  }, [open, embeddingsLoading, clearTransitionTimeout, tracking]);

  useEffect(() => clearTransitionTimeout, [clearTransitionTimeout]);

  useEffect(() => {
    if (!embeddingsLoading && state === 'loading') setState('scanning');
  }, [embeddingsLoading, state]);

  const handleFaceDetected = useCallback(
    (result: DetectionResult) => {
      if (state !== 'scanning' || !embeddings?.length) return;

      const confirmedMatch = processFaceMatch(result, embeddings, tracking);
      if (!confirmedMatch) return;

      setState('matched');
      employeeService.getEmployeeById(tenantId, confirmedMatch.employeeId)
        .then(emp => {
          setMatchedEmployee({ id: confirmedMatch.employeeId, name: confirmedMatch.employeeName, department: emp?.jobDetails.department || '' });
          setState('confirming');
        })
        .catch(() => {
          setMatchedEmployee({ id: confirmedMatch.employeeId, name: confirmedMatch.employeeName, department: '' });
          setState('confirming');
        });
    },
    [state, embeddings, tenantId, tracking],
  );

  const handleConfirmClockIn = useCallback(async () => {
    if (!matchedEmployee) return;
    setSaving(true);
    try {
      const clockIn = await submitClockIn(tenantId, matchedEmployee);
      setState('success');
      toast({ title: 'Clocked In', description: `${matchedEmployee.name} clocked in at ${clockIn}.` });
      scheduleAutoClose(transitionTimeoutRef, clearTransitionTimeout, () => { onOpenChange(false); onSuccess?.(); });
    } catch {
      toast({ title: 'Clock-In Failed', description: 'Could not save attendance. Please try again.', variant: 'destructive' });
      setState('scanning');
    } finally { setSaving(false); }
  }, [matchedEmployee, tenantId, toast, clearTransitionTimeout, onOpenChange, onSuccess]);

  const handleNotRecognized = useCallback(() => {
    clearTransitionTimeout();
    setState('not-recognized');
    setMatchedEmployee(null);
    scheduleReset(transitionTimeoutRef, () => { setState('scanning'); resetMatchTracking(tracking); });
  }, [clearTransitionTimeout, tracking]);

  const handleClose = useCallback(() => { clearTransitionTimeout(); onOpenChange(false); }, [clearTransitionTimeout, onOpenChange]);

  return {
    state, matchedEmployee, saving, embeddings, handleFaceDetected,
    handleConfirmClockIn, handleNotRecognized, handleClose,
  };
}

/* ─── Sub-components ─── */

function ConfirmingPanel({
  employee, saving, onNotMe, onConfirm,
}: {
  employee: MatchedEmployee; saving: boolean;
  onNotMe: () => void; onConfirm: () => void;
}) {
  return (
    <div className="text-center space-y-4 py-4">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyan-50 dark:bg-cyan-950/30">
        <Check className="h-8 w-8 text-cyan-600" />
      </div>
      <div>
        <p className="text-lg font-semibold">{employee.name}</p>
        {employee.department && (
          <p className="text-sm text-muted-foreground">{employee.department}</p>
        )}
      </div>
      <div className="flex gap-2 justify-center">
        <Button variant="outline" onClick={onNotMe} disabled={saving}>Not Me</Button>
        <Button
          onClick={onConfirm} disabled={saving}
          className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-600 hover:to-teal-600"
        >
          {saving ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>) : 'Confirm Clock-In'}
        </Button>
      </div>
    </div>
  );
}

function SuccessPanel({ name }: { name: string }) {
  return (
    <div className="text-center space-y-3 py-6">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50 dark:bg-green-950/30">
        <Check className="h-8 w-8 text-green-600" />
      </div>
      <p className="text-lg font-semibold text-green-700 dark:text-green-400">{name} Clocked In</p>
    </div>
  );
}

function NotRecognizedPanel() {
  return (
    <div className="text-center space-y-3 py-6">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/30">
        <UserX className="h-8 w-8 text-red-500" />
      </div>
      <p className="text-sm text-muted-foreground">Returning to scanning...</p>
    </div>
  );
}

/* ─── Main component ─── */

export default function FaceClockIn({ open, onOpenChange, onSuccess }: FaceClockInProps) {
  const {
    state, matchedEmployee, saving, embeddings, handleFaceDetected,
    handleConfirmClockIn, handleNotRecognized, handleClose,
  } = useFaceClockIn(open, onOpenChange, onSuccess);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanFace className="h-5 w-5 text-cyan-500" />
            Face Clock-In
          </DialogTitle>
          <DialogDescription>{STATE_DESCRIPTIONS[state]}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {(state === 'loading' || state === 'scanning' || state === 'matched') && (
            <FaceCamera
              onFaceDetected={handleFaceDetected}
              active={open && (state === 'scanning' || state === 'matched')}
              showBoundingBox
            />
          )}

          {state === 'scanning' && embeddings && embeddings.length === 0 && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg text-sm text-yellow-700 dark:text-yellow-400">
              No employees have enrolled their face yet. Ask an admin to enroll employees first.
            </div>
          )}

          {state === 'confirming' && matchedEmployee && (
            <ConfirmingPanel
              employee={matchedEmployee} saving={saving}
              onNotMe={handleNotRecognized} onConfirm={handleConfirmClockIn}
            />
          )}

          {state === 'success' && matchedEmployee && <SuccessPanel name={matchedEmployee.name} />}
          {state === 'not-recognized' && <NotRecognizedPanel />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
