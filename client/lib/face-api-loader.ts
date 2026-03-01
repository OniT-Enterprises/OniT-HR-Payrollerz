/**
 * Face API utility layer
 * Lazy-loads models, runs detection, and matches embeddings — all client-side
 */

import * as faceapi from '@vladmandic/face-api';

const MODEL_URL = '/models/face-api';
let modelsLoaded = false;

/**
 * Lazy-load the 3 required models (SSD MobileNet, Landmarks 68, Recognition)
 */
export async function ensureModelsLoaded(): Promise<void> {
  if (modelsLoaded) return;

  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);

  modelsLoaded = true;
}

export interface DetectionResult {
  descriptor: Float32Array;
  box: { x: number; y: number; width: number; height: number };
  landmarks: faceapi.FaceLandmarks68;
}

/**
 * Detect a single face and return its 128-dim descriptor + bounding box
 * Returns null if no face detected
 */
export async function detectAndDescribe(
  input: HTMLVideoElement | HTMLCanvasElement
): Promise<DetectionResult | null> {
  const result = await faceapi
    .detectSingleFace(input)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result) return null;

  const { x, y, width, height } = result.detection.box;
  return {
    descriptor: result.descriptor,
    box: { x, y, width, height },
    landmarks: result.landmarks,
  };
}

/**
 * Euclidean distance between two 128-dim embeddings
 */
export function computeDistance(a: Float32Array | number[], b: Float32Array | number[]): number {
  return faceapi.euclideanDistance(
    a instanceof Float32Array ? Array.from(a) : a,
    b instanceof Float32Array ? Array.from(b) : b,
  );
}

export interface MatchResult {
  employeeId: string;
  employeeName: string;
  distance: number;
}

/**
 * Find the best matching employee from registered embeddings
 * Returns null if no match below threshold
 */
export function findBestMatch(
  probe: Float32Array | number[],
  registered: { employeeId: string; employeeName: string; embeddings: number[][] }[],
  threshold: number = 0.5
): MatchResult | null {
  let bestMatch: MatchResult | null = null;

  for (const reg of registered) {
    // Compare against all reference embeddings, keep the minimum distance
    for (const refEmb of reg.embeddings) {
      const dist = computeDistance(probe, refEmb);
      if (dist < threshold && (!bestMatch || dist < bestMatch.distance)) {
        bestMatch = {
          employeeId: reg.employeeId,
          employeeName: reg.employeeName,
          distance: dist,
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Simple liveness check: compares nose tip displacement between two landmark sets
 * Returns true if head movement detected (nose displacement > minPixels)
 */
export function checkLiveness(
  landmarks1: faceapi.FaceLandmarks68,
  landmarks2: faceapi.FaceLandmarks68,
  minPixels: number = 2
): boolean {
  const nose1 = landmarks1.getNose()[3]; // nose tip
  const nose2 = landmarks2.getNose()[3];

  const dx = nose1.x - nose2.x;
  const dy = nose1.y - nose2.y;
  const displacement = Math.sqrt(dx * dx + dy * dy);

  return displacement > minPixels;
}
