import axios from 'axios';
import toast from 'react-hot-toast';

export const TOAST_DURATION = { success: 3000, error: 6000 } as const;

export const GUARD_TOAST_ID = { expired: 'session-expired', forbidden: 'forbidden' } as const;

// sessionGuard already shows a toast for these, so local handlers stay quiet.
export function isGuardedStatus(status: number | undefined): boolean {
  return status === 401 || status === 403;
}

function sentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

// 4xx messages from the backend name the cause ("Username sudah digunakan."); 5xx ones only repeat
// that something failed, so the action line plus a retry hint says more.
function errorText(action: string, status: number | undefined, serverMessage: unknown): string {
  if (status === undefined) return `${sentence(action)} Periksa koneksi lalu coba lagi.`;
  if (status < 500 && typeof serverMessage === 'string' && serverMessage.trim()) {
    return `${sentence(action)} ${sentence(serverMessage)}`;
  }
  return `${sentence(action)} Coba lagi.`;
}

export function notifySuccess(message: string): void {
  toast.success(sentence(message));
}

// `action` names what failed, e.g. "Mobil gagal dihapus". Accepts axios errors or anything thrown by fetch.
export function notifyError(err: unknown, action: string): void {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    if (isGuardedStatus(status)) return;
    toast.error(errorText(action, status, (err.response?.data as { message?: unknown } | undefined)?.message));
    return;
  }
  toast.error(errorText(action, undefined, undefined));
}

export async function notifyResponseError(res: Response, action: string): Promise<void> {
  if (isGuardedStatus(res.status)) return;
  let message: unknown;
  try {
    message = (await res.clone().json())?.message;
  } catch {
    // Non-JSON body (proxy error page, empty 502): the action line is all we have.
  }
  toast.error(errorText(action, res.status, message));
}
