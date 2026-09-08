import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";

const configuredApiBase = String(import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const API_BASE = configuredApiBase || (Capacitor.isNativePlatform() ? "https://add-smartregnskab.onrender.com" : "");

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

/**
 * Sessionstokenet lever KUN i hukommelsen. localStorage/sessionStorage/cookies er
 * blokeret i den sandboxede iframe, så det kan ikke gemmes på tværs af genindlæsninger.
 * Modulniveau-variabel (ikke React state), så apiRequest kan læse den uden hooks.
 */
let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}
export function getAuthToken() {
  return authToken;
}
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

function authHeaders(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

/** Fejl med HTTP-status og den strukturerede fejlkode fra backenden. */
export class ApiError extends Error {
  status: number;
  code?: string;
  payload?: any;
  constructor(status: number, message: string, payload?: any) {
    super(message);
    this.status = status;
    this.code = payload?.code;
    this.payload = payload;
  }
}

async function toError(res: Response): Promise<ApiError> {
  const raw = await res.text();
  let payload: any = undefined;
  let message = res.statusText;
  try {
    payload = JSON.parse(raw);
    message = payload?.error || message;
  } catch {
    message = raw || message;
  }
  return new ApiError(res.status, message, payload);
}

async function handle(res: Response): Promise<Response> {
  if (res.ok) return res;
  const err = await toError(res);
  // Udløbet eller ugyldig session → log brugeren ud i stedet for at vise fejl overalt.
  if (res.status === 401 && authToken) {
    authToken = null;
    onUnauthorized?.();
  }
  throw err;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: {
      ...authHeaders(),
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  return handle(res);
}

/** Hent en fil (PDF/CSV) med authorization og åbn den i en ny fane. */
export async function openAuthedFile(url: string, filename?: string) {
  const res = await fetch(`${API_BASE}${url}`, { headers: authHeaders() });
  if (!res.ok) throw await toError(res);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  // Uden en download-attribut får filen et tilfældigt UUID-navn i browseren.
  const navn = filename ?? headerFilename(res) ?? url.split("/").filter(Boolean).slice(-2).join("-");
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = navn;
  link.rel = "noopener";
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

function headerFilename(res: Response): string | null {
  const raw = res.headers.get("content-disposition");
  const match = raw?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  return match ? decodeURIComponent(match[1]) : null;
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

    await handle(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
