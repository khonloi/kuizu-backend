export function getAllowedCorsOrigins(
  corsAllowedOrigins?: string,
  clientUrl = 'http://localhost:3001',
  isProduction = false,
): string[] {
  if (corsAllowedOrigins) {
    return corsAllowedOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  return isProduction
    ? [clientUrl]
    : Array.from(
        new Set([clientUrl, 'http://localhost:3000', 'http://localhost:3001']),
      );
}
