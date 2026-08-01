// O1: minimal in-memory login brute-force limiter — 5 failed attempts / 10 minutes per
// email+IP key. Not a new dependency (research Don't Hand-Roll row): storage/cleanup lives
// in this one small module, reused by src/auth.ts's authorize().
// ponytail: in-memory Map, single-instance only, resets on restart — upgrade to a DB/Redis
// store when the app goes multi-instance (research A3).

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

interface AttemptRecord {
  count: number;
  firstFailureAt: number;
}

const attempts = new Map<string, AttemptRecord>();

function pruneIfExpired(key: string, now: number) {
  const record = attempts.get(key);
  if (record && now - record.firstFailureAt >= WINDOW_MS) {
    attempts.delete(key);
  }
}

/** Returns true if the caller is still under the attempt threshold (allowed to try). */
export function checkLoginRateLimit(key: string): boolean {
  const now = Date.now();
  pruneIfExpired(key, now);
  const record = attempts.get(key);
  return !record || record.count < MAX_ATTEMPTS;
}

/** Records a failed login attempt for key, starting a new window if none is active. */
export function recordLoginFailure(key: string): void {
  const now = Date.now();
  pruneIfExpired(key, now);
  const record = attempts.get(key);
  if (record) {
    record.count += 1;
  } else {
    attempts.set(key, { count: 1, firstFailureAt: now });
  }
}
