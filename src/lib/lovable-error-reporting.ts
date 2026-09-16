/**
 * FlightIQ error reporting utility.
 * Logs errors in development and can be wired to monitoring services (e.g. Sentry) in production.
 */
export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  console.error("[FlightIQ Error]", error, context);
}

// Backward compatibility export if ever referenced
export const reportLovableError = reportError;
