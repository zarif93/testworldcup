import { trpc } from "@/lib/trpc";
import { UPLOAD_FILE_TOO_LARGE_MSG } from "@/lib/uploadUtils";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.pathname = "/login";
};

// Only redirect to login on 401 from *queries* (e.g. auth.me failed = session expired).
// Do NOT redirect on mutation 401: the form/page should handle it (e.g. show modal).
queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

// No redirect on mutation errors - let the calling page handle 401 (e.g. PredictionForm modal)
queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    console.error("[API Mutation Error]", event.mutation.state.error);
  }
});

// API base URL: use VITE_API_URL when set (e.g. production with separate API server), else same origin
function getTrpcUrl(): string {
  if (typeof window === "undefined") return "/api/trpc";
  const base = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? window.location.origin;
  return `${base}/api/trpc`;
}

const TRPC_RESPONSE_PREVIEW_LEN = 200;

async function trpcSafeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const res = await globalThis.fetch(input, {
    ...(init ?? {}),
    credentials: "include",
  });
  const text = await res.text();
  const preview = text.slice(0, TRPC_RESPONSE_PREVIEW_LEN);
  const contentType = res.headers.get("content-type") ?? "";
  const looksLikeJson =
    contentType.includes("application/json") ||
    (preview.trimStart().startsWith("{") || preview.trimStart().startsWith("["));

  if (import.meta.env.DEV) {
    console.info("[tRPC] Response", { requestUrl: url, status: res.status, statusText: res.statusText, responsePreview: preview });
  }

  if (!looksLikeJson || text.startsWith("<")) {
    console.error("[tRPC] Non-JSON response", {
      requestUrl: url,
      status: res.status,
      statusText: res.statusText,
      contentType,
      responsePreview: preview,
    });
    if (res.status === 413 || text.toLowerCase().includes("413") || text.toLowerCase().includes("entity too large")) {
      throw new Error(UPLOAD_FILE_TOO_LARGE_MSG);
    }
    if (text.startsWith("<")) {
      throw new Error(UPLOAD_FILE_TOO_LARGE_MSG);
    }
    throw new Error(
      `תגובה לא תקינה מהשרת (קוד ${res.status}). תחילת תגובה: ${preview.replace(/\s+/g, " ").slice(0, 80)}...`
    );
  }

  try {
    JSON.parse(text);
  } catch {
    console.error("[tRPC] Invalid JSON", { requestUrl: url, status: res.status, responsePreview: preview });
    if (res.status === 413) throw new Error(UPLOAD_FILE_TOO_LARGE_MSG);
    throw new Error(
      `השרת החזיר תגובה שלא ניתן לפרסר כ-JSON (קוד ${res.status}). תחילת תגובה: ${preview.replace(/\s+/g, " ").slice(0, 80)}...`
    );
  }

  if (res.status === 413) throw new Error(UPLOAD_FILE_TOO_LARGE_MSG);

  return new Response(text, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: getTrpcUrl(),
      transformer: superjson,
      fetch: trpcSafeFetch,
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
