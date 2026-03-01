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

const CONSECUTIVE_MATCH_THRESHOLD = 3;

export default function FaceClockIn({ open, onOpenChange, onSuccess }: FaceClockInProps) {
  const { toast } = useToast();
  const tenantId = useTenantId();
  const { data: embeddings, isLoading: embeddingsLoading } = useFaceEmbeddings();

  const [state, setState] = useState<ClockInState>('loading');
  const [matchedEmployee, setMatchedEmployee] = useState<{
    id: string;
    name: string;
    department: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  // Consecutive match tracking
  const matchCountRef = useRef(0);
  const lastMatchIdRef = useRef<string | null>(null);
  const prevLandmarksRef = useRef<DetectionResult['landmarks'] | null>(null);
  const livenessPassedRef = useRef(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setState(embeddingsLoading ? 'loading' : 'scanning');
      setMatchedEmployee(null);
      matchCountRef.current = 0;
      lastMatchIdRef.current = null;
      prevLandmarksRef.current = null;
      livenessPassedRef.current = false;
    }
  }, [open, embeddingsLoading]);

  useEffect(() => {
    if (!embeddingsLoading && state === 'loading') {
      setState('scanning');
    }
  }, [embeddingsLoading, state]);

  const handleFaceDetected = useCallback(
    (result: DetectionResult) => {
      if (state !== 'scanning' || !embeddings?.length) return;

      // Liveness check between frames
      if (prevLandmarksRef.current) {
        if (checkLiveness(prevLandmarksRef.current, result.landmarks)) {
          livenessPassedRef.current = true;
        }
      }
      prevLandmarksRef.current = result.landmarks;

      // Match against registered embeddings
      const match = findBestMatch(result.descriptor, embeddings);

      if (match) {
        if (match.employeeId === lastMatchIdRef.current) {
          matchCountRef.current++;
        } else {
          matchCountRef.current = 1;
          lastMatchIdRef.current = match.employeeId;
        }

        // Require consecutive matches + liveness
        if (matchCountRef.current >= CONSECUTIVE_MATCH_THRESHOLD && livenessPassedRef.current) {
          setState('matched');

          // Look up department from embeddings (we don't store it there, so fetch employee)
          employeeService
            .getEmployeeById(tenantId, match.employeeId)
            .then(emp => {
              setMatchedEmployee({
                id: match.employeeId,
                name: match.employeeName,
                department: emp?.jobDetails.department || '',
              });
              setState('confirming');
            })
            .catch(() => {
              // Fallback: use name from embedding
              setMatchedEmployee({
                id: match.employeeId,
                name: match.employeeName,
                department: '',
              });
              setState('confirming');
            });
        }
      } else {
        // No match — reset consecutive count
        if (lastMatchIdRef.current) {
          matchCountRef.current = 0;
          lastMatchIdRef.current = null;
        }
      }
    },
    [state, embeddings, tenantId]
  );

  const handleConfirmClockIn = async () => {
    if (!matchedEmployee) return;

    setSaving(true);
    try {
      const now = new Date();
      const clockIn = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      await attendanceService.markAttendance(tenantId, {
        employeeId: matchedEmployee.id,
        employeeName: matchedEmployee.name,
        department: matchedEmployee.department,
        date: getTodayTL(),
        clockIn,
        source: 'facial',
      });

      setState('success');

      toast({
        title: 'Clocked In',
        description: `${matchedEmployee.name} clocked in at ${clockIn}.`,
      });

      // Auto-close after 2s
      setTimeout(() => {
        onOpenChange(false);
        onSuccess?.();
      }, 2000);
    } catch (error) {
      console.error('Clock-in failed:', error);
      toast({
        title: 'Clock-In Failed',
        description: 'Could not save attendance. Please try again.',
        variant: 'destructive',
      });
      setState('scanning');
    } finally {
      setSaving(false);
    }
  };

  const handleNotRecognized = () => {
    setState('not-recognized');
    // Auto-reset after 3s
    setTimeout(() => {
      if (state === 'not-recognized') {
        setState('scanning');
        matchCountRef.current = 0;
        lastMatchIdRef.current = null;
        livenessPassedRef.current = false;
      }
    }, 3000);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanFace className="h-5 w-5 text-cyan-500" />
            Face Clock-In
          </DialogTitle>
          <DialogDescription>
            {state === 'scanning' && 'Look at the camera to clock in.'}
            {state === 'loading' && 'Loading face data...'}
            {state === 'matched' && 'Identifying...'}
            {state === 'confirming' && 'Employee identified!'}
            {state === 'success' && 'Clock-in recorded!'}
            {state === 'not-recognized' && 'Face not recognized. Try again or use manual entry.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Camera feed — active during scanning */}
          {(state === 'loading' || state === 'scanning' || state === 'matched') && (
            <FaceCamera
              onFaceDetected={handleFaceDetected}
              active={open && (state === 'scanning' || state === 'matched')}
              showBoundingBox
            />
          )}

          {/* No embeddings registered */}
          {state === 'scanning' && embeddings && embeddings.length === 0 && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg text-sm text-yellow-700 dark:text-yellow-400">
              No employees have enrolled their face yet. Ask an admin to enroll employees first.
            </div>
          )}

          {/* Confirming match */}
          {state === 'confirming' && matchedEmployee && (
            <div className="text-center space-y-4 py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyan-50 dark:bg-cyan-950/30">
                <Check className="h-8 w-8 text-cyan-600" />
              </div>
              <div>
                <p className="text-lg font-semibold">{matchedEmployee.name}</p>
                {matchedEmployee.department && (
                  <p className="text-sm text-muted-foreground">{matchedEmployee.department}</p>
                )}
              </div>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={handleNotRecognized} disabled={saving}>
                  Not Me
                </Button>
                <Button
                  onClick={handleConfirmClockIn}
                  disabled={saving}
                  className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-600 hover:to-teal-600"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Confirm Clock-In'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Success state */}
          {state === 'success' && matchedEmployee && (
            <div className="text-center space-y-3 py-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50 dark:bg-green-950/30">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-lg font-semibold text-green-700 dark:text-green-400">
                {matchedEmployee.name} Clocked In
              </p>
            </div>
          )}

          {/* Not recognized */}
          {state === 'not-recognized' && (
            <div className="text-center space-y-3 py-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/30">
                <UserX className="h-8 w-8 text-red-500" />
              </div>
              <p className="text-sm text-muted-foreground">
                Returning to scanning...
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
