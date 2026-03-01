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
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastDetectionRef = useRef<DetectionResult | null>(null);

  const [status, setStatus] = useState<'loading' | 'ready' | 'no-camera' | 'permission-denied'>('loading');

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
    if (!active) {
      stopStream();
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        // Load face-api models in parallel with camera
        const [stream] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: 640, height: 480 },
          }),
          ensureModelsLoaded(),
        ]);

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setStatus('ready');
        startDetectionLoop();
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('Permission') || message.includes('NotAllowed')) {
          setStatus('permission-denied');
          onError?.('Camera permission denied. Please allow camera access.');
        } else if (message.includes('NotFound') || message.includes('DevicesNotFound')) {
          setStatus('no-camera');
          onError?.('No camera found on this device.');
        } else {
          setStatus('no-camera');
          onError?.(message);
        }
      }
    }

    function startDetectionLoop() {
      let lastTime = 0;
      const INTERVAL = 100; // ~10fps

      const loop = async (timestamp: number) => {
        if (cancelled || !videoRef.current || videoRef.current.paused) return;

        if (timestamp - lastTime >= INTERVAL) {
          lastTime = timestamp;
          try {
            const result = await detectAndDescribe(videoRef.current);
            if (result) {
              lastDetectionRef.current = result;
              onFaceDetected?.(result);
              drawOverlay(result);

              if (autoCapture && onCapture) {
                captureFrame(result.descriptor);
              }
            } else {
              clearOverlay();
              lastDetectionRef.current = null;
            }
          } catch {
            // Detection can fail transiently — just skip the frame
          }
        }

        rafRef.current = requestAnimationFrame(loop);
      };

      rafRef.current = requestAnimationFrame(loop);
    }

    init();

    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function drawOverlay(result: DetectionResult) {
    if (!showBoundingBox || !canvasRef.current || !videoRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;

    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.strokeStyle = '#06b6d4'; // cyan-500
    ctx.lineWidth = 2;
    ctx.strokeRect(result.box.x, result.box.y, result.box.width, result.box.height);

    // Corner accents
    const cornerLen = 12;
    ctx.lineWidth = 3;
    const { x, y, width, height } = result.box;
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

  function clearOverlay() {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }

  function captureFrame(descriptor: Float32Array) {
    if (!videoRef.current) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = videoRef.current.videoWidth;
    tempCanvas.height = videoRef.current.videoHeight;
    const ctx = tempCanvas.getContext('2d');
    ctx?.drawImage(videoRef.current, 0, 0);

    tempCanvas.toBlob(
      blob => {
        if (blob) onCapture?.(blob, descriptor);
      },
      'image/jpeg',
      0.85
    );
  }

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-80 bg-muted rounded-lg">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500 mb-3" />
        <p className="text-sm text-muted-foreground">Loading camera & face detection models...</p>
      </div>
    );
  }

  if (status === 'permission-denied') {
    return (
      <div className="flex flex-col items-center justify-center h-80 bg-muted rounded-lg">
        <AlertTriangle className="h-8 w-8 text-yellow-500 mb-3" />
        <p className="text-sm font-medium">Camera Permission Required</p>
        <p className="text-xs text-muted-foreground mt-1">
          Please allow camera access in your browser settings.
        </p>
      </div>
    );
  }

  if (status === 'no-camera') {
    return (
      <div className="flex flex-col items-center justify-center h-80 bg-muted rounded-lg">
        <Camera className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">No Camera Found</p>
        <p className="text-xs text-muted-foreground mt-1">
          Connect a camera or use a device with a built-in camera.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-[4/3] bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover mirror"
        autoPlay
        playsInline
        muted
        style={{ transform: 'scaleX(-1)' }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ transform: 'scaleX(-1)' }}
      />
    </div>
  );
}
