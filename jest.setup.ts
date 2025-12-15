type HandleSummary = {
  type: string;
  details?: Record<string, unknown>;
};

function summarizeHandle(handle: any): HandleSummary {
  const type = handle?.constructor?.name ?? typeof handle;

  if (type === 'Timeout') {
    return {
      type,
      details: {
        idleTimeout: handle?._idleTimeout,
        idleStart: handle?._idleStart,
        repeat: handle?._repeat,
      },
    };
  }

  if (type === 'Server') {
    return {
      type,
      details: {
        listening: handle?.listening,
        address: typeof handle?.address === 'function' ? handle.address() : undefined,
      },
    };
  }

  return { type };
}

// Debug helper to chase intermittent "worker failed to exit gracefully" warnings.
// Enable with: JEST_DEBUG_HANDLES=1
if (process.env.JEST_DEBUG_HANDLES === '1') {
  // Capture baseline at file start (each test file has its own environment).
  const baseline = new Set<any>((process as any)._getActiveHandles?.() ?? []);

  afterAll(async () => {
    // Let any queued microtasks run.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const activeHandles: any[] = (process as any)._getActiveHandles?.() ?? [];
    const leaked = activeHandles.filter((h) => !baseline.has(h));

    if (leaked.length === 0) return;

    const testPath = (globalThis as any).expect?.getState?.().testPath;
    const summaries = leaked.map(summarizeHandle);

    // eslint-disable-next-line no-console
    console.warn(
      `[jest] Potential leaked handles (${leaked.length}) in ${testPath ?? 'unknown'} (pid ${process.pid}):`,
      summaries
    );
  });
}
