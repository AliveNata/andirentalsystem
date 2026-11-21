import React from 'react';
import { cn } from '../../lib/utils';
import { getPageItems } from '../../lib/pagination';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  // Number of rows rendered on the current page.
  pageCount: number;
  startIndex: number;
  onPageChange: (page: number) => void;
  // Noun after the count, e.g. "data mobil" or "transaksi".
  itemLabel?: string;
}

const BUTTON =
  'inline-flex h-11 min-w-11 sm:h-10 sm:min-w-10 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white';

// orange-700 keeps white text at 5.18:1; orange-500 failed at 2.80:1 (audit 4.1).
const ACTIVE = 'border-orange-700 bg-orange-700 text-white hover:bg-orange-800';

const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  totalItems,
  pageCount,
  startIndex,
  onPageChange,
  itemLabel = 'data',
}) => {
  if (totalItems === 0) return null;
  const first = startIndex + 1;
  const last = startIndex + pageCount;

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-gray-600" aria-live="polite">
        Menampilkan {first === last ? first : `${first}-${last}`} dari {totalItems} {itemLabel}
      </p>
      {totalPages > 1 && (
        <nav aria-label="Halaman tabel" className="flex flex-wrap items-center gap-1">
          <button type="button" className={BUTTON} onClick={() => onPageChange(page - 1)} disabled={page === 1}>
            Sebelumnya
          </button>
          <span className="px-2 text-sm text-gray-700 sm:hidden">
            Hal {page} dari {totalPages}
          </span>
          {getPageItems(page, totalPages).map((item) =>
            typeof item === 'number' ? (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-label={`Halaman ${item}`}
                aria-current={item === page ? 'page' : undefined}
                className={cn(BUTTON, 'hidden sm:inline-flex', item === page && ACTIVE)}
              >
                {item}
              </button>
            ) : (
              <span key={item} className="hidden px-1 text-sm text-gray-600 sm:inline" aria-hidden="true">
                ...
              </span>
            ),
          )}
          <button
            type="button"
            className={BUTTON}
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
          >
            Berikutnya
          </button>
        </nav>
      )}
    </div>
  );
};

export default Pagination;
