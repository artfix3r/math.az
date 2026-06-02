import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

// Lightweight auth: we keep the logged-in user id in a module variable and
// attach it to every request. We ALSO persist it (with a timestamp) in
// localStorage so a page refresh keeps the user signed in for a limited window.
const AUTH_KEY = "mathaz.auth";
export const SESSION_TTL_MS = 2.5 * 60 * 60 * 1000; // 2.5 hours

let currentUserId: number | null = null;

export function setCurrentUserId(id: number | null) {
  currentUserId = id;
  try {
    if (id != null) {
      localStorage.setItem(AUTH_KEY, JSON.stringify({ id, ts: Date.now() }));
    } else {
      localStorage.removeItem(AUTH_KEY);
    }
  } catch {
    // localStorage may be unavailable (e.g. sandboxed iframe preview) — auth
    // still works in-memory for the current page load.
  }
}

// Returns a still-valid persisted user id, or null if absent/expired.
export function getPersistedUserId(): number | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const { id, ts } = JSON.parse(raw) as { id: number; ts: number };
    if (typeof id !== "number" || typeof ts !== "number") return null;
    if (Date.now() - ts > SESSION_TTL_MS) {
      localStorage.removeItem(AUTH_KEY);
      return null;
    }
    // Re-arm the in-memory id so API calls during rehydration are authenticated.
    currentUserId = id;
    return id;
  } catch {
    return null;
  }
}
function authHeaders(base: Record<string, string> = {}): Record<string, string> {
  if (currentUserId != null) base["x-user-id"] = String(currentUserId);
  return base;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.clone().json();
      if (body?.message) message = body.message;
      else message = (await res.text()) || res.statusText;
    } catch {
      message = (await res.text()) || res.statusText;
    }
    throw new Error(message);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: authHeaders(data ? { "Content-Type": "application/json" } : {}),
    body: data ? JSON.stringify(data) : undefined,
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
    const res = await fetch(`${API_BASE}${queryKey.join("/")}`, {
      headers: authHeaders(),
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
      staleTime: 30_000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
