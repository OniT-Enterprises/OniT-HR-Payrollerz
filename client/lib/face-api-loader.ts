/**
 * Face API utility layer
 * Lazy-loads models, runs detection, and matches embeddings — all client-side
 */

const MODEL_URL = '/models/face-api';
let modelsLoaded = false;
let faceApiModulePromise: Promise<typeof import('@vladmandic/face-api')> | null = null;

function getFaceApi() {
  if (!faceApiModulePromise) {
    faceApiModulePromise = import('@vladmandic/face-api');
  }
  return faceApiModulePromise;
}

/**
 * Lazy-load the 3 required models (SSD MobileNet, Landmarks 68, Recognition)
 */
export async function ensureModelsLoaded(): Promise<void> {
  if (modelsLoaded) return;
  const faceapi = await getFaceApi();

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
  landmarks: FaceLandmarksLike;
}

export interface FaceLandmarksLike {
  getNose(): Array<{ x: number; y: number }>;
}

/**
 * Detect a single face and return its 128-dim descriptor + bounding box
 * Returns null if no face detected
 */
export async function detectAndDescribe(
  input: HTMLVideoElement | HTMLCanvasElement
): Promise<DetectionResult | null> {
  const faceapi = await getFaceApi();
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
function computeDistance(a: Float32Array | number[], b: Float32Array | number[]): number {
  const left = a instanceof Float32Array ? a : Float32Array.from(a);
  const right = b instanceof Float32Array ? b : Float32Array.from(b);
  const length = Math.min(left.length, right.length);
  let sum = 0;
  for (let i = 0; i < length; i += 1) {
    const diff = left[i] - right[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

interface MatchResult {
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
  landmarks1: FaceLandmarksLike,
  landmarks2: FaceLandmarksLike,
  minPixels: number = 2
): boolean {
  const nose1 = landmarks1.getNose()[3]; // nose tip
  const nose2 = landmarks2.getNose()[3];

  const dx = nose1.x - nose2.x;
  const dy = nose1.y - nose2.y;
  const displacement = Math.sqrt(dx * dx + dy * dy);

  return displacement > minPixels;
}
