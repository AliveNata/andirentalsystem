import { useEffect, useState } from 'react';
import { clampPage, getTotalPages } from './pagination';

interface PaginationState<T> {
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  pageItems: T[];
  // Zero-based index of the first row on this page, so the # column keeps counting across pages.
  startIndex: number;
}

// resetKey: pass the search term (and filters) so a new search starts again from page 1.
export function usePagination<T>(items: T[], pageSize: number, resetKey: string): PaginationState<T> {
  const [requestedPage, setRequestedPage] = useState(1);
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  const totalPages = getTotalPages(items.length, pageSize);

  // Reset during render instead of in an effect, so the old page never flashes with the new results.
  if (lastResetKey !== resetKey) {
    setLastResetKey(resetKey);
    setRequestedPage(1);
  }

  // When rows disappear (delete, refetch) the stored page can point past the end; render the last page
  // right away and store it, so the next "Berikutnya" click does not start from a page that no longer exists.
  const page = clampPage(requestedPage, totalPages);
  useEffect(() => {
    if (page !== requestedPage) setRequestedPage(page);
  }, [page, requestedPage]);

  const startIndex = (page - 1) * pageSize;
  return {
    page,
    setPage: (next: number) => setRequestedPage(clampPage(next, totalPages)),
    totalPages,
    pageItems: items.slice(startIndex, startIndex + pageSize),
    startIndex,
  };
}
