import { useCallback, useSyncExternalStore } from 'react';

// useSyncExternalStore reads matchMedia during the first render, so a phone never flashes the
// desktop sidebar before an effect corrects it.
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

export const DESKTOP_QUERY = '(min-width: 1024px)';
