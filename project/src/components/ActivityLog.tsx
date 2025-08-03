import React, { useEffect, useState } from 'react';
import { Search, FileDown } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import * as XLSX from 'xlsx';

interface LogItem {
  id: string;
  log_id: string;
  entity: string;
  action: string;
  changes: any;
  user_id: string;
  username?: string;
  page: string;
  created_at: string;
}


const renderKeyValueIndented = (obj: Record<string, any>) => {
  return Object.entries(obj).map(([key, value]) => (
    <div key={key} className="ml-4">
      <span className="font-mono">{key}</span>: {String(value)}
    </div>
  ));
};

const ActivityLog: React.FC = () => {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  useEffect(() => {
    fetch('http://localhost:5000/history-logs') // sesuaikan jika URL beda
      .then((res) => res.json())
      .then((data) => setLogs(data))
      .catch((err) => console.error('Error fetching logs:', err));
  }, []);

  const filteredLogs = logs.filter((log) => {
  const term = searchTerm.toLowerCase();
  const matchSearch =
    log.entity.toLowerCase().includes(term) ||
    log.action.toLowerCase().includes(term) ||
    log.page.toLowerCase().includes(term) ||
    log.user_id.toLowerCase().includes(term) ||
    (log.username?.toLowerCase().includes(term) ?? false);

  const createdAt = new Date(log.created_at);
  const matchDate =
    (!startDate || createdAt >= startDate) &&
    (!endDate || createdAt <= endDate);

  return matchSearch && matchDate;
});

const handleExport = () => {
  const exportData = filteredLogs.map((log) => ({
    Tanggal: new Date(log.created_at).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).replace(' at', ',').replace('am', 'AM').replace('pm', 'PM'),
    Entitas: log.entity,
    Aksi: log.action,
    Halaman: log.page,
    Username: log.username,
    Perubahan: JSON.stringify(log.changes)
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Logs');

  const filename = `${searchTerm || 'logs'}_${startDate ? startDate.toISOString().split('T')[0] : 'all'}_${endDate ? endDate.toISOString().split('T')[0] : 'all'}.xlsx`;
  XLSX.writeFile(workbook, filename);
};

  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-semibold">Aktifitas Log</h2>
        <div className="flex flex-wrap items-center gap-2">
            <DatePicker
            selected={startDate}
            onChange={(date) => {
                setStartDate(date);
                setCurrentPage(1);
            }}
            selectsStart
            startDate={startDate}
            endDate={endDate}
            placeholderText="Dari tanggal"
            className="px-3 py-2 border rounded-md text-sm"
            />
            <DatePicker
            selected={endDate}
            onChange={(date) => {
                setEndDate(date);
                setCurrentPage(1);
            }}
            selectsEnd
            startDate={startDate}
            endDate={endDate}
            placeholderText="Sampai tanggal"
            className="px-3 py-2 border rounded-md text-sm"
            />
            <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
                type="text"
                placeholder="Cari entity, action, page, user_id..."
                value={searchTerm}
                onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
                }}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
            />
            </div>
            <button
            onClick={handleExport}
            className="flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:from-orange-600 hover:to-yellow-600"
            >
            <FileDown size={20} /> 
            <span>Download ke Excel</span>
            </button>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full text-sm text-gray-700">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="px-6 py-3">Tanggal</th>
              <th className="px-6 py-3">Entitas</th>
              <th className="px-6 py-3">Aksi</th>
              <th className="px-6 py-3">Halaman</th>
              <th className="px-6 py-3">Perubahan</th>
              <th className="px-6 py-3">Username</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedLogs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                    }).replace(' at', ',').replace('am', 'AM').replace('pm', 'PM')}
                    
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{log.entity}</td>
                <td className="px-6 py-4 whitespace-nowrap">{log.action}</td>
                <td className="px-6 py-4 whitespace-nowrap">{log.page}</td>
                <td className="px-6 py-4 whitespace-pre-wrap break-words max-w-xs text-xs text-gray-600">
                {log.changes.before && (
                <div>
                    <div className="font-semibold">Sebelumnya:</div>
                    <div className="text-sm">{renderKeyValueIndented(log.changes.before)}</div>
                </div>
                )}
                {log.changes.after && (
                <div className="mt-2">
                    <div className="font-semibold">Setelahnya:</div>
                    <div className="text-sm">{renderKeyValueIndented(log.changes.after)}</div>
                </div>
                )}
                {!log.changes?.before && !log.changes?.after && log.changes?.reason && (
                <div className="text-sm">
                    <strong>Alasan:</strong> {log.changes.reason}
                </div>
                )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap"><strong>{log.username}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4">
  <p className="text-sm text-gray-600">
    Menampilkan {paginatedLogs.length} dari {filteredLogs.length} data
  </p>
  <div className="flex space-x-1 flex-wrap">
    {/* Tombol Previous */}
    <button
      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
      disabled={currentPage === 1}
      className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
    >
      &laquo;
    </button>

    {/* Logic Page Numbers */}
    {(() => {
      const pages = [];

      const showLeftEllipsis = currentPage > 6;
      const showRightEllipsis = currentPage < totalPages - 5;

      const startPage = showLeftEllipsis ? Math.max(currentPage - 4, 2) : 2;
      const endPage = showRightEllipsis
        ? Math.min(currentPage + 4, totalPages - 1)
        : totalPages - 1;

      // Always show page 1
      pages.push(
        <button
          key={1}
          onClick={() => setCurrentPage(1)}
          className={`px-3 py-1 border rounded ${currentPage === 1 ? 'bg-orange-500 text-white' : 'hover:bg-gray-100'}`}
        >
          1
        </button>
      );

      // Left ellipsis
      if (showLeftEllipsis) {
        pages.push(<span key="left-ellipsis" className="px-2">...</span>);
      }

      // Middle pages
      for (let i = startPage; i <= endPage; i++) {
        pages.push(
          <button
            key={i}
            onClick={() => setCurrentPage(i)}
            className={`px-3 py-1 border rounded ${currentPage === i ? 'bg-orange-500 text-white' : 'hover:bg-gray-100'}`}
          >
            {i}
          </button>
        );
      }

      // Right ellipsis
      if (showRightEllipsis) {
        pages.push(<span key="right-ellipsis" className="px-2">...</span>);
      }

      // Always show last page if more than 1
      if (totalPages > 1) {
        pages.push(
          <button
            key={totalPages}
            onClick={() => setCurrentPage(totalPages)}
            className={`px-3 py-1 border rounded ${currentPage === totalPages ? 'bg-orange-500 text-white' : 'hover:bg-gray-100'}`}
          >
            {totalPages}
          </button>
        );
      }

      return pages;
    })()}

    {/* Tombol Next */}
    <button
      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
      disabled={currentPage === totalPages}
      className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
    >
      &raquo;
    </button>
  </div>
</div>

    </div>
  );
};

export default ActivityLog;
