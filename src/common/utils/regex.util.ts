/**
 * Safely escape characters that have special meaning in regular expressions.
 * Prevents ReDoS attacks and unintended pattern matching in search queries.
 */
export function escapeRegex(input: string): string {
  if (!input) return '';
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
