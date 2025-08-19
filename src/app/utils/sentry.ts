// Sentry has been disabled - this file provides stub implementations

/** Stub for Sentry.io exception reporting - does nothing */
export const reportException = (name: string, e: any, errorInfo?: Record<string, unknown>) => {
  // Sentry has been removed - this is a no-op stub
  console.warn(
    'Sentry reporting disabled. Exception would have been reported:',
    name,
    e,
    errorInfo,
  );
};

/** Stub for setTag - does nothing */
export const setTag = (_key: string, _value: string) => {
  // No-op stub
};

/** Stub for setUser - does nothing */
export const setUser = (_user: { id: string }) => {
  // No-op stub
};

/** Stub for startSpan - executes the callback immediately */
export const startSpan = <T>(_options: any, callback: () => T): T => callback();

/** Stub for withProfiler - returns the component as-is */
export const withProfiler = <T>(component: T): T => component;

/** Stub for getClient - returns null */
export const getClient = () => null;
