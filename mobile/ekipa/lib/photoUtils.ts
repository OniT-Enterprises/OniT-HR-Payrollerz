/**
 * Photo utilities — compress, save locally, upload to Firebase Storage
 * Uses expo-file-system v18+ class-based API (Paths, File, Directory)
 */
import * as ImageManipulator from 'expo-image-manipulator';
import { Paths, File, Directory } from 'expo-file-system';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

const MAX_WIDTH = 1200;
const JPEG_QUALITY = 0.6;

function getPhotosDir(): Directory {
  return new Directory(Paths.document, 'crew_photos');
}

function ensurePhotosDir(): void {
  const dir = getPhotosDir();
  if (!dir.exists) {
    dir.create();
  }
}

/**
 * Compress a photo to max 1200px width, JPEG quality 0.6
 * Target: 200-500KB output
 */
export async function compressPhoto(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_WIDTH } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

/**
 * Save photo from temp location to persistent app storage
 */
export async function savePhotoLocally(
  tempUri: string,
  batchId: string
): Promise<string> {
  ensurePhotosDir();
  const destFile = new File(getPhotosDir(), `${batchId}.jpg`);
  const srcFile = new File(tempUri);
  srcFile.copy(destFile);
  return destFile.uri;
}

/**
 * Upload photo to Firebase Storage and return the download URL
 * Path: attendance_photos/{tenantId}/{date}/{batchId}.jpg
 */
export async function uploadPhoto(
  localPath: string,
  tenantId: string,
  batchId: string,
  date: string
): Promise<string> {
  const file = new File(localPath);
  const blob = new Blob([await file.arrayBuffer()], { type: 'image/jpeg' });

  const storageRef = ref(
    storage,
    `attendance_photos/${tenantId}/${date}/${batchId}.jpg`
  );
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}

/**
 * Delete local photo after successful sync
 */
export function cleanupLocalPhoto(localPath: string): void {
  try {
    const file = new File(localPath);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Non-critical — local cleanup failure is acceptable
  }
}
