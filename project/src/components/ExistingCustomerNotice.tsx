import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { CustomerMatch, normalizeWhatsapp } from '../lib/useCustomerLookup';

const IDENTITY_LABEL: Record<string, string> = {
  married: 'Menikah',
  single: 'Single',
  corporate: 'Perusahaan',
  foreigner: 'WNA',
};

interface ExistingCustomerNoticeProps {
  matches: CustomerMatch[];
  email: string;
  whatsapp: string;
  onOpenReorder: (customerId: string) => void;
  onContinue: () => void;
}

const ExistingCustomerNotice: React.FC<ExistingCustomerNoticeProps> = ({
  matches,
  email,
  whatsapp,
  onOpenReorder,
  onContinue,
}) => {
  const typedEmail = email.trim().toLowerCase();
  const typedWa = normalizeWhatsapp(whatsapp);

  return (
    <div role="status" aria-live="polite" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="flex items-start gap-2">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {matches.length === 1 ? 'Customer ini sudah terdaftar' : `Ada ${matches.length} customer terdaftar dengan data yang sama`}
          </p>
          <p className="mt-1">
            Kalau orangnya sama, buat booking lewat Reorder supaya data dan dokumennya tidak tersimpan dua kali.
          </p>
          <ul className="mt-3 space-y-2">
            {matches.map((m) => {
              const same: string[] = [];
              if (typedEmail && m.email?.trim().toLowerCase() === typedEmail) same.push(`email ${m.email}`);
              if (typedWa && normalizeWhatsapp(m.whatsapp ?? '') === typedWa) same.push(`WhatsApp ${m.whatsapp}`);
              return (
                <li key={m.id} className="flex flex-col gap-2 rounded-md bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 [overflow-wrap:anywhere]">
                    <p className="font-medium text-gray-900">
                      {m.name}
                      {IDENTITY_LABEL[m.identity_type] && (
                        <span className="font-normal text-gray-700"> ({IDENTITY_LABEL[m.identity_type]})</span>
                      )}
                    </p>
                    {same.length > 0 && <p className="text-gray-700">Sama di {same.join(' dan ')}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenReorder(m.id)}
                    aria-label={`Buka Reorder untuk ${m.name}`}
                    className="inline-flex h-11 shrink-0 items-center justify-center rounded-md bg-orange-700 px-4 font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 sm:h-10"
                  >
                    Buka Reorder
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={onContinue}
            className="mt-3 inline-flex h-11 items-center rounded-md border border-amber-400 bg-white px-4 font-medium text-amber-900 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 sm:h-10"
          >
            Tetap buat customer baru
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExistingCustomerNotice;
