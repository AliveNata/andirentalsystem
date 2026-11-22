import React, { useEffect, useState } from 'react';
import { Search, FileDown } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
// Export only. xlsx 0.18.5 has unfixed parse-side advisories (GHSA-4r6h-8v6p-xvw6 prototype
// pollution, GHSA-5pgg-2g8v-p4x9 ReDoS): never call XLSX.read or sheet_to_* on a user-supplied file.
import * as XLSX from 'xlsx';
import Pagination from './ui/Pagination';
import { ScrollableTable, TABLE_HEAD_CLASS, TableMessageRow, Th } from './ui/DataTable';
import { usePagination } from '../lib/usePagination';

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


const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

const renderKeyValueIndented =(obj: Record<string, any>) => {
  return Object.entries(obj).map(([key, value]) => (
    <div key={key} className="ml-4">
      <span className="font-mono">{key}</span>: {String(value)}
    </div>
  ));
};

// Same format in the table and the Excel export.
const formatLogDate = (value: string) =>
  new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).replace(' at', ',').replace('am', 'AM').replace('pm', 'PM');

const itemsPerPage = 10;

const ActivityLog: React.FC = () => {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [searchTerm, setSearchTerm] = useState('');

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/history-logs`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setLogs(data);
        setStatus('ready');
      })
      .catch((err) => {
        console.error('Error fetching logs:', err);
        setStatus('error');
      });
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
    Tanggal: formatLogDate(log.created_at),
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


  const { page, setPage, totalPages, pageItems: paginatedLogs, startIndex } = usePagination(
    filteredLogs,
    itemsPerPage,
    `${searchTerm}|${startDate?.getTime() ?? ''}|${endDate?.getTime() ?? ''}`,
  );

  return (
    <div className="sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h2 className="text-xl sm:text-2xl font-semibold">Aktifitas Log</h2>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
            <DatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date)}
              selectsStart
              startDate={startDate}
              endDate={endDate}
              placeholderText="Dari tanggal"
              wrapperClassName="w-full sm:w-auto"
              className="h-11 w-full text-base sm:h-10 sm:w-40 sm:text-sm px-3 border rounded-md"
            />
            <DatePicker
              selected={endDate}
              onChange={(date) => setEndDate(date)}
              selectsEnd
              startDate={startDate}
              endDate={endDate}
              placeholderText="Sampai tanggal"
              wrapperClassName="w-full sm:w-auto"
              className="h-11 w-full text-base sm:h-10 sm:w-40 sm:text-sm px-3 border rounded-md"
            />
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} aria-hidden="true" />
            <input
              type="search"
              aria-label="Cari entity, action, page, user_id..."
              placeholder="Cari entity, action, page, user_id..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 w-full text-base sm:h-10 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
            />
          </div>
          <button
            onClick={handleExport}
            className="inline-flex h-11 w-full items-center justify-center gap-2 sm:h-10 sm:w-auto bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:from-orange-600 hover:to-yellow-600"
          >
            <FileDown size={20} />
            <span>Download ke Excel</span>
          </button>
        </div>
      </div>

      <ScrollableTable label="Tabel aktifitas log">
        <table className="min-w-full bg-white text-sm text-gray-700">
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <Th>Tanggal</Th>
              <Th>Entitas</Th>
              <Th>Aksi</Th>
              <Th>Halaman</Th>
              <Th>Perubahan</Th>
              <Th>Username</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {status === 'loading' ? (
              <TableMessageRow colSpan={6}>Memuat aktifitas log...</TableMessageRow>
            ) : status === 'error' ? (
              <TableMessageRow colSpan={6}>
                Aktifitas log gagal dimuat. Muat ulang halaman untuk mencoba lagi.
              </TableMessageRow>
            ) : paginatedLogs.length === 0 ? (
              <TableMessageRow colSpan={6}>
                {searchTerm.trim() || startDate || endDate
                  ? 'Tidak ada log yang cocok dengan pencarian atau rentang tanggal ini.'
                  : 'Belum ada aktifitas yang tercatat.'}
              </TableMessageRow>
            ) : (
              paginatedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">{formatLogDate(log.created_at)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{log.entity}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{log.action}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{log.page}</td>
                  <td className="px-6 py-4 whitespace-pre-wrap break-words max-w-xs text-xs text-gray-600">
                    {log.changes?.before && (
                      <div>
                        <div className="font-semibold">Sebelumnya:</div>
                        <div className="text-sm">{renderKeyValueIndented(log.changes.before)}</div>
                      </div>
                    )}
                    {log.changes?.after && (
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
              ))
            )}
          </tbody>
        </table>
      </ScrollableTable>

      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={filteredLogs.length}
        pageCount={paginatedLogs.length}
        startIndex={startIndex}
        onPageChange={setPage}
        itemLabel="log"
      />
    </div>
  );
};

export default ActivityLog;
