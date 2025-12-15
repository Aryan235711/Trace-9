type DebugPayload = Record<string, unknown>;

function safeUserId(userId: string): string {
  return String(userId || 'unknown').replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function writeDebugArtifact(event: string, userId: string, payload: DebugPayload) {
  if (process.env.NODE_ENV !== 'test') return;
  if (process.env.ORCH_DEBUG_ARTIFACTS !== '1') return;

  try {
    // Use require to avoid adding node typings/config churn.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path');

    const dir = path.join(process.cwd(), 'tmp', 'orch-debug');
    fs.mkdirSync(dir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const worker = process.env.JEST_WORKER_ID ? `w${process.env.JEST_WORKER_ID}` : 'w?';
    const file = `${stamp}-${worker}-${safeUserId(userId)}-${String(event).replace(/[^a-zA-Z0-9._-]/g, '_')}.json`;

    const fullPath = path.join(dir, file);
    fs.writeFileSync(
      fullPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          event,
          userId,
          payload,
        },
        null,
        2
      ),
      'utf8'
    );
  } catch {
    // Never fail tests because debug output failed.
  }
}
