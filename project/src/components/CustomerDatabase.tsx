import React, { useState, useEffect, useRef } from 'react';
import { Eye, Edit2, Search, Clock, Trash2, Repeat, FileText } from 'lucide-react';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import toast from 'react-hot-toast';
import CustomerBookingForm from './CustomerBookingForm';
import TermsAndConditions from './TermsAndConditions';
import BookingConfirmation from './BookingConfirmation';
import { getDocumentsToShowByIdentityType } from '../utils/documentutils';
import { fileUrl } from '../lib/fileUrl';
import { isGuardedStatus, notifyError, notifyResponseError, notifySuccess } from '../lib/notify';
import { computeTotals } from '../lib/pricing.mjs';
import { isPdfFile, readServerError } from '../types';
import Pagination from './ui/Pagination';
import { ScrollableTable, TABLE_HEAD_CLASS, TableMessageRow, Th } from './ui/DataTable';
import { usePagination } from '../lib/usePagination';
import { ConfirmDialog, ImageDialog, Modal, ModalButton } from './ui/Modal';

// Browsers cannot render a PDF inside <img>, so PDFs open in a new tab instead of a thumbnail.
const PdfTile: React.FC<{ href?: string; label: string; className?: string }> = ({ href, label, className = '' }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={`Buka PDF ${label} di tab baru`}
    className={`flex flex-col items-center justify-center gap-1 rounded-lg border border-gray-300 bg-gray-50 text-orange-700 hover:bg-orange-50 hover:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${className}`}
  >
    <FileText size={28} aria-hidden="true" />
    <span className="text-sm font-semibold underline">Buka PDF</span>
  </a>
);





interface Customer {
  id: string;
  booking_code: string;
  name: string;
  email: string;
  whatsapp: string;
  identity_type: string;
  created_at: string;
  documents: Record<string, string>;
  range_rent?: number;
  rental_duration: string;
  car_type: string;
  needs_driver: boolean;
  needs_delivery: boolean;
  start_date: string;
  start_time: string;
  end_date: string;
  purpose: string;
  address: string;
  company_address?: string;
  payment_proof?: Record<string, string>;
  deleted: boolean;
  delete_reason?: string;
  created_by?: string;
  updated_by?: string;
}

interface HistoryLog {
  id: string;
  action: string;
  changes: {
    before: any;
    after: any;
    reason?: string;
    created_by?: string;
    updated_by?: string;
  };
  created_at: string;
}

interface CustomerDatabaseProps {
  // Opens the Reorder dialog for this customer once the list has loaded (sent from the booking form warning).
  initialReorderCustomerId?: string | null;
  onInitialReorderHandled?: () => void;
}

const CustomerDatabase: React.FC<CustomerDatabaseProps> = ({ initialReorderCustomerId, onInitialReorderHandled }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editedCustomer, setEditedCustomer] = useState<Customer | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const itemsPerPage = 10;
  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

  const [modalMode, setModalMode] = useState<'detail' | 'reorder' | null>(null); 
  const [showReorderForm, setShowReorderForm] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [reorderFormData, setReorderFormData] = useState<any>(null);

  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [isReorderSubmitting, setIsReorderSubmitting] = useState(false);
  // Synchronous guard: a second click can arrive before isReorderSubmitting re-renders the button.
  const reorderLock = useRef(false);
  const [transactionList, setTransactionList] = useState<any[]>([]);
  const [selectedTransactionList, setSelectedTransactionList] = useState<any[]>([]);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const handleShowTransactions = (customer: Customer) => {
  const custKey = `${customer.email?.toLowerCase().trim()}|${customer.identity_type?.toLowerCase().trim()}`;

  const matchedTransactions = transactionList
    .filter((trx) => {
      const trxKey = `${trx.email?.toLowerCase().trim()}|${trx.identity_type?.toLowerCase().trim()}`;
      return trxKey === custKey;
    })
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()); // Urut dari terbaru

  setSelectedTransactionList(matchedTransactions);
  setShowTransactionModal(true);
};


  

  useEffect(() => {
  fetch(`${API_BASE_URL}`.replace(/\/$/, '') + '/transaction')
    .then((res) => res.json())
    .then((data) => {
      console.log("transactionList",data);
      setTransactionList(data);
    });
}, []);


  

  const documentLabels: { [key: string]: string } = {
    kkFile: "Kartu Keluarga",
    parentKtpFile: "KTP Orang Tua",
    housePhotoFile: "Foto Rumah",
    workOrStudentIdFile: "ID Kerja / Sekolah / Surat Usaha",
    personalIdFile: "ID Pribadi",
    spouseKtpFile: "KTP Suami / Istri",
    marriageDocFile: "Dokumen Pernikahan",
    ktpFile: "KTP",
    simFile: "SIM",
    workIdFile: "ID Kerja",
    picKtpFile: "KTP PIC",
    picKkFile: "KK PIC",
    companyNpwpFile: "NPWP Perusahaan",
    companySiupFile: "SIUP Perusahaan",
    companyNibFile: "NIB Perusahaan",
    companyPhotoFile: "Foto Perusahaan",
    passportFile: "Passport",
    kitasKitapFile: "KITAS / KITAP",
    visaFile: "Visa",
    ticketFile: "Tiket Perjalanan",
    ticketHotelFile: "Tiket Booking Hotel",
    verificationVideoFile: "Video Verifikasi Call",
    optionalRequirementFile: "Persyaratan Optional",
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/customer`);
      if (!response.ok) throw new Error('Gagal ambil data');
      const data = await response.json();
      setCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
      finally {
      setLoading(false);
    }
  };

  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const itemsPerHistoryPage = 5;

  
  const fetchHistoryLogs = async (customerId: string, page = 1) => {
    const offset = (page - 1) * itemsPerHistoryPage;

  try {
    const response = await fetch(`${API_BASE_URL}/customer/history/${customerId}?limit=${itemsPerHistoryPage}&offset=${offset}`);
    if (!response.ok) throw new Error('Gagal ambil log histori');

    const data = await response.json();

    console.log('History response:', data);
    console.log('Total Pages:', Math.ceil(data.total / data.limit));

    setHistoryLogs(data.history); // ganti seluruhnya, bukan append
    setHistoryPage(page);
    setHistoryTotalPages(Math.ceil(data.total / data.limit)); // backend harus kirim totalPages
  } catch (error) {
    console.error('Error fetching history logs:', error);
  }
};

  // const handlePaymentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = e.target.files?.[0];
  //   if (!file) {
  //     setPaymentFile(null);
  //     return;
  //   }

    // Validate file size (2MB)
    // if (file.size > 2 * 1024 * 1024) {
    //   toast.error('Ukuran file melebihi 2MB');
    //   setPaymentFile(null);
    //   return;
    // }

    // Validate file type
    // const validTypes = ['image/jpeg', 'image/jpg', 'application/pdf'];
    // if (!validTypes.includes(file.type)) {
    //   toast.error('Format file harus JPG, JPEG, atau PDF');
    //   setPaymentFile(null);
    //   return;
    // }

  //   setFileError('');
  //   setPaymentFile(file);
  // };


  const [documentFiles, setDocumentFiles] = useState<Record<string, File>>({});

const handleDocumentFileChange = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  setDocumentFiles((prev) => ({ ...prev, [key]: file }));
};


  
  const handleDelete = async (reason: string) => {
    if (!selectedCustomer) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    try {
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/customer/delete/${selectedCustomer.id}`, {
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
        await notifyResponseError(response, 'Customer gagal dihapus');
        return;
      }

      fetchCustomers();
      notifySuccess('Customer berhasil dihapus.');
      setSelectedCustomer(null);
    } catch (error) {
      console.error('Error deleting customer:', error);
      notifyError(error, 'Customer gagal dihapus');
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const searchLower = searchTerm.toLowerCase();
    return (
      customer.name.toLowerCase().includes(searchLower) ||
      customer.email.toLowerCase().includes(searchLower) ||
      customer.whatsapp.includes(searchTerm)
    );
  });

  const handleSaveEdit = async () => {
  if (!editedCustomer || !selectedCustomer) return;

  setIsSavingEdit(true);
  try {
    const formData = new FormData();

    // ✅ Data Text Biasa
    formData.append('name', editedCustomer.name);
    formData.append('email', editedCustomer.email);
    formData.append('whatsapp', editedCustomer.whatsapp);
    formData.append('identity_type', editedCustomer.identity_type);
    formData.append('address', editedCustomer.address);
    formData.append('company_address', editedCustomer.company_address || '');

    // ✅ Data Dokumen Upload
    Object.entries(documentFiles).forEach(([key, file]) => {
      formData.append(key, file);
    });

    // ✅ Info User
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    formData.append('user_id', user?.id);
    formData.append('username', user?.username);

    // ✅ PUT ke API
    const response = await fetch(`${API_BASE_URL}/customer/${selectedCustomer.id}`, {
      method: 'PUT',
      body: formData,
    });

    if (!response.ok) {
      await notifyResponseError(response, 'Customer gagal diperbarui');
      return;
    }

    notifySuccess('Customer berhasil diperbarui.');

    // ✅ Refresh data dan close modal
    await fetchCustomers();

    const updated = await fetch(`${API_BASE_URL}/customer/${selectedCustomer.id}`);
    if (updated.ok) {
      const updatedCustomer = await updated.json();
      setSelectedCustomer({
        ...updatedCustomer,
        documents: updatedCustomer.documents || {},
        payment_proof: updatedCustomer.payment_proof || {},
      });
      fetchHistoryLogs(updatedCustomer.id);
    }

    setShowEditModal(false);
    setEditedCustomer(null);
    setDocumentFiles({});

  } catch (error) {
    console.error('Error updating customer:', error);
    notifyError(error, 'Customer gagal diperbarui');
  } finally {
    setIsSavingEdit(false);
  }
};

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditedCustomer(null);
    setDocumentFiles({});
    if (selectedCustomer?.id) fetchHistoryLogs(selectedCustomer.id);
  };

  const closeDetailModal = () => {
    setSelectedCustomer(null);
    setModalMode(null);
    setHistoryLogs([]);
    setHistoryPage(1);
  };


  const formatIdentityType = (type: string) => {
    switch (type) {
      case 'married': return 'Menikah';
      case 'single': return 'Single';
      case 'corporate': return 'Perusahaan';
      case 'foreigner': return 'WNA';
      // case 'reorder': return 'Re-Order';
      default: return type;
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

  // const formatDurasiPinjam = (rangeRent: number | undefined, rentalDuration: string) => {
  //   if (!rangeRent) return '-';
  //   const satuan = rentalDuration === 'daily' ? 'Hari' : rentalDuration === 'monthly' ? 'Bulan' : 'Unit';
  //   return `${rangeRent} ${satuan}`;
  // };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'border-blue-500';
      case 'UPDATE': return 'border-orange-500';
      case 'DELETE': return 'border-red-500';
      default: return 'border-gray-500';
    }
  };

  const getActionText = (action: string) => {
    switch (action) {
      case 'CREATE': return 'Data dibuat';
      case 'UPDATE': return 'Data diperbarui';
      case 'DELETE': return 'Data dihapus';
      default: return action;
    }
  };

  const {
    page: currentPage,
    setPage: setCurrentPage,
    totalPages,
    pageItems: paginatedCustomers,
    startIndex,
  } = usePagination(filteredCustomers, itemsPerPage, searchTerm);

  useEffect(() => {
    if (!initialReorderCustomerId || loading) return;
    const target = customers.find((c) => c.id === initialReorderCustomerId);
    if (target) {
      setSelectedCustomer(target);
      setModalMode('reorder');
    } else {
      toast.error('Customer tidak ditemukan di Database Customer. Mungkin sudah dihapus.');
    }
    onInitialReorderHandled?.();
  }, [initialReorderCustomerId, loading, customers, onInitialReorderHandled]);

    useEffect(() => {
    if (selectedCustomer?.payment_proof) {
      console.log('FILE PROOF:', selectedCustomer.payment_proof);
    }
  }, [selectedCustomer]);
 
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-selection-safe">Database Customer</h2>
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
        <ScrollableTable label="Tabel database customer">
          <table className="min-w-full bg-white">
            <thead className={TABLE_HEAD_CLASS}>
              <tr>
                <Th>#</Th>
                <Th>Nama</Th>
                <Th>Email</Th>
                <Th>Whatsapp</Th>
                <Th>Tipe Identitas</Th>
                <Th>Terakhir Diubah</Th>
                <Th align="right">Transaksi</Th>
                <Th>Aksi</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedCustomers.length === 0 && (
                <TableMessageRow colSpan={8}>
                  {searchTerm.trim()
                    ? `Tidak ada customer yang cocok dengan "${searchTerm.trim()}".`
                    : 'Belum ada data customer. Customer baru muncul di sini setelah booking pertama disimpan.'}
                </TableMessageRow>
              )}
              {paginatedCustomers.map((customer, idx) => {
                const transactionCount = transactionList.filter((trx) => {
                const trxKey = `${trx.email?.toLowerCase().trim()}|${trx.identity_type?.toLowerCase().trim()}`;
                const custKey = `${customer.email?.toLowerCase().trim()}|${customer.identity_type?.toLowerCase().trim()}`;
                return trxKey === custKey;
              }).length;
                
              return (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 tabular-nums">
                    {startIndex + idx + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {customer.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {customer.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {customer.whatsapp}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatIdentityType(customer.identity_type)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDateTime(customer.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <button
                      type="button"
                      onClick={() => handleShowTransactions(customer)}
                      aria-label={`Lihat ${transactionCount} transaksi ${customer.name}`}
                      className="font-bold tabular-nums text-gray-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 rounded text-selection-safe"
                    >
                      {transactionCount}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setModalMode('reorder');
                        }}
                        className="text-green-500 hover:text-green-600 transform hover:scale-110 transition duration-150 "
                        title="Reorder"
                      >
                        <Repeat size={20} />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setModalMode('detail');
                          fetchHistoryLogs(customer.id);
                          setHistoryPage(1);
                        }}
                        className="text-orange-500 hover:text-orange-600 transform hover:scale-110 transition duration-150"
                        title="Lihat Detail"
                      >
                        <Eye size={20} />
                      </button>
                      <button
                        onClick={() => {
                        setModalMode(null); // ❌ Tutup modal detail dulu
                        setShowEditModal(true); // ✅ Langsung buka modal edit
                        setEditedCustomer({ ...customer }); // Prefill data
                        setSelectedCustomer(customer);     // Untuk gambar prefill
                      }}

                        className="text-blue-500 hover:text-blue-600 transform hover:scale-110 transition duration-150"
                        title="Edit"
                      >
                        <Edit2 size={20} />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setShowDeleteModal(true);
                        }}
                        className="text-red-500 hover:text-red-600 transform hover:scale-110 transition duration-150"
                        title="Hapus"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
              })}
            
              
            </tbody>
          </table>
        </ScrollableTable>
      )}
      {!loading && (
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          totalItems={filteredCustomers.length}
          pageCount={paginatedCustomers.length}
          startIndex={startIndex}
          onPageChange={setCurrentPage}
          itemLabel="customer"
        />
      )}

      {/* Customer Detail Modal */}
      {selectedCustomer && (modalMode === 'detail' || modalMode === 'reorder') && (
        <Modal
          open
          onClose={closeDetailModal}
          title={modalMode === 'reorder' ? 'Reorder Customer' : 'Detail Customer'}
          size="xl"
          footer={
            modalMode === 'reorder' ? (
              <>
                <ModalButton
                  onClick={() => {
                    setModalMode(null);
                    setShowEditModal(true);
                    setEditedCustomer({ ...selectedCustomer });
                  }}
                >
                  Edit
                </ModalButton>
                <ModalButton
                  variant="primary"
                  onClick={() => {
                    setModalMode(null);
                    setShowReorderForm(true);
                  }}
                >
                  Lanjutkan Order
                </ModalButton>
              </>
            ) : undefined
          }
        >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-semibold mb-4 text-selection-safe">Informasi Customer</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Tanggal Dibuat</p>
                        <p className="font-medium text-selection-safe">{formatDate(selectedCustomer.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Dibuat Oleh</p>
                        <p className="font-medium text-selection-safe">{selectedCustomer.created_by || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Diedit Oleh</p>
                        <p className="font-medium text-selection-safe">{selectedCustomer.updated_by || '-'}</p>
                      </div>
                    </div>
                  </div>

                  

                  {/* Document Preview Section */}
                  {selectedCustomer?.documents && (
                  <div>
                    <h4 className="text-lg font-semibold mb-4">Dokumen</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {getDocumentsToShowByIdentityType(selectedCustomer.identity_type)
                        .filter((key) => selectedCustomer.documents[key])
                        .map((key) => {
                          const value = selectedCustomer.documents[key];
                          return (
                            <div key={key} className="space-y-2">
                              <p className="text-sm text-gray-600">{documentLabels[key] || key}</p>
                              {isPdfFile(value) ? (
                                <PdfTile href={fileUrl(value)} label={documentLabels[key] || key} className="w-full h-32" />
                              ) : (
                              <div className="relative group">
                                <img
                                  src={fileUrl(value)}
                                  alt={key}
                                  className="w-full h-32 object-cover rounded-lg"
                                />
                                <a
                                  href={fileUrl(value)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
                                >
                                  <span className="text-white text-sm">Klik untuk memperbesar</span>
                                </a>
                              </div>
                              )}
                            </div>
                          );
                        })}

                      </div>
                    </div>
                  )}
                </div>



                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-semibold mb-4">Data Penyewa</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Nama</p>
                        <p className="font-medium text-selection-safe">{selectedCustomer.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Email</p>
                        <p className="font-medium text-selection-safe">{selectedCustomer.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Whatsapp</p>
                        <p className="font-medium text-selection-safe">{selectedCustomer.whatsapp}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Tipe Identitas</p>
                        <p className="font-medium text-selection-safe">{formatIdentityType(selectedCustomer.identity_type)}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold mb-4">Alamat</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Alamat Tempat Tinggal</p>
                      <p className="font-medium text-selection-safe">{selectedCustomer.address}</p>
                    </div>

                    {selectedCustomer.identity_type === 'corporate' && selectedCustomer.company_address && (
                      <div>
                        <p className="text-sm text-gray-600">Alamat Perusahaan</p>
                        <p className="font-medium text-selection-safe">{selectedCustomer.company_address}</p>
                      </div>
                    )}
                  </div>
                  </div>

                  {/* History Log Section */}
                  {modalMode !== 'reorder' && historyLogs.length > 0 && (
                    <div>
                      <h4 className="text-lg font-semibold mb-4 flex items-center text-selection-safe">
                        <Clock size={20} className="mr-2  " />
                        Riwayat Perubahan
                      </h4>
                      <div className="space-y-4">
                        {historyLogs.map((log) => (
                          <div key={log.id} className={`border-l-4 ${getActionColor(log.action)} pl-4 py-2`}>
                            <p className="text-sm text-gray-600  ">
                              {formatDateTime(log.created_at)}
                            </p>
                            <p
                            className={`font-medium ${
                              log.action === 'CREATE'
                                ? 'text-black-600'
                                : log.action === 'UPDATE'
                                ? 'text-black-600'
                                : 'text-gray-800'
                            }`} 
                          >
                            {getActionText(log.action)}
                            {log.changes?.updated_by && log.action === 'UPDATE' && (
                              <span className="ml-1 font-normal text-sm">
                                oleh <span className="font-medium">{log.changes.updated_by}</span>
                              </span>
                            )}
                            {log.changes?.created_by && log.action === 'CREATE' && (
                              <span className="ml-1 font-normal text-sm">
                                oleh <span className="font-medium">{log.changes.created_by}</span>
                              </span>
                            )}
                            {log.changes.reason && (
                              <span className="text-gray-500 ml-2">
                                - {log.changes.reason}
                              </span>
                            )}
                          </p>
                          </div>
                        ))}
                        {historyTotalPages > 1 && (
                          <div className="flex justify-end items-center space-x-2 mt-4">
                            <button
                              onClick={() => fetchHistoryLogs(selectedCustomer.id, historyPage - 1)}
                              disabled={historyPage === 1}
                              className="px-2 py-1 border rounded text-sm disabled:opacity-50"
                            >
                              &laquo;
                            </button>

                            {[...Array(historyTotalPages)].map((_, i) => (
                              <button
                                key={i}
                                onClick={() => fetchHistoryLogs(selectedCustomer.id, i + 1)}
                                className={`px-2 py-1 border rounded text-sm ${
                                  historyPage === i + 1 ? 'bg-orange-500 text-white' : ''
                                }`}
                              >
                                {i + 1}
                              </button>
                            ))}

                            <button
                              onClick={() => fetchHistoryLogs(selectedCustomer.id, historyPage + 1)}
                              disabled={historyPage === historyTotalPages}
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

                      {/* Edit Modal */}
                      {showEditModal && editedCustomer && (
                  <Modal
                    open
                    onClose={closeEditModal}
                    title="Edit Data Customer"
                    size="lg"
                    busy={isSavingEdit}
                    footer={
                      <>
                        <ModalButton onClick={closeEditModal} disabled={isSavingEdit}>Batal</ModalButton>
                        <ModalButton variant="primary" onClick={handleSaveEdit} busy={isSavingEdit} busyLabel="Menyimpan...">
                          Simpan
                        </ModalButton>
                      </>
                    }
                  >
                        <div className="space-y-4">
                          {/* Tipe Identitas */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Identitas</label>
                            <select
                              value={editedCustomer.identity_type}
                              onChange={(e) =>
                                setEditedCustomer((prev) =>
                                  prev ? { ...prev, identity_type: e.target.value } : prev
                                )
                              }
                              className="w-full border border-gray-300 rounded-lg p-2 text-selection-safe"
                            >
                              <option value="single">Single</option>
                              <option value="married">Menikah</option>
                              <option value="corporate">Perusahaan</option>
                              <option value="foreigner">WNA</option>
                            </select>
                          </div>

                          {/* Nama */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
                            <input
                              type="text"
                              value={editedCustomer.name}
                              onChange={(e) =>
                                setEditedCustomer((prev) =>
                                  prev ? { ...prev, name: e.target.value } : prev
                                )
                              }
                              className="w-full border border-gray-300 rounded-lg p-2 text-selection-safe"
                            />
                          </div>

                          {/* Email */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input
                              type="email"
                              value={editedCustomer.email}
                              onChange={(e) =>
                                setEditedCustomer((prev) =>
                                  prev ? { ...prev, email: e.target.value } : prev
                                )
                              }
                              className="w-full border border-gray-300 rounded-lg p-2 text-selection-safe"
                            />
                          </div>

                          {/* Whatsapp */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Whatsapp</label>
                            <PhoneInput
                              country="id" // Indonesia
                              onlyCountries={['id']} // hanya Indonesia
                              disableDropdown={true} // tidak bisa ubah negara
                              enableAreaCodes={true} // area code Indonesia (seperti 21, 22, dst)
                              value={editedCustomer.whatsapp}
                              onChange={(phone: string) =>
                                setEditedCustomer((prev) =>
                                  prev ? { ...prev, whatsapp: phone } : prev
                                )
                              }
                              inputClass="w-full border border-gray-300 rounded-lg p-2 text-selection-safe"
                            />
                          </div>

                          {/* Alamat Tempat Tinggal */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Tempat Tinggal</label>
                            <input
                              type="text"
                              value={editedCustomer.address}
                              onChange={(e) =>
                                setEditedCustomer((prev) =>
                                  prev ? { ...prev, address: e.target.value } : prev
                                )
                              }
                              className="w-full border border-gray-300 rounded-lg p-2 text-selection-safe"
                            />
                          </div>  


                          {/* Alamat Tempat Tinggal Perusushaan */}
                          {editedCustomer.identity_type === 'corporate' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Tempat Tinggal Perusushaan</label>
                            <input
                              type="text"
                              value={editedCustomer.company_address}
                              onChange={(e) =>
                                setEditedCustomer((prev) =>
                                  prev ? { ...prev, company_address: e.target.value } : prev
                                )
                              }
                              className="w-full border border-gray-300 rounded-lg p-2 text-selection-safe"
                            />
                          </div>
                        )}


                          <div className="mt-6 space-y-4">
                  <h4 className="text-lg font-semibold mb-2 text-selection-safe">Upload Dokumen</h4>

                  {(() => {
                  const { identity_type } = editedCustomer;
                  let documentsToShow: { label: string; key: string }[] = [];

                  if (identity_type === 'single') {
                    documentsToShow = [
                      { label: 'Upload KTP Anda', key: 'ktpFile' },
                      { label: 'Upload SIM A Anda', key: 'simFile' },
                      { label: 'Upload KTP Orang Tua Anda', key: 'parentKtpFile' },
                      { label: 'Upload KK Anda', key: 'kkFile' },
                      { label: 'Upload ID Card Kerja / Kartu Mahasiswa / Surat Usaha Anda', key: 'workOrStudentIdFile' },
                      { label: 'Upload Foto Tempat Tinggal (Tampak Depan) Anda', key: 'housePhotoFile' },
                      { label: 'Upload Tiket Transportasi Anda', key: 'ticketFile' },
                      { label: 'Upload Tiket Booking Hotel Anda', key: 'ticketHotelFile' },
                      { label: 'Upload Verification Video Call (Screenshot Tampak Wajah Customer)', key: 'verificationVideoFile' },
                      { label: 'Persyaratan Optional', key: 'optionalRequirementFile' },
                    ];
                  } else if (identity_type === 'married') {
                    documentsToShow = [
                      { label: 'Upload KTP Anda', key: 'ktpFile' },
                      { label: 'Upload SIM A Anda', key: 'simFile' },
                      { label: 'Upload KTP Suami / Istri', key: 'spouseKtpFile' },
                      { label: 'Upload KK Anda', key: 'kkFile' },
                      { label: 'Upload ID Card Kerja / Surat Usaha Anda', key: 'workIdFile' },
                      { label: 'Upload Foto Tempat Tinggal (Tampak Depan) Anda', key: 'housePhotoFile' },
                      { label: 'Upload Tiket Transportasi Anda', key: 'ticketFile' },
                      { label: 'Upload Tiket Booking Hotel Anda', key: 'ticketHotelFile' },
                      { label: 'Upload Verification Video Call (Screenshot Tampak Wajah Customer)', key: 'verificationVideoFile' },
                      { label: 'Persyaratan Optional', key: 'optionalRequirementFile' },  
                    ];
                  } else if (identity_type === 'corporate') {
                    documentsToShow = [
                      { label: 'Upload KTP Anda', key: 'ktpFile' },
                      { label: 'Upload SIM A Anda', key: 'simFile' },
                      { label: 'Upload KTP Pribadi (Penanggung Jawab)', key: 'picKtpFile' },
                      { label: 'Upload KK (Penanggung Jawab)', key: 'picKkFile' },
                      { label: 'Upload NPWP Perusahaan', key: 'companyNpwpFile' },
                      { label: 'Upload SIUP Perusahaan', key: 'companySiupFile' },
                      { label: 'Upload NIB Perusahaan', key: 'companyNibFile' },
                      { label: 'Upload Foto Perusahaan (Tampak Depan)', key: 'companyPhotoFile' },
                      { label: 'Upload Tiket Transportasi Anda', key: 'ticketFile' },
                      { label: 'Upload Tiket Booking Hotel Anda', key: 'ticketHotelFile' },
                      { label: 'Upload Verification Video Call (Screenshot Tampak Wajah Customer)', key: 'verificationVideoFile' },
                      { label: 'Persyaratan Optional', key: 'optionalRequirementFile' },
                    ];
                  } else if (identity_type === 'foreigner') {
                    documentsToShow = [
                      { label: 'Upload Kartu Identitas Diri Anda', key: 'personalIdFile' },
                      { label: 'Upload Passport Anda', key: 'passportFile' },
                      { label: 'Upload SIM A Anda', key: 'simFile' },
                      { label: 'Upload KITAS / KITAP Anda', key: 'kitasKitapFile' },
                      { label: 'Upload Dokumen Menikah Anda', key: 'marriageDocFile' },
                      { label: 'Upload ID Card Kerja / Surat Usaha Anda', key: 'workIdFile' },
                      { label: 'Upload Visa Anda', key: 'visaFile' },
                      { label: 'Upload Foto Tempat Tinggal (Tampak Depan)', key: 'housePhotoFile' },
                      { label: 'Upload Tiket Transportasi Anda', key: 'ticketFile' },
                      { label: 'Upload Tiket Booking Hotel Anda', key: 'ticketHotelFile' },
                      { label: 'Upload Verification Video Call (Screenshot Tampak Wajah Customer)', key: 'verificationVideoFile' },
                      { label: 'Persyaratan Optional', key: 'optionalRequirementFile' },
                    ];
                  }

                  return documentsToShow.map(({ label, key }) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1 ">{label}</label>

                      {/* Preview jika ada dokumen sebelumnya */}
                      {selectedCustomer?.documents?.[key] && isPdfFile(selectedCustomer.documents[key]) && (
                        <PdfTile href={fileUrl(selectedCustomer.documents[key])} label={label} className="mb-2 w-40 h-28" />
                      )}
                      {selectedCustomer?.documents?.[key] && !isPdfFile(selectedCustomer.documents[key]) && (
                        <div className="relative group mb-2 w-40 h-28 rounded-lg overflow-hidden shadow">
                          <img
                            src={fileUrl(selectedCustomer.documents[key])}
                            alt={label}
                            className="w-full h-full object-cover "
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage(fileUrl(selectedCustomer.documents[key]) ?? null)
                            }
                            className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-200"
                          >
                            <span className="text-white text-sm">Klik untuk memperbesar</span>
                          </button>
                        </div>
                      )}

                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        onChange={(e) => handleDocumentFileChange(key, e)}
                        className="w-full border border-gray-300 rounded-lg p-2 text-selection-safe"
                      />
                    </div>
                  ));
                })()}
                </div>
              </div>

              <ImageDialog src={previewImage} alt="Dokumen customer" onClose={() => setPreviewImage(null)} />
        </Modal>
      )}

      <ConfirmDialog
        open={showDeleteModal && !!selectedCustomer}
        onClose={() => setShowDeleteModal(false)}
        title="Hapus customer?"
        description={
          <>
            Customer <span className="font-semibold text-gray-900">{selectedCustomer?.name}</span> ({selectedCustomer?.email})
            akan dihapus dari daftar. Alasannya tercatat di riwayat perubahan.
          </>
        }
        confirmLabel="Hapus customer"
        reason={{ label: 'Alasan penghapusan', placeholder: 'Contoh: data ganda dengan customer lain' }}
        onConfirm={handleDelete}
      />

        {showReorderForm && selectedCustomer && (
          <CustomerBookingForm
            initialData={selectedCustomer}
            savedData={reorderFormData}
            // onChange={(data) => setReorderFormData(data)} 
            onCancel={() => {
              setShowReorderForm(false);
              setSelectedCustomer(null);
              setReorderFormData(null);
            }}
            onSubmit={(data) => {
              // kirim data ke API
              setReorderFormData(data); 
              setShowReorderForm(false);
              setShowTermsModal(true); 
              // setSelectedCustomer(null);
            }}
          />
        )}

        {/* Closing a later reorder step goes back to the form, so the data typed there survives. */}
        <Modal
          open={showTermsModal}
          onClose={() => {
            setShowTermsModal(false);
            setShowReorderForm(true);
          }}
          title="Reorder: syarat dan ketentuan"
          size="lg"
          bodyClassName="p-0 sm:p-0"
        >
              <TermsAndConditions
                onAccept={() => {
                  setShowTermsModal(false);
                  setShowConfirmationModal(true);
                  // kirim ke API atau lanjut
                }}
                onBack={() => {
                  setShowTermsModal(false);
                  setShowReorderForm(true);
                  // if (!selectedCustomer) setSelectedCustomer(editedCustomer);
                }}
              />
        </Modal>

        {showConfirmationModal && reorderFormData && selectedCustomer && (
          <Modal
            open
            onClose={() => {
              setShowConfirmationModal(false);
              setShowReorderForm(true);
            }}
            title="Reorder: konfirmasi booking"
            size="xl"
            busy={isReorderSubmitting}
            bodyClassName="p-0 sm:p-0"
          >
              <BookingConfirmation
                formData={reorderFormData}
                identityData={selectedCustomer}
                onBack={() => {
                  setShowConfirmationModal(false);
                  setShowReorderForm(true);
                }}
                isSubmitting={isReorderSubmitting}
                onSubmit={async () => {
                if (reorderLock.current) return;
                reorderLock.current = true;
                setIsReorderSubmitting(true);
                try {
                  const totals = computeTotals({
                    rental_cost: reorderFormData.rentalCost,
                    deposit: reorderFormData.deposit,
                    discount: reorderFormData.discount,
                    needs_trip: reorderFormData.needsTrip,
                    needs_driver: reorderFormData.needsDriver,
                    needs_delivery: reorderFormData.needsDelivery,
                    needs_pickup: reorderFormData.needsPickup,
                    trip_fee: Number.isFinite(reorderFormData.tripFee) ? reorderFormData.tripFee : 0,
                    driver_fee: Number.isFinite(reorderFormData.driverFee) ? reorderFormData.driverFee : 0,
                    delivery_fee: Number.isFinite(reorderFormData.deliveryFee) ? reorderFormData.deliveryFee : 0,
                    pickup_fee: Number.isFinite(reorderFormData.pickupFee) ? reorderFormData.pickupFee : 0,
                  });

                  // Spec 3.4: customer_id is required. grand_total and booking_code come from the server.
                  const transactionPayload = {
                    customer_id: selectedCustomer.id,

                    name: reorderFormData.name,
                    address: selectedCustomer.address,
                    company_address: selectedCustomer.company_address,
                    email: reorderFormData.email,
                    whatsapp: reorderFormData.whatsapp,
                    identity_type: reorderFormData.identityType,

                    car_type: reorderFormData.carType,
                    rental_duration: reorderFormData.rentalDuration,
                    range_rent: reorderFormData.rangeRent,
                    start_date: reorderFormData.startDate,
                    end_date: reorderFormData.endDate,
                    start_time: reorderFormData.startTime,

                    needs_trip: reorderFormData.needsTrip,
                    needs_driver: reorderFormData.needsDriver,
                    needs_delivery: reorderFormData.needsDelivery,
                    needs_pickup: reorderFormData.needsPickup,

                    rental_cost: totals.rental_cost,
                    deposit: totals.deposit,
                    discount: totals.discount_applied,
                    trip_fee: totals.trip_fee,
                    driver_fee: totals.driver_fee,
                    delivery_fee: totals.delivery_fee,
                    pickup_fee: totals.pickup_fee,

                    purpose: reorderFormData.purpose,
                  };

                  const trxRes = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/fact_transaction`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify(transactionPayload),
                  });

                  if (!trxRes.ok) {
                    // 401 and 403 already get their own toast from the session guard.
                    if (!isGuardedStatus(trxRes.status)) {
                      toast.error(await readServerError(trxRes, 'Reorder gagal disimpan. Coba lagi.'));
                    }
                    return;
                  }

                  const saved: { booking_code?: string } = await trxRes.json().catch(() => ({}));
                  setShowConfirmationModal(false);
                  setSelectedCustomer(null);
                  setReorderFormData(null);
                  toast.success(
                    saved.booking_code
                      ? `Reorder ${saved.booking_code} tersimpan.`
                      : 'Reorder tersimpan. Kode booking ada di menu Transaksi.',
                  );
                } catch (err) {
                  console.error("Error saat submit reorder:", err);
                  toast.error('Reorder belum tersimpan. Periksa koneksi ke server lalu coba lagi.');
                } finally {
                  reorderLock.current = false;
                  setIsReorderSubmitting(false);
                }
              }}
              />
          </Modal>
        )}

        <Modal
          open={showTransactionModal}
          onClose={() => setShowTransactionModal(false)}
          title="Daftar Transaksi Customer"
          size="lg"
        >
          {selectedTransactionList.length === 0 ? (
            <p className="text-sm text-gray-600">Customer ini belum punya transaksi.</p>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm text-left text-gray-700">
              <thead>
                <tr className="border-b">
                  <th className="py-2">Kode Booking</th>
                  <th className="py-2">Tipe Mobil</th>
                  <th className="py-2">Tipe Sewa</th>
                  <th className="py-2">Tanggal Transaksi</th>
                </tr>
              </thead>
              <tbody>
                {selectedTransactionList.map((trx, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="py-2 font-bold">{trx.booking_code}</td>
                    <td className="py-2">{trx.car_type}</td>
                    <td className="py-2">{trx.rental_duration}</td>
                    <td className="py-2">{formatDateTime(trx.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </Modal>

      </div>
  );
  };

export default CustomerDatabase;