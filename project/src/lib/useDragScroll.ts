import { useCallback, useRef, useState } from 'react';

const INTERACTIVE = 'button, a, input, select, textarea, img, label, [role=button]';
// Below this distance a press is still a click, so cells with onClick keep working.
const DRAG_THRESHOLD_PX = 5;

interface Options {
  // Extra selector that must never start a drag, e.g. '.swiper' for an image carousel with its own swipe.
  ignore?: string;
}

interface DragScroll<T extends HTMLElement> {
  ref: (node: T | null) => void;
  canScrollX: boolean;
  canScrollY: boolean;
}

// Mouse-only drag to scroll. Touch keeps native scrolling, so nothing here listens to touch events.
// A callback ref (not useRef + useEffect) attaches listeners whenever the container mounts, including
// tables that only render after loading finishes.
export function useDragScroll<T extends HTMLElement>({ ignore }: Options = {}): DragScroll<T> {
  const [canScrollX, setCanScrollX] = useState(false);
  const [canScrollY, setCanScrollY] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const ignoreSelector = ignore ? `${INTERACTIVE}, ${ignore}` : INTERACTIVE;

  const ref = useCallback((node: T | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (!node) return;

    const measure = () => {
      setCanScrollX(node.scrollWidth > node.clientWidth + 1);
      setCanScrollY(node.scrollHeight > node.clientHeight + 1);
    };
    // The table resizes when rows or column widths change, the container when the window does.
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    Array.from(node.children).forEach((child) => observer.observe(child));
    measure();

    let start: { x: number; y: number; left: number; top: number } | null = null;
    let dragging = false;

    const onMouseMove = (e: MouseEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
        dragging = true;
        node.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        window.getSelection()?.removeAllRanges();
      }
      e.preventDefault();
      node.scrollLeft = start.left - dx;
      node.scrollTop = start.top - dy;
    };

    const swallowClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (dragging) {
        // The click that follows mouseup belongs to the drag, not to the cell under the pointer.
        window.addEventListener('click', swallowClick, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', swallowClick, { capture: true }), 0);
        node.style.cursor = '';
        document.body.style.userSelect = '';
      }
      start = null;
      dragging = false;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as Element | null;
      if (!target || target.closest(ignoreSelector)) return;
      // A press on the container's own scrollbar is native scrolling, not a drag.
      if (target === node && (e.offsetX >= node.clientWidth || e.offsetY >= node.clientHeight)) return;
      if (node.scrollWidth <= node.clientWidth && node.scrollHeight <= node.clientHeight) return;

      start = { x: e.clientX, y: e.clientY, left: node.scrollLeft, top: node.scrollTop };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    node.addEventListener('mousedown', onMouseDown);
    cleanupRef.current = () => {
      observer.disconnect();
      node.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (dragging) document.body.style.userSelect = '';
    };
  }, [ignoreSelector]);

  return { ref, canScrollX, canScrollY };
}
