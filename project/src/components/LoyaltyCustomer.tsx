// src/components/LoyaltyCustomer.tsx
import { useEffect, useState } from 'react';
import { Search, Trophy } from 'lucide-react';

interface CustomerData {
  email: string;
  name: string;
  whatsapp: string;
  address: string;
  transaction_count: number;
}

const itemsPerPage = 10;

function LoyaltyCustomer() {
  const [data, setData] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
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

  const filteredData = data.filter((cust) => {
    const term = searchTerm.toLowerCase();
    return (
      cust.name.toLowerCase().includes(term) ||
      cust.email.toLowerCase().includes(term) ||
      cust.whatsapp.includes(term)
    );
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
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
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Whatsapp</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alamat</th>
                  <th className="px-6 py-3 text-left text-xs text-center font-medium text-gray-500 uppercase tracking-wider">Jumlah Transaksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedData.map((cust, idx) => (
                  <tr key={cust.email} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(() => {
                        const rank = (currentPage - 1) * itemsPerPage + idx + 1;
                        if (rank === 1) return <Trophy className="text-yellow-500" size={18} />;
                        if (rank === 2) return <Trophy className="text-gray-400" size={18} />;
                        if (rank === 3) return <Trophy className="text-amber-700" size={18} />;
                        return rank;
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cust.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cust.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cust.whatsapp}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cust.address}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-black-600">{cust.transaction_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center mt-4">
            <p className="text-sm text-gray-600">
              Menampilkan {paginatedData.length} dari {filteredData.length} data
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
              >
                &laquo;
              </button>
              {[...Array(totalPages)].map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentPage(index + 1)}
                  className={`px-3 py-1 border rounded ${currentPage === index + 1 ? 'bg-orange-500 text-white' : 'hover:bg-gray-100'}`}
                >
                  {index + 1}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
              >
                &raquo;
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default LoyaltyCustomer;
