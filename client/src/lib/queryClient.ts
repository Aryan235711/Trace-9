import { QueryClient, QueryFunction } from "@tanstack/react-query";

function getStatusCodeFromError(err: unknown): number | undefined {
  const message = err instanceof Error ? err.message : String(err);
  const match = /^([0-9]{3}):/.exec(message);
  if (!match) return undefined;
  const code = Number(match[1]);
  return Number.isFinite(code) ? code : undefined;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      // Avoid indefinite cache growth + allow background refresh on remount.
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: (failureCount, error) => {
        const status = getStatusCodeFromError(error);
        // Don't retry client errors (incl. auth).
        if (status && status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
