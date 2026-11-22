import React, { useEffect, useState } from 'react';

interface Summary {
  active_rentals: number;
  bookings_today: number;
  car_models: number;
}

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: Summary };

const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

const CARDS: { title: string; key: keyof Summary; unit: string }[] = [
  { title: 'Rental Aktif', key: 'active_rentals', unit: 'transaksi sedang berjalan hari ini' },
  // dim_car holds models, not units, so this counts catalogue entries rather than cars free to rent.
  { title: 'Katalog Mobil', key: 'car_models', unit: 'jenis mobil di katalog' },
  { title: 'Pemesanan Hari Ini', key: 'bookings_today', unit: 'pemesanan baru' },
];

// Counts come from GET /api/dashboard/summary ("today" is the Jakarta date, worked out on the server).
const WelcomeSummary: React.FC = () => {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/dashboard/summary`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<Summary>;
      })
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch((err) => {
        console.error('Error fetching dashboard summary:', err);
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4" aria-busy={state.status === 'loading'}>
        {CARDS.map(({ title, key, unit }) => (
          <div key={key} className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <h3 className="text-white font-semibold mb-1">{title}</h3>
            <p className="text-orange-50">
              {state.status === 'loading'
                ? 'Memuat...'
                : state.status === 'error'
                  ? '-'
                  : `${state.data[key].toLocaleString('id-ID')} ${unit}`}
            </p>
          </div>
        ))}
      </div>
      {state.status === 'error' && (
        <p className="mt-4 text-sm text-orange-50">Ringkasan belum bisa dimuat. Muat ulang halaman untuk mencoba lagi.</p>
      )}
    </>
  );
};

export default WelcomeSummary;
