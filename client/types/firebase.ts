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

