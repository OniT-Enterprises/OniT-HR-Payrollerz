/**
 * FaceCamera — Reusable camera + face detection overlay component
 * Runs ~10fps detection loop via requestAnimationFrame
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, AlertTriangle, Loader2 } from 'lucide-react';
import { ensureModelsLoaded, detectAndDescribe, type DetectionResult } from '@/lib/face-api-loader';

interface FaceCameraProps {
  onFaceDetected?: (result: DetectionResult) => void;
  onCapture?: (blob: Blob, descriptor: Float32Array) => void;
  onError?: (error: string) => void;
  autoCapture?: boolean;
  showBoundingBox?: boolean;
  active?: boolean;
}

/* ─── Canvas drawing helpers ─── */

function drawCornerAccents(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, width: number, height: number,
) {
  const cornerLen = 12;
  ctx.lineWidth = 3;
  // Top-left
  ctx.beginPath();
  ctx.moveTo(x, y + cornerLen);
  ctx.lineTo(x, y);
  ctx.lineTo(x + cornerLen, y);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(x + width - cornerLen, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width, y + cornerLen);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(x, y + height - cornerLen);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x + cornerLen, y + height);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(x + width - cornerLen, y + height);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x + width, y + height - cornerLen);
  ctx.stroke();
}

function drawBoundingBox(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  result: DetectionResult,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#06b6d4'; // cyan-500
  ctx.lineWidth = 2;
  ctx.strokeRect(result.box.x, result.box.y, result.box.width, result.box.height);

  drawCornerAccents(ctx, result.box.x, result.box.y, result.box.width, result.box.height);
}

function clearCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  ctx?.clearRect(0, 0, canvas.width, canvas.height);
}

function captureVideoFrame(
  video: HTMLVideoElement,
  descriptor: Float32Array,
  onCapture: ((blob: Blob, descriptor: Float32Array) => void) | undefined,
) {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = video.videoWidth;
  tempCanvas.height = video.videoHeight;
  const ctx = tempCanvas.getContext('2d');
  ctx?.drawImage(video, 0, 0);

  tempCanvas.toBlob(
    blob => { if (blob) onCapture?.(blob, descriptor); },
    'image/jpeg',
    0.85,
  );
}

/* ─── Camera error classifier ─── */

type CameraStatus = 'loading' | 'ready' | 'no-camera' | 'permission-denied';

function classifyCameraError(err: unknown): { status: CameraStatus; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('Permission') || message.includes('NotAllowed')) {
    return { status: 'permission-denied', message: 'Camera permission denied. Please allow camera access.' };
  }
  if (message.includes('NotFound') || message.includes('DevicesNotFound')) {
    return { status: 'no-camera', message: 'No camera found on this device.' };
  }
  return { status: 'no-camera', message };
}

/* ─── Camera refs type ─── */

type CameraRefs = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onFaceDetectedRef: React.MutableRefObject<((r: DetectionResult) => void) | undefined>;
  onCaptureRef: React.MutableRefObject<((b: Blob, d: Float32Array) => void) | undefined>;
  onErrorRef: React.MutableRefObject<((e: string) => void) | undefined>;
  autoCaptureRef: React.MutableRefObject<boolean>;
  showBoundingBoxRef: React.MutableRefObject<boolean>;
};

/* ─── Process a single detection frame ─── */

async function processDetectionFrame(video: HTMLVideoElement, refs: CameraRefs) {
  const result = await detectAndDescribe(video);
  if (result) {
    refs.onFaceDetectedRef.current?.(result);
    if (refs.showBoundingBoxRef.current && refs.canvasRef.current) {
      drawBoundingBox(refs.canvasRef.current, video, result);
    }
    if (refs.autoCaptureRef.current && refs.onCaptureRef.current) {
      captureVideoFrame(video, result.descriptor, refs.onCaptureRef.current);
    }
  } else if (refs.canvasRef.current) {
    clearCanvas(refs.canvasRef.current);
  }
}

/* ─── Start detection loop (returns cancel fn) ─── */

function startDetectionLoop(
  refs: CameraRefs,
  rafRef: React.MutableRefObject<number>,
  cancelledRef: { current: boolean },
) {
  let lastTime = 0;
  const INTERVAL = 100; // ~10fps

  const loop = async (timestamp: number) => {
    if (cancelledRef.current || !refs.videoRef.current || refs.videoRef.current.paused) return;
    if (timestamp - lastTime >= INTERVAL) {
      lastTime = timestamp;
      try {
        await processDetectionFrame(refs.videoRef.current, refs);
      } catch { /* Detection can fail transiently — skip frame */ }
    }
    rafRef.current = requestAnimationFrame(loop);
  };
  rafRef.current = requestAnimationFrame(loop);
}

/* ─── Initialize camera stream ─── */

async function initCamera(
  refs: CameraRefs,
  streamRef: React.MutableRefObject<MediaStream | null>,
  rafRef: React.MutableRefObject<number>,
  cancelledRef: { current: boolean },
  setStatus: (s: CameraStatus) => void,
) {
  setStatus('loading');
  const [stream] = await Promise.all([
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } }),
    ensureModelsLoaded(),
  ]);
  if (cancelledRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

  streamRef.current = stream;
  if (refs.videoRef.current) {
    refs.videoRef.current.srcObject = stream;
    await refs.videoRef.current.play();
  }
  setStatus('ready');
  startDetectionLoop(refs, rafRef, cancelledRef);
}

/* ─── Custom hook: camera + detection loop ─── */

function useFaceCamera(active: boolean, refs: CameraRefs) {
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [status, setStatus] = useState<CameraStatus>('loading');

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  useEffect(() => {
    if (!active) { stopStream(); return; }

    const cancelledRef = { current: false };

    initCamera(refs, streamRef, rafRef, cancelledRef, setStatus).catch((err: unknown) => {
      if (cancelledRef.current) return;
      const classified = classifyCameraError(err);
      setStatus(classified.status);
      refs.onErrorRef.current?.(classified.message);
    });

    return () => { cancelledRef.current = true; stopStream(); };
  }, [active, stopStream, refs]);

  return status;
}

/* ─── Status overlay sub-components ─── */

function LoadingOverlay() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
      <Loader2 className="h-8 w-8 animate-spin text-cyan-500 mb-3" />
      <p className="text-sm text-muted-foreground">Loading camera & face detection models...</p>
    </div>
  );
}

function PermissionDeniedOverlay() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
      <AlertTriangle className="h-8 w-8 text-yellow-500 mb-3" />
      <p className="text-sm font-medium">Camera Permission Required</p>
      <p className="text-xs text-muted-foreground mt-1">
        Please allow camera access in your browser settings.
      </p>
    </div>
  );
}

function NoCameraOverlay() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
      <Camera className="h-8 w-8 text-muted-foreground mb-3" />
      <p className="text-sm font-medium">No Camera Found</p>
      <p className="text-xs text-muted-foreground mt-1">
        Connect a camera or use a device with a built-in camera.
      </p>
    </div>
  );
}

/* ─── Main component ─── */

export default function FaceCamera({
  onFaceDetected,
  onCapture,
  onError,
  autoCapture = false,
  showBoundingBox = true,
  active = true,
}: FaceCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onFaceDetectedRef = useRef(onFaceDetected);
  const onCaptureRef = useRef(onCapture);
  const onErrorRef = useRef(onError);
  const autoCaptureRef = useRef(autoCapture);
  const showBoundingBoxRef = useRef(showBoundingBox);

  useEffect(() => { onFaceDetectedRef.current = onFaceDetected; }, [onFaceDetected]);
  useEffect(() => { onCaptureRef.current = onCapture; }, [onCapture]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { autoCaptureRef.current = autoCapture; }, [autoCapture]);
  useEffect(() => { showBoundingBoxRef.current = showBoundingBox; }, [showBoundingBox]);

  const status = useFaceCamera(active, {
    videoRef, canvasRef, onFaceDetectedRef, onCaptureRef, onErrorRef, autoCaptureRef, showBoundingBoxRef,
  });

  return (
    <div className="relative w-full aspect-[4/3] bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover mirror"
        autoPlay playsInline muted
        style={{ transform: 'scaleX(-1)' }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ transform: 'scaleX(-1)' }}
      />

      {status === 'loading' && <LoadingOverlay />}
      {status === 'permission-denied' && <PermissionDeniedOverlay />}
      {status === 'no-camera' && <NoCameraOverlay />}
    </div>
  );
}
