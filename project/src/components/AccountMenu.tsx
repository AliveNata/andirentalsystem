import React, { useEffect, useId, useRef, useState } from 'react';
import { cn } from '../lib/utils';

interface AccountMenuProps {
  username: string;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onLogout: () => void;
}

// Opens on click, not hover: a touch screen has no hover, so the old menu left Logout out of reach on a phone.
// The panel only renders while open, so hidden controls can no longer be reached with Tab.
// Built as a disclosure (button + panel) rather than role="menu": the panel holds a switch and a button,
// and a menu role would promise arrow-key item navigation that this panel does not need.
const AccountMenu: React.FC<AccountMenuProps> = ({ username, darkMode, onToggleDarkMode, onLogout }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Menu akun ${username}`}
        className="flex h-11 items-center gap-2 rounded-md px-2 text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 dark:text-gray-200"
      >
        <span className="max-w-[8rem] truncate sm:max-w-none">{username}</span>
        <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5.5 7l4.5 4.5L14.5 7z" />
        </svg>
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute right-0 z-50 mt-2 w-56 space-y-2 rounded-md border bg-white p-3 shadow-md dark:border-gray-600 dark:bg-gray-700"
        >
          <button
            type="button"
            role="switch"
            aria-checked={darkMode}
            onClick={onToggleDarkMode}
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-1 text-sm text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 dark:text-gray-200"
          >
            <span>{darkMode ? 'Mode Gelap' : 'Mode Terang'}</span>
            <span
              aria-hidden="true"
              className={cn(
                'flex h-5 w-10 shrink-0 items-center rounded-full bg-gray-300 p-1 duration-300 ease-in-out',
                darkMode && 'bg-orange-500',
              )}
            >
              <span
                className={cn(
                  'h-4 w-4 transform rounded-full bg-white shadow-md duration-300 ease-in-out',
                  darkMode && 'translate-x-5',
                )}
              />
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="h-11 w-full rounded bg-red-600 px-3 text-sm text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default AccountMenu;
