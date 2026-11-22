// Mirrors lib/webConfig.js on the backend. Keys are fixed; null means "use the default".
export interface WebConfig {
  logo: string | null;
  favicon: string | null;
  signature: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
}

export type WebConfigKey = keyof WebConfig;

export interface PublicWebConfig {
  logo: string | null;
  favicon: string | null;
}

export const EMPTY_WEB_CONFIG: WebConfig = {
  logo: null,
  favicon: null,
  signature: null,
  signatoryName: null,
  signatoryTitle: null,
};

export const SIGNATORY_TEXT_MAX = 100;

// Bundled files from project/public, used whenever the setting is empty or fails to load.
export const DEFAULT_LOGO = `${import.meta.env.BASE_URL}logo/armjlogo-trim.png`;
export const DEFAULT_FAVICON = `${import.meta.env.BASE_URL}favicon-32.png`;

const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

// Same rule as the backend: email templates drop non-https images, so http is refused at entry.
export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function fetchPublicWebConfig(): Promise<PublicWebConfig> {
  const res = await fetch(`${API_BASE_URL}/web-config/public`);
  if (!res.ok) throw new Error(`web-config/public ${res.status}`);
  const data: unknown = await res.json();
  const record = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  return { logo: stringOrNull(record.logo), favicon: stringOrNull(record.favicon) };
}

// index.html ships the static icons; remember them so clearing the setting can put them back.
let staticIcons: Array<{ link: HTMLLinkElement; href: string; type: string | null }> | null = null;

function iconLinks() {
  if (!staticIcons) {
    staticIcons = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')).map((link) => ({
      link,
      href: link.getAttribute('href') ?? '',
      type: link.getAttribute('type'),
    }));
  }
  return staticIcons;
}

function restoreStaticIcons() {
  for (const { link, href, type } of iconLinks()) {
    link.setAttribute('href', href);
    if (type) link.setAttribute('type', type);
  }
}

// The image is loaded first so a broken URL never replaces a working tab icon.
export function applyFavicon(url: string | null): Promise<void> {
  if (!url) {
    restoreStaticIcons();
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const probe = new Image();
    probe.onload = () => {
      for (const { link } of iconLinks()) {
        link.setAttribute('href', url);
        // The custom file may be .ico or .svg, so the static image/png type would be wrong.
        link.removeAttribute('type');
      }
      resolve();
    };
    probe.onerror = () => {
      restoreStaticIcons();
      resolve();
    };
    probe.src = url;
  });
}

export async function loadDynamicFavicon(): Promise<void> {
  try {
    const { favicon } = await fetchPublicWebConfig();
    await applyFavicon(favicon);
  } catch {
    // Backend down or no row: the static icons from index.html stay.
  }
}
