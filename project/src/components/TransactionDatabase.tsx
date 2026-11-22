import React, { useEffect, useState } from 'react';
import { Search, Eye, FileDown, Clock, Edit2, Trash2, Send, Loader, Receipt, FileText } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import toast from 'react-hot-toast';
// Export only. xlsx 0.18.5 has unfixed parse-side advisories (GHSA-4r6h-8v6p-xvw6 prototype
// pollution, GHSA-5pgg-2g8v-p4x9 ReDoS): never call XLSX.read or sheet_to_* on a user-supplied file.
import * as XLSX from 'xlsx';
import { fileUrl } from '../lib/fileUrl';
import { responseMessage } from '../lib/sessionGuard';
import { isGuardedStatus, notifyError, notifyResponseError, notifySuccess } from '../lib/notify';
import { isPdfFile } from '../types';
import { ConfirmDialog, ImageDialog, Modal, ModalButton } from './ui/Modal';
import Pagination from './ui/Pagination';
import { ScrollableTable, TABLE_HEAD_CLASS, TableMessageRow, Th } from './ui/DataTable';
import { usePagination } from '../lib/usePagination';

const PAYMENT_PROOFS = [
  { key: 'deposit_payment_url', label: 'Deposit' },
  { key: 'down_payment_url', label: 'Down Payment' },
  { key: 'full_payment_url', label: 'Full Payment' },
] as const;

// Browsers cannot render a PDF inside <img>, so PDF proofs open in a new tab instead of a thumbnail.
const PaymentProof: React.FC<{ filename: string; label: string }> = ({ filename, label }) =>
  isPdfFile(filename) ? (
    <a
      href={fileUrl(filename)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Buka PDF bukti ${label} di tab baru`}
      className="w-full h-32 flex flex-col items-center justify-center gap-1 rounded border border-gray-300 bg-gray-50 text-orange-700 hover:bg-orange-50 hover:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
    >
      <FileText size={28} aria-hidden="true" />
      <span className="text-sm font-semibold underline">Buka PDF</span>
    </a>
  ) : (
    <img src={fileUrl(filename)} alt={label} className="w-full h-32 object-cover rounded shadow" />
  );

type EmailKind = 'invoice' | 'receipt';

const EMAIL_COPY: Record<EmailKind, {
  endpoint: string;
  sent: string;
  throttled: string;
  notPaid: string | null;
  failed: string;
}> = {
  invoice: {
    endpoint: 'send-confirmation-email',
    sent: 'Invoice terkirim ke email customer.',
    throttled: 'Invoice untuk transaksi ini baru saja dikirim. Coba lagi setelah 10 menit.',
    notPaid: null,
    failed: 'Invoice gagal dikirim. Coba lagi beberapa saat lagi.',
  },
  receipt: {
    endpoint: 'send-receipt-email',
    sent: 'Bukti pembayaran terkirim ke email customer.',
    throttled: 'Bukti pembayaran untuk transaksi ini baru saja dikirim. Coba lagi setelah 10 menit.',
    notPaid: 'Transaksi ini belum lunas. Bukti pembayaran baru bisa dikirim setelah pelunasan dicatat.',
    failed: 'Bukti pembayaran gagal dikirim. Coba lagi beberapa saat lagi.',
  },
};

const EMAIL_NOT_FOUND = 'Transaksi tidak ditemukan atau sudah dihapus.';
const DRY_RUN_NOTE = 'Mode uji aktif: email disimpan sebagai file, tidak dikirim.';

interface Transaction {
  id: string;
  booking_code: string;
  name: string;
  rental_duration: string;
  range_rent?: number; 
  car_type: string;
  start_date: string;
  start_time: string;
  end_date: string;
  deposit: number;
  discount: number;
  driver_fee: number;
  delivery_fee: number;
  pickup_fee: number;
  trip_fee?: number;
  grand_total?: number;
  needs_trip?: boolean;
  needs_driver?: boolean; 
  needs_delivery?: boolean; 
  needs_pickup?: boolean; 
  purpose: string;
  identity_type?: string; 
  created_at: string;
  address?: string;
  company_address?: string;
  email?: string;
  whatsapp?: string;
  created_by?: string;
  updated_by?: string;
  deposit_payment_url?: string;
  down_payment_url?: string;
  full_payment_url?: string;
  lunas?: boolean;
  invoice_logs?: string[];
}

interface HistoryLog {
  id: string;
  action: string;
  changes: {
    before: any;
    after: any;
    reason?: string;
  };
  created_at: string;
}

const TransactionDatabase: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [depositFile, setDepositFile] = useState<File | null>(null);
  const [downPaymentFile, setDownPaymentFile] = useState<File | null>(null);
  const [fullPaymentFile, setFullPaymentFile] = useState<File | null>(null);
  const [Lunas, setLunas] = useState(false);
  const [fileErrors, setFileErrors] = useState({ deposit: '', dp: '', full: '' });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);
  const logsPerPage = 5;
  const itemsPerPage = 10;


  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'border-blue-500';
      case 'UPDATE':
        return 'border-orange-500';
      case 'DELETE':
        return 'border-red-500';
      default:
        return 'border-gray-500';
    }
  };

  const getActionText = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'Data dibuat';
      case 'UPDATE':
        return 'Data diperbarui';
      case 'DELETE':
        return 'Data dihapus';
      default:
        return action;
    }
  };


  const [existingFiles, setExistingFiles] = useState<{
    deposit?: string;
    dp?: string;
    full?: string;
  }>({});


  const hasAnyFile =
  !!depositFile || !!downPaymentFile || !!fullPaymentFile ||
  !!existingFiles.deposit || !!existingFiles.dp || !!existingFiles.full;
  
  const hasFileError = Object.values(fileErrors).some((err) => !!err);
  const requiresFullPayment = Lunas && !fullPaymentFile && !existingFiles.full;
  const isSubmitDisabled = !hasAnyFile || hasFileError || requiresFullPayment;
  const [transactionLogs, setTransactionLogs] = useState<HistoryLog[]>([]);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

  const [sendingEmail, setSendingEmail] = useState<{ id: string; kind: EmailKind } | null>(null);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async (): Promise<Transaction[]> => {
    try {
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/transaction`);
      if (!response.ok) {
        await notifyResponseError(response, 'Data transaksi gagal dimuat');
        return [];
      }
      const data = await response.json();
      setTransactions(data);
      return data;
    } catch (error) {
      notifyError(error, 'Data transaksi gagal dimuat');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactionLogs = async (transactionId: string, page = 1) => {
  const offset = (page - 1) * logsPerPage;
  try {
    const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/transaction/history/${transactionId}?offset=${offset}&limit=${logsPerPage}`);
    if (!response.ok) {
      await notifyResponseError(response, 'Riwayat perubahan gagal dimuat');
      return;
    }
    const data = await response.json();

    setTransactionLogs(data.history);
    setLogTotalPages(Math.ceil(data.total / logsPerPage)); // <- update total halaman
    setLogPage(page); // <- update halaman sekarang
  } catch (error) {
    notifyError(error, 'Riwayat perubahan gagal dimuat');
  }
};



  const handleUpdatePayment = async () => {
  if (!selectedTransaction) return;

  setIsSavingPayment(true);
  try {
    const formData = new FormData();

    if (depositFile) formData.append('deposit', depositFile);
    if (downPaymentFile) formData.append('dp', downPaymentFile);
    if (fullPaymentFile) formData.append('full', fullPaymentFile);

    if (!depositFile && existingFiles.deposit === undefined) formData.append('deleteDeposit', 'true');
    if (!downPaymentFile && existingFiles.dp === undefined) formData.append('deleteDp', 'true');
    if (!fullPaymentFile && existingFiles.full === undefined) formData.append('deleteFull', 'true');

    formData.append('isLunas', Lunas ? 'true' : 'false');

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    formData.append('user_id', user?.id);
    formData.append('username', user?.username);

    const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/transaction/upload-payment/${selectedTransaction.id}`, {
      method: 'PUT',
      body: formData,
    });

    if (!response.ok) {
      await notifyResponseError(response, 'Bukti pembayaran gagal diunggah');
      return;
    }

    notifySuccess('Bukti pembayaran berhasil diunggah.');
    const updatedTransactions = await fetchTransactions();
    const updated = updatedTransactions.find((trx) => trx.id === selectedTransaction.id);
    if (updated) setSelectedTransaction(updated);
    
    fetchTransactionLogs(selectedTransaction.id); 
    // fetchTransactions(); 

    setShowEditModal(false);
    setDepositFile(null);
    setDownPaymentFile(null);
    setFullPaymentFile(null);
    setFileErrors({ deposit: '', dp: '', full: '' });
    fetchTransactions();
  } catch (err) {
    notifyError(err, 'Bukti pembayaran gagal diunggah');
  } finally {
    setIsSavingPayment(false);
  }
};

  const closePaymentModal = () => {
    setShowEditModal(false);
    setDepositFile(null);
    setDownPaymentFile(null);
    setFullPaymentFile(null);
    setFileErrors({ deposit: '', dp: '', full: '' });
    if (selectedTransaction) fetchTransactionLogs(selectedTransaction.id);
  };

  // The server reads recipient, name, and amounts from the database; the client only names the transaction.
  const sendTransactionEmail = async (trx: Transaction, kind: EmailKind) => {
    if (sendingEmail) return;
    const copy = EMAIL_COPY[kind];
    setSendingEmail({ id: trx.id, kind });

    try {
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/${copy.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: trx.id }),
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        toast.success(data?.dry_run ? `${copy.sent} ${DRY_RUN_NOTE}` : copy.sent);
        fetchTransactions();
        return;
      }

      // The session guard already shows its own toast for 401 and 403.
      if (isGuardedStatus(response.status)) return;

      switch (response.status) {
        case 404:
          toast.error(EMAIL_NOT_FOUND);
          break;
        case 409:
          toast.error(copy.notPaid ?? (await responseMessage(response, copy.failed)));
          break;
        case 429:
          toast.error(copy.throttled);
          break;
        case 422:
          // 422 covers a missing email and inconsistent amounts; the server message says which.
          toast.error(await responseMessage(response, copy.failed));
          break;
        default:
          toast.error(copy.failed);
      }
    } catch (err) {
      console.error(err);
      toast.error(copy.failed);
    } finally {
      setSendingEmail(null);
    }
  };


  const handleDeleteTransaction = async (reason: string) => {
  if (!selectedTransaction) return;

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  try {
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/transaction/delete/${selectedTransaction.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason,
        user_id: user?.id,
        username: user?.username,
      }),
    });

    if (!response.ok) {
      await notifyResponseError(response, 'Transaksi gagal dihapus');
      return;
    }

    notifySuccess('Transaksi berhasil dihapus.');
    fetchTransactions();
    setSelectedTransaction(null);
  } catch (error) {
    console.error(error);
    notifyError(error, 'Transaksi gagal dihapus');
  }
};

  const handleFileChange = (
  e: React.ChangeEvent<HTMLInputElement>,
  type: 'deposit' | 'dp' | 'full'
) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (file.size > 1024 * 1024) {
    setFileErrors((prev) => ({ ...prev, [type]: 'Ukuran file maksimal 1MB' }));
    return;
  }

  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  if (!validTypes.includes(file.type)) {
    setFileErrors((prev) => ({ ...prev, [type]: 'Format file harus JPG, JPEG, PNG, atau PDF' }));
    return;
  }

  setFileErrors((prev) => ({ ...prev, [type]: '' }));
  if (type === 'deposit') setDepositFile(file);
  if (type === 'dp') setDownPaymentFile(file);
  if (type === 'full') {
    setFullPaymentFile(file);
    setLunas(true); // ✅ otomatis centang
  }
};

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

const lowerQuery = searchQuery.toLowerCase();
const filteredTransactions = transactions.filter((trx) => {
  const depositStatus = trx.deposit_payment_url ? '✅' : '❌';
  const downStatus = trx.down_payment_url ? '✅' : '❌';
  const fullStatus = trx.full_payment_url ? '✅' : '❌';
  const lunasStatus = trx.lunas ? 'lunas' : 'belum';

  return (
    trx.booking_code?.toLowerCase().includes(lowerQuery) ||
    trx.email?.toLowerCase().includes(lowerQuery) ||
    trx.name?.toLowerCase().includes(lowerQuery) ||
    trx.car_type?.toLowerCase().includes(lowerQuery) ||
    depositStatus.includes(searchQuery) ||
    downStatus.includes(searchQuery) ||
    fullStatus.includes(searchQuery) ||
    lunasStatus.includes(lowerQuery)
  );
});

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredTransactions);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transaksi');
    XLSX.writeFile(workbook, 'data-transaksi.xlsx');
  };

  const {
    page: currentPage,
    setPage: setCurrentPage,
    totalPages,
    pageItems: pagedTransactions,
    startIndex,
  } = usePagination(
    filteredTransactions,
    itemsPerPage,
    `${searchQuery}|${startDate?.getTime() ?? ''}|${endDate?.getTime() ?? ''}`,
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">Data Transaksi</h2>
        </div>

        <div className="flex justify-end items-center flex-wrap gap-4">
          <DatePicker
            selected={startDate}
            onChange={(date) => setStartDate(date)}
            selectsStart
            startDate={startDate}
            endDate={endDate}
            placeholderText="Dari tanggal"
            className="w-40 px-3 py-2 border border-gray-300 rounded-md text-sm"
          />

          <DatePicker
            selected={endDate}
            onChange={(date) => setEndDate(date)}
            selectsEnd
            startDate={startDate}
            endDate={endDate}
            placeholderText="Sampai tanggal"
            className="w-40 px-3 py-2 border border-gray-300 rounded-md text-sm"
          />

          <div className="relative">
            <input
              type="text"
              placeholder="Cari kode booking, email, nama, atau mobil..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-72 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
          </div>

          <button
            onClick={exportToExcel}
            className="flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:from-orange-600 hover:to-yellow-600"
          >
            <FileDown size={20} /> 
            <span>Download ke Excel</span>
          </button>
        </div>
      </div>

      {loading ? (
  <div className="flex justify-center items-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
  </div>
) : (
  <>
    <ScrollableTable label="Tabel data transaksi">
      <table className="min-w-[1600px] w-full divide-y divide-gray-200 bg-white">
        <thead className={TABLE_HEAD_CLASS}>
                <tr>
                  <Th>#</Th>
                  <Th>Kode Booking</Th>
                  <Th>Email</Th>
                  <Th>Nama</Th>
                  <Th>Tipe Mobil</Th>
                  <Th>Durasi</Th>
                  <Th>Tanggal Mulai</Th>
                  <Th>Tanggal Selesai</Th>
                  <Th>Tipe Identitas</Th>
                  <Th>Deposit</Th>
                  <Th>DP</Th>
                  <Th>Full</Th>
                  <Th>Lunas</Th>
                  <Th>Log Kirim Invoice</Th>
                  <Th>Aksi</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pagedTransactions.length === 0 && (
                  <TableMessageRow colSpan={15}>
                    {searchQuery.trim()
                      ? `Tidak ada transaksi yang cocok dengan "${searchQuery.trim()}".`
                      : 'Belum ada transaksi. Transaksi muncul di sini setelah booking disimpan dari Formulir Customer.'}
                  </TableMessageRow>
                )}
                {pagedTransactions.map((trx, idx) => (
                    <tr key={trx.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-600 tabular-nums">{startIndex + idx + 1}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{trx.booking_code}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{trx.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{trx.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{trx.car_type}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{trx.rental_duration === 'daily' ? 'Harian' : 'Bulanan'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(trx.start_date)} {trx.start_time}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(trx.end_date)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {{
                          married: 'Menikah',
                          single: 'Single',
                          corporate: 'Perusahaan',
                          foreigner: 'WNA',
                          // reorder: 'Re-Order',
                        }[trx.identity_type || ''] || trx.identity_type || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {trx.deposit_payment_url ? '✅' : '❌'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {trx.down_payment_url ? '✅' : '❌'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {trx.full_payment_url ? '✅' : '❌'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {trx.lunas ? 'Lunas' : 'Belum'}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-500">
                        {trx.invoice_logs && trx.invoice_logs.length > 0 ? (
                          <div className="space-y-1">
                            {trx.invoice_logs
                              .slice()
                              .reverse()
                              .slice(0, 3) // tampilkan max 3 terakhir
                              .map((log, idx) => (
                                <div key={idx}>{formatDateTime(log)}</div>
                              ))}
                          </div>
                        ) : (
                          'Belum dikirim'
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="flex space-x-2">
                          {sendingEmail?.id === trx.id && sendingEmail.kind === 'invoice' ? (
                            <div className="text-orange-500 animate-spin" role="status" aria-label="Mengirim invoice">
                              <Loader size={20} />
                            </div>
                          ) : (
                            <button
                              onClick={() => sendTransactionEmail(trx, 'invoice')}
                              disabled={sendingEmail !== null}
                              className="text-green-600 hover:text-green-700 transform hover:scale-110 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Kirim Invoice"
                              aria-label="Kirim Invoice"
                            >
                              <Send size={20} />
                            </button>
                          )}

                          {sendingEmail?.id === trx.id && sendingEmail.kind === 'receipt' ? (
                            <div className="text-orange-500 animate-spin" role="status" aria-label="Mengirim bukti pembayaran">
                              <Loader size={20} />
                            </div>
                          ) : trx.lunas ? (
                            <button
                              onClick={() => sendTransactionEmail(trx, 'receipt')}
                              disabled={sendingEmail !== null}
                              className="text-purple-600 hover:text-purple-700 transform hover:scale-110 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Kirim bukti pembayaran"
                              aria-label="Kirim bukti pembayaran"
                            >
                              <Receipt size={20} />
                            </button>
                          ) : (
                            <div
                              title="Belum lunas"
                              aria-label="Kirim bukti pembayaran, belum lunas"
                              className="text-gray-400 cursor-not-allowed"
                            >
                              <Receipt size={20} />
                            </div>
                          )}

                          <button
                            onClick={() => {
                              setSelectedTransaction(trx);
                              fetchTransactionLogs(trx.id);
                            } }
                            className="text-orange-500 hover:text-orange-600 transform hover:scale-110 transition duration-150"
                            title="Lihat Detail"
                          >
                            <Eye size={20} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedTransaction(trx);
                              setLunas(trx.lunas || false);

                              console.log(
                                'Deposit (raw):', trx.deposit_payment_url,
                                '\nDeposit (trimmed):', trx.deposit_payment_url?.trim(),
                                '\nDown Payment (raw):', trx.down_payment_url,
                                '\nDown Payment (trimmed):', trx.down_payment_url?.trim(),
                                '\nFull Payment (raw):', trx.full_payment_url,
                                '\nFull Payment (trimmed):', trx.full_payment_url?.trim()
                              );


                              setExistingFiles({
                                deposit: fileUrl(trx.deposit_payment_url),
                                dp: fileUrl(trx.down_payment_url),
                                full: fileUrl(trx.full_payment_url),
                              });
                              setShowEditModal(true);
                            } }
                            className="text-blue-500 hover:text-blue-600 transform hover:scale-110 transition duration-150"
                            title="Edit"
                          >
                            <Edit2 size={20} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedTransaction(trx);
                              setShowDeleteModal(true);
                            } }
                            className="text-red-500 hover:text-red-600 transform hover:scale-110 transition duration-150"
                            title="Hapus"
                          >
                            <Trash2 size={20} />
                          </button>

                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
    </ScrollableTable>



            <Modal
              open={showEditModal && !!selectedTransaction}
              onClose={closePaymentModal}
              title="Upload Bukti Pembayaran"
              size="md"
              busy={isSavingPayment}
              footer={
                <>
                  <ModalButton onClick={closePaymentModal} disabled={isSavingPayment}>Batal</ModalButton>
                  <ModalButton
                    variant="primary"
                    onClick={handleUpdatePayment}
                    disabled={isSubmitDisabled}
                    busy={isSavingPayment}
                    busyLabel="Menyimpan..."
                  >
                    Simpan
                  </ModalButton>
                </>
              }
            >
                    <div className="space-y-4">
                      {['deposit', 'dp', 'full'].map((type) => {
                        const file = type === 'deposit' ? depositFile :
                          type === 'dp' ? downPaymentFile :
                            fullPaymentFile;

                        const existingFile = existingFiles[type as keyof typeof existingFiles];

                        // console.log(`${type} existingFile:`, existingFile);
                        return (
                          <div key={type} className="relative space-y-1">
                            <label className="block text-sm font-medium text-gray-700">
                              {type === 'deposit' && 'Bukti Pembayaran Deposit'}
                              {type === 'dp' && 'Bukti Pembayaran Down Payment'}
                              {type === 'full' && 'Bukti Pembayaran Full Payment'}
                            </label>

                            {existingFile && !file && (
                              <div className="flex items-center justify-between bg-gray-100 p-2 rounded border border-gray-300">
                                <div className="flex items-center gap-3">
                                  {/\.(jpg|jpeg|png)$/i.test(existingFile) ? (
                                    <div className="relative group flex flex-col items-start">
                                      <button
                                        type="button"
                                        onClick={() => setPreviewImageUrl(existingFile)}
                                        aria-label="Perbesar bukti pembayaran"
                                        className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2"
                                      >
                                        <img
                                          src={existingFile}
                                          alt="Bukti pembayaran"
                                          className="w-24 h-16 object-cover rounded border"
                                        />
                                      </button>
                                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition pointer-events-none">
                                        <span className="text-white text-xs pointer-events-none">Klik untuk memperbesar</span>
                                      </div>
                                      <span className="text-xs mt-1 text-gray-600">
                                        {existingFile.split('/').pop()}
                                      </span>
                                    </div>
                                  ) : (
                                    <a
                                      href={existingFile}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 underline text-sm truncate"
                                    >
                                      {existingFile.split('/').pop()}
                                    </a>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExistingFiles((prev) => ({ ...prev, [type]: undefined }));

                                    if (type === 'deposit') setDepositFile(null);
                                    if (type === 'dp') setDownPaymentFile(null);
                                    if (type === 'full') setFullPaymentFile(null);
                                  } }
                                  className="text-red-500 hover:text-red-700 font-bold text-lg ml-2"
                                  title="Hapus file"
                                >
                                  ✕
                                </button>
                              </div>
                            )}

                            {!existingFile && (
                              <div className="relative">
                                <input
                                  type="file"
                                  accept=".jpg,.jpeg,.png,.pdf"
                                  onChange={(e) => handleFileChange(e, type as 'deposit' | 'dp' | 'full')}
                                  className="w-full border border-gray-300 rounded-lg p-2 pr-10" />
                                {file && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (type === 'deposit') setDepositFile(null);
                                      if (type === 'dp') setDownPaymentFile(null);
                                      if (type === 'full') setFullPaymentFile(null);
                                      setFileErrors((prev) => ({ ...prev, [type]: '' }));
                                      if (type === 'full') setLunas(false);
                                    } }
                                    className="absolute top-1/2 right-3 -translate-y-1/2 text-red-500 hover:text-red-700 font-bold text-lg"
                                    title="Hapus file"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            )}

                            {fileErrors[type as keyof typeof fileErrors] && (
                              <p className="text-sm text-red-500">
                                {fileErrors[type as keyof typeof fileErrors]}
                              </p>
                            )}
                          </div>
                        );
                      })}



                      <p className="text-xs text-gray-500 mt-1">
                        Format: JPG, JPEG, PNG, PDF. Maksimal ukuran: <span className="font-semibold">1MB</span>
                      </p>

                      {/* Checklist Lunas */}
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="checkbox"
                          checked={Lunas}
                          disabled={!fullPaymentFile && !existingFiles.full}
                          onChange={(e) => setLunas(e.target.checked)}
                          className="h-4 w-4 text-orange-500 border-gray-300 rounded" />
                        <label className="text-sm text-gray-700">Sudah Lunas</label>
                      </div>
                    </div>

                    <ImageDialog src={previewImageUrl} alt="Bukti pembayaran" onClose={() => setPreviewImageUrl(null)} />
            </Modal>

            <ConfirmDialog
              open={showDeleteModal && !!selectedTransaction}
              onClose={() => setShowDeleteModal(false)}
              title="Hapus transaksi?"
              description={
                <>
                  Transaksi <span className="font-semibold text-gray-900">{selectedTransaction?.booking_code}</span> akan
                  dihapus dari daftar. Alasannya tercatat di riwayat perubahan.
                </>
              }
              confirmLabel="Hapus transaksi"
              reason={{ label: 'Alasan penghapusan', placeholder: 'Contoh: booking dibatalkan customer' }}
              onConfirm={handleDeleteTransaction}
            />

            {selectedTransaction && !showEditModal && !showDeleteModal && (
              <Modal
                open
                onClose={() => {
                  setSelectedTransaction(null);
                  setTransactionLogs([]);
                }}
                title="Detail Transaksi"
                size="xl"
              >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Kiri - Info Booking & Penyewaan */}
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-lg font-semibold mb-4">Informasi Booking</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-600">Kode Booking</p>
                              <p className="font-medium">{selectedTransaction.booking_code}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Tanggal Dibuat</p>
                              <p className="font-medium">{formatDate(selectedTransaction.created_at)}</p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-lg font-semibold mb-4">Detail Penyewaan</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-600">Tipe Sewa</p>
                              <p className="font-medium">
                                {selectedTransaction.rental_duration === 'daily' ? 'Harian' : 'Bulanan'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Tipe Mobil</p>
                              <p className="font-medium">{selectedTransaction.car_type}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Tanggal Mulai</p>
                              <p className="font-medium">
                                {formatDate(selectedTransaction.start_date)} {selectedTransaction.start_time}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Tanggal Selesai</p>
                              <p className="font-medium">{formatDate(selectedTransaction.end_date)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Durasi Sewa</p>
                              <p className="font-medium">
                                {selectedTransaction.rental_duration === 'daily'
                                  ? `${selectedTransaction.range_rent || '-'} Hari`
                                  : `${selectedTransaction.range_rent || '-'} Bulan`}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Layanan Tambahan</p>
                              <p className="font-medium">
                                {[
                                  selectedTransaction.needs_trip && 'Luar Kota',
                                  selectedTransaction.needs_driver && 'Supir',
                                  selectedTransaction.needs_delivery && 'Antar',
                                  selectedTransaction.needs_pickup && 'Jemput',
                                ]
                                  .filter(Boolean)
                                  .join(', ') || 'Tidak ada'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Deposit</p>
                              <p className="font-medium">
                                {selectedTransaction.deposit != null
                                  ? `Rp ${Number(selectedTransaction.deposit).toLocaleString('id-ID', {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                  })}`
                                  : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Discount</p>
                              <p className="font-medium">
                                {selectedTransaction.discount != null
                                  ? `Rp ${Number(selectedTransaction.discount).toLocaleString('id-ID', {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                  })}`
                                  : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Total Pembayaran</p>
                              <p className="font-medium">
                                {selectedTransaction.grand_total != null
                                  ? `Rp ${Number(selectedTransaction.grand_total).toLocaleString('id-ID', {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                  })}`
                                  : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Status Transaksi</p>
                              <p className="font-medium">
                                {selectedTransaction.lunas ? 'Lunas' : 'Belum Lunas'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Dibuat Oleh</p>
                              <p className="font-medium">{selectedTransaction.created_by || '-'}</p>
                            </div>
                            <div className="mb-6">
                              <p className="text-sm text-gray-600">Diedit Oleh</p>
                              <p className="font-medium">{selectedTransaction.updated_by || '-'}</p>
                            </div>
                          </div>

                          {/* Bukti Pembayaran */}
                          <div>
                            <h4 className="text-lg font-semibold mb-4">Bukti Pembayaran</h4>

                            {(!selectedTransaction.deposit_payment_url &&
                              !selectedTransaction.down_payment_url &&
                              !selectedTransaction.full_payment_url) ? (
                              <p className="text-sm text-gray-500 italic">
                                Tidak ada bukti pembayaran apapun.
                              </p>
                            ) : (
                              <div className="grid grid-cols-2 gap-4">
                                {PAYMENT_PROOFS.map(({ key, label }) => {
                                  const filename = selectedTransaction[key];
                                  return filename ? (
                                    <div key={key}>
                                      <p className="text-sm text-gray-600">{label}</p>
                                      <PaymentProof filename={filename} label={label} />
                                    </div>
                                  ) : null;
                                })}
                              </div>
                            )}
                          </div>

                        </div>
                      </div>



                      {/* Kanan - Data Penyewa & Riwayat */}
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-lg font-semibold mb-4">Data Penyewa</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-600">Nama</p>
                              <p className="font-medium">{selectedTransaction.name}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Email</p>
                              <p className="font-medium">{selectedTransaction.email || '-'}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Whatsapp</p>
                              <p className="font-medium">{selectedTransaction.whatsapp || '-'}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Alamat Tempat Tinggal</p>
                              <p className="font-medium">{selectedTransaction.address || '-'}</p>
                            </div>
                            <div className="col-span-2 md:col-span-1">
                              <p className="text-sm text-gray-600">Tipe Identitas</p>
                              <p className="font-medium">
                                {{
                                  married: 'Menikah',
                                  single: 'Single',
                                  corporate: 'Perusahaan',
                                  foreigner: 'WNA',
                                  // reorder: 'Re-Order',
                                }[selectedTransaction.identity_type as string] || selectedTransaction.identity_type || '-'}
                              </p>
                            </div>
                            {selectedTransaction.identity_type === 'corporate' && (
                              <div className="col-span-2 md:col-span-1">
                                <p className="text-sm text-gray-600">Alamat Perusahaan</p>
                                <p className="font-medium">{selectedTransaction.company_address || '-'}</p>
                              </div>
                            )}
                          </div>
                        </div>



                        {transactionLogs.length > 0 && (
                          <div>
                            <h4 className="text-lg font-semibold mb-4 flex items-center">
                              <Clock size={20} className="mr-2" />
                              Riwayat Perubahan
                            </h4>
                            <div className="space-y-4">
                              {transactionLogs.map((log) => (
                                <div key={log.id} className={`border-l-4 ${getActionColor(log.action)} pl-4 py-2`}>
                                  <p className="text-sm text-gray-600">{formatDateTime(log.created_at)}</p>
                                  <p className="font-medium">
                                    {getActionText(log.action)}
                                    {log.changes.reason && (
                                      <span className="text-gray-500 ml-2">- {log.changes.reason}</span>
                                    )}
                                  </p>
                                </div>
                              ))}

                              {logTotalPages > 1 && (
                                <div className="flex justify-end items-center space-x-2 mt-4">
                                  <button
                                    onClick={() => fetchTransactionLogs(selectedTransaction.id, logPage - 1)}
                                    disabled={logPage === 1}
                                    className="px-2 py-1 border rounded text-sm disabled:opacity-50"
                                  >
                                    &laquo;
                                  </button>

                                  {[...Array(logTotalPages)].map((_, i) => (
                                    <button
                                      key={i}
                                      onClick={() => fetchTransactionLogs(selectedTransaction.id, i + 1)}
                                      className={`px-2 py-1 border rounded text-sm ${logPage === i + 1 ? 'bg-orange-500 text-white' : ''}`}
                                    >
                                      {i + 1}
                                    </button>
                                  ))}

                                  <button
                                    onClick={() => fetchTransactionLogs(selectedTransaction.id, logPage + 1)}
                                    disabled={logPage === logTotalPages}
                                    className="px-2 py-1 border rounded text-sm disabled:opacity-50"
                                  >
                                    &raquo;
                                  </button>
                                </div>
                              )}

                            </div>
                          </div>
                        )}

                      </div>
                    </div>
              </Modal>
            )}




          <Pagination
            page={currentPage}
            totalPages={totalPages}
            totalItems={filteredTransactions.length}
            pageCount={pagedTransactions.length}
            startIndex={startIndex}
            onPageChange={setCurrentPage}
            itemLabel="transaksi"
          /></>
      )}

    </div>
    
  );
    
};




export default TransactionDatabase;