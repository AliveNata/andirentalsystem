// src/components/LoyaltyCustomer.tsx
import { useEffect, useMemo, useState } from 'react';
import { Search, Trophy } from 'lucide-react';
import Pagination from './ui/Pagination';
import { ScrollableTable, TABLE_HEAD_CLASS, TableMessageRow, Th } from './ui/DataTable';
import { usePagination } from '../lib/usePagination';

interface CustomerData {
  // Unique per row (see lib/loyalty.js); customer_id can repeat across rows.
  group_key: string;
  // null for customers whose transactions all predate customer_id (DB/13).
  customer_id: string | null;
  email: string;
  name: string;
  whatsapp: string;
  address: string;
  transaction_count: number;
}

const itemsPerPage = 10;

const TROPHY_COLOR = ['text-yellow-500', 'text-gray-500', 'text-amber-700'];

function LoyaltyCustomer() {
  const [data, setData] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    fetch(`${API_BASE_URL.replace(/\/$/, '')}/loyalty-customers`)
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Gagal fetch loyalty customer:', err);
        setLoading(false);
      });
  }, []);

  // The server sends customers ordered by transaction count, so the trophy follows the overall rank,
  // not the row number, and stays with the same customer while a search is active.
  // The server sends one row per customer (grouped by email), so the row object is a safe key.
  const rankByRow = useMemo(() => new Map(data.map((cust, i) => [cust, i + 1])), [data]);

  const filteredData = data.filter((cust) => {
    const term = searchTerm.toLowerCase();
    return (
      (cust.name ?? '').toLowerCase().includes(term) ||
      (cust.email ?? '').toLowerCase().includes(term) ||
      (cust.whatsapp ?? '').includes(term)
    );
  });

  const { page, setPage, totalPages, pageItems: paginatedData, startIndex } = usePagination(
    filteredData,
    itemsPerPage,
    searchTerm,
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Loyalty Customer</h2>
        <div className="relative">
          <input
            type="text"
            placeholder="Cari berdasarkan nama, email, atau whatsapp..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-96 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
          />
          <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      ) : (
        <>
          <ScrollableTable label="Tabel loyalty customer">
            <table className="min-w-full bg-white">
              <thead className={TABLE_HEAD_CLASS}>
                <tr>
                  <Th>#</Th>
                  <Th>Email</Th>
                  <Th>Nama</Th>
                  <Th>Whatsapp</Th>
                  <Th>Alamat</Th>
                  <Th align="right">Jumlah Transaksi</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedData.length === 0 ? (
                  <TableMessageRow colSpan={6}>
                    {searchTerm.trim()
                      ? `Tidak ada customer yang cocok dengan "${searchTerm.trim()}".`
                      : 'Belum ada customer dengan transaksi.'}
                  </TableMessageRow>
                ) : (
                  paginatedData.map((cust, idx) => {
                    const rank = rankByRow.get(cust) ?? 0;
                    return (
                      <tr key={cust.group_key} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 tabular-nums">
                          <span className="inline-flex items-center gap-2">
                            {startIndex + idx + 1}
                            {rank >= 1 && rank <= 3 && (
                              <Trophy
                                className={TROPHY_COLOR[rank - 1]}
                                size={18}
                                role="img"
                                aria-label={`Peringkat ${rank}`}
                              />
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cust.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cust.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cust.whatsapp}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cust.address}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold tabular-nums">{cust.transaction_count}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </ScrollableTable>

          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={filteredData.length}
            pageCount={paginatedData.length}
            startIndex={startIndex}
            onPageChange={setPage}
            itemLabel="customer"
          />
        </>
      )}
    </div>
  );
}

export default LoyaltyCustomer;
