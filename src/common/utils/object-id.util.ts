import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

/**
 * Checks whether the given value is a valid MongoDB ObjectId or ObjectId hex string.
 */
export function isValidObjectId(id: unknown): id is string | Types.ObjectId {
  if (!id) return false;
  if (id instanceof Types.ObjectId) return true;
  if (typeof id === 'string') {
    return (
      Types.ObjectId.isValid(id) && new Types.ObjectId(id).toString() === id
    );
  }
  return false;
}

/**
 * Converts a string or Types.ObjectId into a Types.ObjectId.
 * Returns null if the value is not valid.
 */
export function tryToObjectId(id: unknown): Types.ObjectId | null {
  if (id instanceof Types.ObjectId) return id;
  if (typeof id === 'string' && Types.ObjectId.isValid(id)) {
    return new Types.ObjectId(id);
  }
  return null;
}

/**
 * Converts a valid ObjectId string or Types.ObjectId to Types.ObjectId,
 * or throws a BadRequestException (or custom error).
 */
export function toObjectId(
  id: unknown,
  fieldName = 'ID',
  errorFactory?: (msg: string) => Error,
): Types.ObjectId {
  const converted = tryToObjectId(id);
  if (!converted) {
    const message = `Invalid ${fieldName} format: '${String(id)}'`;
    if (errorFactory) {
      throw errorFactory(message);
    }
    throw new BadRequestException(message);
  }
  return converted;
}

/**
 * Asserts that the given value is a valid ObjectId, returning the Types.ObjectId.
 */
export function assertObjectId(
  id: unknown,
  fieldName = 'ID',
  errorFactory?: (msg: string) => Error,
): Types.ObjectId {
  return toObjectId(id, fieldName, errorFactory);
}

/**
 * Extracts a normalized string ID from an ObjectId, a string, or an entity containing `_id`.
 */
export function extractIdString(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (val instanceof Types.ObjectId) return val.toString();
  if (typeof val === 'object' && val !== null) {
    const record = val as Record<string, unknown>;
    if (record._id) return extractIdString(record._id);
    if (record.id) return extractIdString(record.id);
  }
  return null;
}

/**
 * Compares two entity IDs for equality regardless of whether they are strings,
 * ObjectIds, or populated documents with `_id`.
 */
export function areObjectIdsEqual(a: unknown, b: unknown): boolean {
  const strA = extractIdString(a);
  const strB = extractIdString(b);
  if (!strA || !strB) return false;
  return strA === strB;
}
