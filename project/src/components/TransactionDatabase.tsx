import React, { useEffect, useState, useRef } from 'react';
import { Search, Eye, FileDown, Clock, Edit2, Trash2, AlertCircle, Send, Loader, Receipt } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

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
  const [deleteReason, setDeleteReason] = useState('');
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);
  const logsPerPage = 5;
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const scrollPos = useRef({ left: 0, top: 0 });


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
  const PUBLIC_BASE = import.meta.env.VITE_API_PUBLIC_URL || '';

  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);



  const getValidUrl = (filename?: string) => {
  if (!filename) return undefined;
  return `${PUBLIC_BASE}/uploads/${filename}`;
  };


  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
  if (sendingEmailId) {
    console.log('Sedang kirim email untuk ID:', sendingEmailId);
  }
}, [sendingEmailId]);

  const fetchTransactions = async (): Promise<Transaction[]> => {
    try {
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/transaction`);
      if (!response.ok) throw new Error('Gagal ambil data transaksi');
      const data = await response.json();
      setTransactions(data);
      return data;
    } catch (error) {
      toast.error('Terjadi kesalahan saat mengambil data transaksi.');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactionLogs = async (transactionId: string, page = 1) => {
  const offset = (page - 1) * logsPerPage;
  try {
    const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/transaction/history/${transactionId}?offset=${offset}&limit=${logsPerPage}`);
    if (!response.ok) throw new Error('Gagal ambil riwayat transaksi');
    const data = await response.json();
    
    setTransactionLogs(data.history);
    setLogTotalPages(Math.ceil(data.total / logsPerPage)); // <- update total halaman
    setLogPage(page); // <- update halaman sekarang
  } catch (error) {
    toast.error('Gagal memuat riwayat perubahan');
  }
};


useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest('button') ||
        target.closest('input') ||
        target.closest('img') ||
        target.tagName === 'BUTTON' ||
        target.tagName === 'INPUT' ||
        target.tagName === 'IMG'
      ) return;

      isDragging.current = true;
      startPos.current = { x: e.clientX, y: e.clientY };
      scrollPos.current = { left: container.scrollLeft, top: container.scrollTop };
      container.style.cursor = 'grabbing';
      container.style.userSelect = 'none';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      container.scrollLeft = scrollPos.current.left - dx;
      container.scrollTop = scrollPos.current.top - dy;
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      if (container) {
        container.style.cursor = 'grab';
        container.style.userSelect = '';
      }
    };

    const handleMouseLeave = () => {
      isDragging.current = false;
      if (container) {
        container.style.cursor = 'grab';
        container.style.userSelect = '';
      }
    };

    container.style.cursor = 'grab';

    container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);


  const handleUpdatePayment = async () => {
  if (!selectedTransaction) return;

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

    if (!response.ok) throw new Error('Gagal upload');

    toast.success('Bukti pembayaran berhasil diunggah');
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
    toast.error('Gagal mengunggah bukti pembayaran');
  }
};

 const handleSendInvoice = async (trx: Transaction) => {
    if (!trx.email) {
      toast.error('Email pelanggan tidak tersedia.');
      return;
    }

    try {
      const payload = {
        to: trx.email,
        customerName: trx.name,
        bookingCode: trx.booking_code,
        carType: trx.car_type,
        startDate: formatDate(trx.start_date),
        startTime: trx.start_time,
        endDate: formatDate(trx.end_date),
        deposit: trx.deposit,
        discount: trx.discount,
        needsTrip: trx.needs_trip,
        needsDriver: trx.needs_driver,
        needsDelivery: trx.needs_delivery,
        needsPickup: trx.needs_pickup,
        rentalCost: trx.grand_total || 0,
        tripFee: trx.trip_fee,
        driverFee: trx.driver_fee,
        deliveryFee: trx.delivery_fee,
        pickupFee: trx.pickup_fee,
        grandTotal: trx.grand_total || 0
      };

      const response = await fetch(`${API_BASE_URL}/send-confirmation-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
      const errorData = await response.json(); // ⬅️ Ambil pesan error dari backend
      const message = errorData?.error || 'Gagal mengirim invoice.';
      toast.error(message); // ⬅️ Tampilkan langsung ke UI
      return;
    }

    toast.success('Invoice berhasil dikirim ke email pelanggan.');
  } catch (err) {
    console.error(err);
    toast.error('Terjadi kesalahan jaringan.');
  } finally {
    setSendingEmailId(null);
  }
};

const handleSendReceipt = async (trx: Transaction) => {
  if (!trx.email) {
    toast.error('Email pelanggan tidak tersedia.');
    return;
  }

  try {
    const payload = {
      to: trx.email,
      customerName: trx.name,
      bookingCode: trx.booking_code,
      carType: trx.car_type,
      startDate: formatDate(trx.start_date),
      startTime: trx.start_time,
      endDate: formatDate(trx.end_date),
      grandTotal: trx.grand_total || 0
    };

    const response = await fetch(`${API_BASE_URL}/send-receipt-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json();
      toast.error(data?.message || 'Gagal mengirim receipt.');
      return;
    }

    toast.success('Receipt berhasil dikirim ke email pelanggan.');
  } catch (error) {
    toast.error('Terjadi kesalahan saat mengirim receipt.');
  }
};


  const handleDeleteTransaction = async () => {
  if (!selectedTransaction || !deleteReason.trim()) return;

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  try {
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/transaction/delete/${selectedTransaction.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: deleteReason,
        user_id: user?.id,
        username: user?.username,
      }),
    });

    if (!response.ok) throw new Error('Gagal menghapus transaksi');

    toast.success('Transaksi berhasil dihapus.');
    fetchTransactions();
    setShowDeleteModal(false);
    setDeleteReason('');
    setSelectedTransaction(null);
  } catch (error) {
    console.error(error);
    toast.error('Terjadi kesalahan saat menghapus transaksi.');
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

  const validTypes = ['image/jpeg', 'image/jpg', 'application/pdf'];
  if (!validTypes.includes(file.type)) {
    setFileErrors((prev) => ({ ...prev, [type]: 'Format file harus JPG, JPEG, atau PDF' }));
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, startDate, endDate]);

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

{/* Drag instruction */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              💡 <strong>Tips:</strong> Klik dan seret area kosong tabel (seperti header atau cell kosong) untuk menggulir horizontal/vertikal. Hindari menyeret pada tombol, gambar, atau elemen interaktif.
            </p>
          </div>


    <div
  ref={tableContainerRef}
  className="overflow-auto rounded-lg border bg-white shadow select-none cursor-grab active:cursor-grabbing"
  style={{ maxHeight: '65vh',
    touchAction: 'none' }}
>
      <table className="min-w-[1600px] w-full divide-y divide-gray-200 bg-white">
        <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kode Booking</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipe Mobil</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durasi</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal Mulai</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal Selesai</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipe Identitas</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deposit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">DP</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Full</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lunas</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Log Kirim Invoice</th>
                  <th className="px-6 py-3 text-left text-xs text-center font-medium text-gray-500 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTransactions
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map((trx) => (
                    <tr key={trx.id} className="hover:bg-gray-50">
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
                      <td className="px-6 py-4 text-sm text-center text-gray-500">
                        {trx.deposit_payment_url ? '✅' : '❌'}
                      </td>
                      <td className="px-6 py-4 text-sm text-center text-gray-500">
                        {trx.down_payment_url ? '✅' : '❌'}
                      </td>
                      <td className="px-6 py-4 text-sm text-center text-gray-500">
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
                          {sendingEmailId === trx.id ? (
                            <div className="text-orange-500 animate-spin">
                              <Loader size={20} />
                            </div>
                          ) : (
                            <button
                              onClick={() => handleSendInvoice(trx)}
                              className="text-green-600 hover:text-green-700 transform hover:scale-110 transition duration-150"
                              title="Kirim Invoice"
                            >
                              <Send size={20} />
                            </button>
                          )}

                          {trx.lunas ? (
                            <button
                              onClick={() => handleSendReceipt(trx)}
                              className="text-purple-600 hover:text-purple-700 transform hover:scale-110 transition duration-150"
                              title="Kirim Receipt"
                            >
                              <Receipt size={20} />
                            </button>
                          ) : (
                            <div
                              title="Belum Lunas"
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
                                deposit: getValidUrl(trx.deposit_payment_url),
                                dp: getValidUrl(trx.down_payment_url),
                                full: getValidUrl(trx.full_payment_url),
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




            {showEditModal && selectedTransaction && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-semibold text-gray-800">Upload Bukti Pembayaran</h3>
                      <button
                        onClick={() => {
                          setShowEditModal(false);
                          setDepositFile(null);
                          setDownPaymentFile(null);
                          setFullPaymentFile(null);
                          setFileErrors({ deposit: '', dp: '', full: '' });

                          if (selectedTransaction) {
                            fetchTransactionLogs(selectedTransaction.id);
                          }
                        } }
                        className="text-gray-500 hover:text-gray-700 text-xl font-bold"
                      >
                        ✕
                      </button>
                    </div>

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
                                      <img
                                        src={existingFile}
                                        alt="Bukti pembayaran"
                                        className="w-24 h-16 object-cover rounded cursor-pointer border"
                                        onClick={() => {
                                          console.log('clicked');
                                          setPreviewImageUrl(existingFile);
                                        } } />
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
                                  accept=".jpg,.jpeg,.pdf"
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
                        Format: JPG, JPEG, PDF. Maksimal ukuran: <span className="font-semibold">1MB</span>
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



                      {/* Tombol */}
                      <div className="flex justify-end space-x-3 mt-6">
                        <button
                          onClick={() => {
                            setShowEditModal(false);
                            setDepositFile(null);
                            setDownPaymentFile(null);
                            setFullPaymentFile(null);
                            setFileErrors({ deposit: '', dp: '', full: '' });

                            if (selectedTransaction) {
                              fetchTransactionLogs(selectedTransaction.id); // ⬅️ Tambahin ini
                            }

                          } }
                          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
                        >
                          Batal
                        </button>
                        <button
                          onClick={handleUpdatePayment}
                          disabled={isSubmitDisabled}
                          className={`px-4 py-2 rounded-lg text-white font-semibold ${hasFileError || !hasAnyFile || requiresFullPayment
                              ? 'bg-orange-200 cursor-not-allowed'
                              : 'bg-orange-500 hover:bg-orange-600'}`}
                        >
                          Simpan
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showDeleteModal && selectedTransaction && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
                  <div className="p-6">
                    <div className="flex items-center mb-6 text-red-600">
                      <AlertCircle size={24} className="mr-2" />
                      <h3 className="text-xl font-semibold">Konfirmasi Penghapusan</h3>
                    </div>

                    <div className="space-y-4">
                      <p className="text-gray-600">
                        Anda akan menghapus data transaksi dengan kode booking:{' '}
                        <span className="font-semibold">{selectedTransaction.booking_code}</span>
                      </p>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Alasan Penghapusan <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={deleteReason}
                          onChange={(e) => setDeleteReason(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
                          rows={3}
                          placeholder="Masukkan alasan penghapusan transaksi..."
                          required />
                      </div>

                      <div className="flex justify-end space-x-3">
                        <button
                          onClick={() => {
                            setShowDeleteModal(false);
                            setDeleteReason('');
                          } }
                          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                        >
                          Batal
                        </button>
                        <button
                          onClick={handleDeleteTransaction}
                          disabled={!deleteReason.trim()}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {previewImageUrl && (
              <div
                className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
                onClick={() => setPreviewImageUrl(null)}
              >
                <div className="relative">
                  <img
                    src={previewImageUrl}
                    alt="Preview Gambar"
                    className="max-w-[90vw] max-h-[90vh] rounded shadow-lg" />
                  <button
                    onClick={() => setPreviewImageUrl(null)}
                    className="absolute top-2 right-2 text-white text-2xl font-bold bg-black bg-opacity-50 rounded-full px-3 py-1"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}



            {selectedTransaction && !showEditModal && !showDeleteModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-2xl font-semibold">Detail Transaksi</h3>
                      <button
                        onClick={() => {
                          setSelectedTransaction(null);
                          setTransactionLogs([]);
                        } }
                        className="text-gray-500 hover:text-gray-700"
                      >
                        ✕
                      </button>
                    </div>

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
                                {selectedTransaction.deposit_payment_url && (
                                  <div>
                                    <p className="text-sm text-gray-600">Deposit</p>
                                    <img
                                      src={getValidUrl(selectedTransaction.deposit_payment_url)}
                                      alt="Deposit"
                                      className="w-full h-32 object-cover rounded shadow" />
                                  </div>
                                )}
                                {selectedTransaction.down_payment_url && (
                                  <div>
                                    <p className="text-sm text-gray-600">Down Payment</p>
                                    <img
                                      src={getValidUrl(selectedTransaction.down_payment_url)}
                                      alt="Down Payment"
                                      className="w-full h-32 object-cover rounded shadow" />
                                  </div>
                                )}
                                {selectedTransaction.full_payment_url && (
                                  <div>
                                    <p className="text-sm text-gray-600">Full Payment</p>
                                    <img
                                      src={getValidUrl(selectedTransaction.full_payment_url)}
                                      alt="Full Payment"
                                      className="w-full h-32 object-cover rounded shadow" />
                                  </div>
                                )}
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
                  </div>
                </div>
              </div>
            )}




          </div><div className="flex justify-between items-center mt-4">
              <p className="text-sm text-gray-600">
                Menampilkan {Math.min(itemsPerPage, filteredTransactions.length - (currentPage - 1) * itemsPerPage)} dari {filteredTransactions.length} transaksi
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                >
                  &laquo;
                </button>
               {(() => {
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const pages = [];
  const current = currentPage;

  const showLeftEllipsis = current > 6;
  const showRightEllipsis = current < totalPages - 5;
  const startPage = showLeftEllipsis ? Math.max(current - 4, 2) : 2;
  const endPage = showRightEllipsis
    ? Math.min(current + 4, totalPages - 1)
    : totalPages - 1;

  // Always show first page
  pages.push(
    <button
      key={1}
      onClick={() => setCurrentPage(1)}
      className={`px-3 py-1 border rounded ${current === 1 ? 'bg-orange-500 text-white' : 'hover:bg-gray-100'}`}
    >
      1
    </button>
  );

  // Left Ellipsis
  if (showLeftEllipsis) {
    pages.push(<span key="left-ellipsis" className="px-2">...</span>);
  }

  // Page range
  for (let i = startPage; i <= endPage; i++) {
    pages.push(
      <button
        key={i}
        onClick={() => setCurrentPage(i)}
        className={`px-3 py-1 border rounded ${current === i ? 'bg-orange-500 text-white' : 'hover:bg-gray-100'}`}
      >
        {i}
      </button>
    );
  }

  // Right Ellipsis
  if (showRightEllipsis) {
    pages.push(<span key="right-ellipsis" className="px-2">...</span>);
  }

  // Last Page
  if (totalPages > 1) {
    pages.push(
      <button
        key={totalPages}
        onClick={() => setCurrentPage(totalPages)}
        className={`px-3 py-1 border rounded ${current === totalPages ? 'bg-orange-500 text-white' : 'hover:bg-gray-100'}`}
      >
        {totalPages}
      </button>
    );
  }

  return pages;
})()}
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, Math.ceil(filteredTransactions.length / itemsPerPage))
                  )}
                  disabled={currentPage === Math.ceil(filteredTransactions.length / itemsPerPage)}
                  className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                >
                  &raquo;
                </button>
              </div>
            </div></>
      )}

    </div>
    
  );
    
};




export default TransactionDatabase;