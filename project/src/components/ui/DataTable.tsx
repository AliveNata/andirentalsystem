import React from 'react';
import { cn } from '../../lib/utils';
import { useDragScroll } from '../../lib/useDragScroll';

export const TABLE_HEAD_CLASS = 'sticky top-0 z-10 bg-gray-50';

type Align = 'left' | 'right' | 'center';

const ALIGN: Record<Align, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

interface ThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: Align;
}

// gray-600 on gray-50 is 7.2:1; gray-500 sat at 4.62:1, too close to the AA line (audit 4.1).
// Money and count columns pass align="right" so the header lines up with the figures below it.
export const Th: React.FC<ThProps> = ({ align = 'left', className, children, ...props }) => (
  <th
    scope="col"
    className={cn(
      'whitespace-nowrap border-b border-gray-200 bg-gray-50 px-6 py-3 text-xs font-medium uppercase tracking-wider text-gray-600',
      ALIGN[align],
      className,
    )}
    {...props}
  >
    {children}
  </th>
);

interface ScrollableTableProps {
  label: string;
  children: React.ReactNode;
  // Extra selector that must not start a drag, e.g. an image carousel.
  dragIgnore?: string;
}

export const ScrollableTable: React.FC<ScrollableTableProps> = ({ label, children, dragIgnore }) => {
  const { ref, canScrollX, canScrollY } = useDragScroll<HTMLDivElement>({ ignore: dragIgnore });
  const scrollable = canScrollX || canScrollY;

  return (
    <>
      {canScrollX && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm text-blue-700">
            💡 <strong>Tips:</strong> Klik dan seret area kosong tabel (seperti header atau cell kosong) untuk menggulir horizontal/vertikal. Hindari menyeret pada tombol, gambar, atau elemen interaktif.
          </p>
        </div>
      )}
      <div
        ref={ref}
        role="region"
        aria-label={label}
        // Focusable only when there is something to scroll, so arrow keys can move a wide table.
        tabIndex={scrollable ? 0 : undefined}
        className={cn(
          'max-h-[70vh] overflow-auto rounded-lg border border-gray-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2',
          scrollable && 'cursor-grab',
        )}
      >
        {children}
      </div>
    </>
  );
};

interface TableMessageRowProps {
  colSpan: number;
  children: React.ReactNode;
}

export const TableMessageRow: React.FC<TableMessageRowProps> = ({ colSpan, children }) => (
  <tr>
    <td colSpan={colSpan} className="px-6 py-8 text-center text-sm text-gray-600">
      {children}
    </td>
  </tr>
);
