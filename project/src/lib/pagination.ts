export type PageItem = number | 'ellipsis-left' | 'ellipsis-right';

export function getTotalPages(totalItems: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function clampPage(page: number, totalPages: number): number {
  return Math.min(Math.max(1, page), Math.max(1, totalPages));
}

// First and last page are always shown; an ellipsis replaces a gap only when it hides two or more pages,
// otherwise the hidden page itself is shown (an ellipsis standing for one page wastes the same slot).
export function getPageItems(current: number, totalPages: number, siblings = 2): PageItem[] {
  if (totalPages <= 1) return [1];
  const page = clampPage(current, totalPages);
  let start = Math.max(2, page - siblings);
  let end = Math.min(totalPages - 1, page + siblings);
  if (start === 3) start = 2;
  if (end === totalPages - 2) end = totalPages - 1;

  const items: PageItem[] = [1];
  if (start > 2) items.push('ellipsis-left');
  for (let i = start; i <= end; i++) items.push(i);
  if (end < totalPages - 1) items.push('ellipsis-right');
  items.push(totalPages);
  return items;
}
