import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { translateError, getCurrentLang } from "./i18n";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

// Auth is a signed, httpOnly session cookie set by the server on sign-in.
// The browser sends it automatically ("credentials: include"); the client
// never stores or sends the user id itself.

/**
 * An error from the API. `message` is already translated into the language
 * the user picked; `code` is the server's stable error code.
 */
export class ApiError extends Error {
  constructor(public status: number, public code: string, public params?: Record<string, string>) {
    super(translateError({ code, params }, getCurrentLang()));
  }
}

async function throwIfResNotOk(res: Response) {
  if (res.ok) return;
  let body: { code?: string; params?: Record<string, string> } = {};
  try {
    body = await res.json();
  } catch {
    // Not JSON (e.g. a host error page): show the generic message.
  }
  throw new ApiError(res.status, body.code ?? "generic", body.params);
}

// fetch() that turns "no connection" into a translated error.
async function request(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE}${url}`, { ...init, credentials: "include" });
  } catch {
    throw new ApiError(0, "network");
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await request(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
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
    const res = await request(queryKey.join("/"), {});

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
