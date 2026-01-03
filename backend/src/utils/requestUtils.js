/**
 * Check if the request is from localhost
 * Can be disabled by setting FORCE_REMOTE=1 in environment variables
 */
export function isLocalRequest(req) {
  // If FORCE_REMOTE is set, always treat as remote
  if (process.env.FORCE_REMOTE === '1' || process.env.FORCE_REMOTE === 'true') {
    return false;
  }

  const host = req.hostname || req.get('host') || '';
  return host === 'localhost' || host === '127.0.0.1' || host.startsWith('localhost:');
}
