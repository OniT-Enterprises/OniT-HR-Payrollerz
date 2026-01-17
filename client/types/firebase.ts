/**
 * Firebase Type Utilities
 * Shared types for Firestore Timestamp handling
 */

import { Timestamp, FieldValue } from 'firebase/firestore';

/**
 * Firestore Timestamp or JavaScript Date
 * Use this type for fields that store timestamps in Firestore.
 * - When reading: Firestore returns Timestamp objects
 * - When writing: Can use serverTimestamp() which returns FieldValue
 */
export type FirestoreTimestamp = Timestamp | Date | FieldValue;

/**
 * Optional Firestore Timestamp
 * For optional timestamp fields
 */
export type OptionalTimestamp = FirestoreTimestamp | null | undefined;

/**
 * Convert a Firestore Timestamp to Date
 * Handles Timestamp, Date, and FieldValue inputs safely
 * Note: FieldValue (from serverTimestamp()) cannot be converted - returns null
 */
export function toDate(value: FirestoreTimestamp | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  // Handle plain objects with toDate method (from Firestore)
  if (typeof (value as Timestamp).toDate === 'function') {
    return (value as Timestamp).toDate();
  }
  // FieldValue cannot be converted to Date (it's only for writes)
  return null;
}

/**
 * Convert a Firestore Timestamp to ISO string
 * Useful for serialization
 */
export function toISOString(value: FirestoreTimestamp | null | undefined): string | null {
  const date = toDate(value);
  return date ? date.toISOString() : null;
}

/**
 * Check if a value is a Firestore Timestamp
 */
export function isTimestamp(value: unknown): value is Timestamp {
  return value instanceof Timestamp ||
    (typeof value === 'object' &&
     value !== null &&
     typeof (value as Timestamp).toDate === 'function');
}
