import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  BadgeDollarSign,
  Car,
  FileText,
  Home,
  IdCardLanyard,
  List,
  Settings,
  Stamp,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from './ui/dialog';

export type DashboardSection =
  | 'welcome'
  | 'customer'
  | 'database'
  | 'transaction'
  | 'employee'
  | 'car'
  | 'activitylog'
  | 'loyalty'
  | 'setting';

const ITEMS: { section: DashboardSection; label: string; icon: LucideIcon }[] = [
  { section: 'welcome', label: 'Welcome', icon: Home },
  { section: 'customer', label: 'Formulir Customer', icon: Users },
  { section: 'database', label: 'Database Customer', icon: FileText },
  { section: 'loyalty', label: 'Loyalty Customer', icon: Stamp },
  { section: 'transaction', label: 'Transaksi', icon: BadgeDollarSign },
  { section: 'employee', label: 'Karyawan', icon: IdCardLanyard },
  { section: 'car', label: 'Mobil', icon: Car },
  { section: 'activitylog', label: 'Aktifitas Log', icon: List },
  { section: 'setting', label: 'Pengaturan', icon: Settings },
];

interface SidebarNavProps {
  activeSection: DashboardSection;
  onNavigate: (section: DashboardSection) => void;
}

// Buttons, not <a href="#">: an item switches the section and must not jump the page to the top.
// The active item is orange-700 (5.2:1 on white) because orange-500 text sat at 2.8:1; the light
// background plus aria-current mark it without relying on colour alone.
export const SidebarNav: React.FC<SidebarNavProps> = ({ activeSection, onNavigate }) => (
  <nav aria-label="Menu utama" className="space-y-1">
    {ITEMS.map(({ section, label, icon: Icon }) => {
      const active = section === activeSection;
      return (
        <button
          key={section}
          type="button"
          onClick={() => onNavigate(section)}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'group flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700',
            active ? 'bg-orange-50 dark:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700',
          )}
        >
          <Icon
            size={20}
            aria-hidden="true"
            className={cn(
              'shrink-0 transition-colors',
              active
                ? 'stroke-orange-700 dark:stroke-orange-300'
                : 'stroke-gray-600 group-hover:stroke-orange-700 dark:stroke-white',
            )}
          />
          <span
            className={cn(
              'transition-colors',
              active
                ? 'text-orange-700 dark:text-orange-300'
                : 'text-gray-600 group-hover:text-orange-700 dark:text-white',
            )}
          >
            {label}
          </span>
        </button>
      );
    })}
  </nav>
);

interface MobileNavDrawerProps extends SidebarNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Radix supplies the focus trap, Escape, overlay click and body scroll lock. No slide animation,
// matching every other dialog in the app (MOTION 1).
export const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({ open, onOpenChange, activeSection, onNavigate }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogPortal>
      <DialogOverlay className="lg:hidden" />
      <DialogPrimitive.Content
        id="mobile-nav"
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const content = e.currentTarget as HTMLElement | null;
          content?.querySelector<HTMLElement>('[aria-current="page"]')?.focus();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          document.getElementById('nav-toggle')?.focus();
        }}
        className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-white text-gray-800 shadow-xl focus:outline-none dark:bg-gray-800 dark:text-gray-100 lg:hidden"
      >
        <div className="flex items-center justify-between px-4 pt-4">
          <DialogTitle className="text-xl font-semibold leading-normal tracking-normal text-gray-800 dark:text-gray-100">
            Menu
          </DialogTitle>
          <DialogPrimitive.Close
            aria-label="Tutup menu"
            className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-md text-gray-600 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 dark:text-gray-300"
          >
            <X size={24} aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <SidebarNav activeSection={activeSection} onNavigate={onNavigate} />
        </div>
      </DialogPrimitive.Content>
    </DialogPortal>
  </Dialog>
);
