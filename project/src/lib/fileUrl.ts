const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

// Uploads are served only through the authenticated /api/files route, so the
// session cookie rides along on <img> and <a> requests via the same-origin proxy.
export function fileUrl(filename?: string | null): string | undefined {
  if (!filename) return undefined;
  return `${API_BASE_URL}/files/${encodeURIComponent(filename)}`;
}
