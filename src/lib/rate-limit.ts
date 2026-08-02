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

/**
 * WR-06: reverts one optimistically-recorded failure. authorize() now calls
 * recordLoginFailure() BEFORE the expensive bcrypt compare (not after), closing the TOCTOU
 * window where concurrent requests for the same key could all observe "still under
 * threshold" during that gap — then calls this to undo the count when the credentials turn
 * out to be valid, so a successful login isn't counted against the caller.
 */
export function undoLoginFailure(key: string): void {
  const record = attempts.get(key);
  if (record && record.count > 0) {
    record.count -= 1;
  }
}
