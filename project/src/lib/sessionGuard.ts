import axios, { AxiosError } from 'axios';

export const SESSION_EXPIRED_EVENT = 'armj:session-expired';
export const FORBIDDEN_EVENT = 'armj:forbidden';

export interface ForbiddenDetail {
  message?: string;
}

// These routes answer 401 as part of the normal login flow, not as an expired session.
const AUTH_ROUTES = new Set(['/api/login', '/api/me', '/api/logout']);

let installed = false;
let expiredDispatched = false;

function apiPath(rawUrl: string): string | null {
  try {
    const { pathname } = new URL(rawUrl, window.location.href);
    const path = pathname.replace(/\/+$/, '').toLowerCase();
    return path.startsWith('/api/') ? path : null;
  } catch {
    return null;
  }
}

function handleStatus(rawUrl: string, status: number, readMessage: () => Promise<string | undefined>) {
  const path = apiPath(rawUrl);
  if (!path) return;

  if (path === '/api/login' && status >= 200 && status < 300) {
    expiredDispatched = false;
    return;
  }

  if (status === 401 && !AUTH_ROUTES.has(path)) {
    // Pages fire several requests at once; only the first 401 should end the session.
    if (expiredDispatched) return;
    expiredDispatched = true;
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    return;
  }

  if (status === 403) {
    readMessage()
      .catch(() => undefined)
      .then((message) => {
        window.dispatchEvent(new CustomEvent<ForbiddenDetail>(FORBIDDEN_EVENT, { detail: { message } }));
      });
  }
}

// The backend always answers errors as { message }, so forms can show it as is.
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { message?: unknown } | undefined)?.message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export async function responseMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.clone().json();
    if (typeof body?.message === 'string' && body.message.trim()) return body.message;
  } catch {
    // Non-JSON body (proxy error page, empty 502): the fallback is the best we have.
  }
  return fallback;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export function installSessionGuard() {
  if (installed) return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await originalFetch(input, init);
    handleStatus(requestUrl(input), res.status, async () => {
      const body = await res.clone().json();
      return typeof body?.message === 'string' ? body.message : undefined;
    });
    return res;
  };

  axios.interceptors.response.use(
    (response) => {
      handleStatus(axios.getUri(response.config), response.status, async () => undefined);
      return response;
    },
    (error: AxiosError<{ message?: unknown }>) => {
      if (error.response && error.config) {
        const message = error.response.data?.message;
        handleStatus(axios.getUri(error.config), error.response.status, async () =>
          typeof message === 'string' ? message : undefined,
        );
      }
      return Promise.reject(error);
    },
  );
}
