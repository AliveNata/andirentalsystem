import { useEffect, useState } from 'react';

export interface CustomerMatch {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  identity_type: string;
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const DEBOUNCE_MS = 500;

// Same normalization as lib/customerLookup.js on the server: digits only, leading 0 becomes 62.
export function normalizeWhatsapp(value: string): string {
  return value.replace(/\D/g, '').replace(/^0/, '62');
}

// A half-typed value would match nothing or the wrong person, so only complete-looking input is sent.
function lookupParams(email: string, whatsapp: string): URLSearchParams | null {
  const params = new URLSearchParams();
  const cleanEmail = email.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) params.set('email', cleanEmail);
  // The phone field starts with the country code (62), so fewer than 9 digits is not a number yet.
  if (normalizeWhatsapp(whatsapp).length >= 9) params.set('whatsapp', whatsapp);
  return params.toString() ? params : null;
}

// Failures stay silent: the warning is a hint, and a lookup error must not interrupt data entry.
export function useCustomerLookup(email: string, whatsapp: string): CustomerMatch[] {
  const [matches, setMatches] = useState<CustomerMatch[]>([]);
  const query = lookupParams(email, whatsapp)?.toString() ?? '';

  useEffect(() => {
    if (!query) {
      setMatches([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/customer/lookup?${query}`, { signal: controller.signal });
        const data: { matches?: CustomerMatch[] } = res.ok ? await res.json() : {};
        setMatches(Array.isArray(data.matches) ? data.matches : []);
      } catch {
        // An abort means a newer query replaced this one; any other error just hides a stale warning.
        if (!controller.signal.aborted) setMatches([]);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return matches;
}
