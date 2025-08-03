import React, { useState, useEffect } from 'react';
// import { supabase } from '../lib/supabaseClient';
import { Eye, Edit2, Search, Clock, Trash2, AlertCircle, Repeat } from 'lucide-react';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import toast from 'react-hot-toast';
import CustomerBookingForm from './CustomerBookingForm';
import TermsAndConditions from './TermsAndConditions';
import BookingConfirmation from './BookingConfirmation';
import { getDocumentsToShowByIdentityType } from '../utils/documentutils';





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

const CustomerDatabase: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [editedCustomer, setEditedCustomer] = useState<Customer | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

  const [modalMode, setModalMode] = useState<'detail' | 'reorder' | null>(null); 
  const [showReorderForm, setShowReorderForm] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [reorderFormData, setReorderFormData] = useState<any>(null);

  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [bookingCode, setBookingCode] = useState('');
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


  const generateBookingCode = () => {
  const date = new Date();
  const uniqueId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `ARMJ${year}${month}${day}${uniqueId}`;
};

  const [documentFiles, setDocumentFiles] = useState<Record<string, File>>({});

const handleDocumentFileChange = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  setDocumentFiles((prev) => ({ ...prev, [key]: file }));
};


  
  const handleDelete = async () => {
    if (!selectedCustomer || !deleteReason.trim()) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}'); // ✅ Tambahin baris ini

    try {
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/customer/delete/${selectedCustomer.id}`, {
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
  
      if (!response.ok) throw new Error('Gagal menghapus data');
  
      // Refresh data
      fetchCustomers();
      toast.success('Data customer berhasil dihapus.');
      setShowDeleteModal(false);
      setDeleteReason('');
      setSelectedCustomer(null);
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error('Terjadi kesalahan saat menghapus data.');
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

    if (!response.ok) throw new Error('Gagal menyimpan data');

    toast.success('Data customer berhasil diperbarui.');

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
    toast.error('Terjadi kesalahan saat menyimpan data.');
  }
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

  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);

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
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nama
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Whatsapp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipe Identitas
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Terakhir Diubah
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transaksi
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCustomers.map((customer) => {
                const transactionCount = transactionList.filter((trx) => {
                const trxKey = `${trx.email?.toLowerCase().trim()}|${trx.identity_type?.toLowerCase().trim()}`;
                const custKey = `${customer.email?.toLowerCase().trim()}|${customer.identity_type?.toLowerCase().trim()}`;
                return trxKey === custKey;
              }).length;
                
              return (
                <tr key={customer.id} className="hover:bg-gray-50">
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
                  <td
                    className="px-6 py-4 whitespace-nowrap text-sm text-black-600 font-bold hover:underline cursor-pointer text-selection-safe"
                    onClick={() => handleShowTransactions(customer)}
                  >
                    {transactionCount}
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
        </div>
      )}
      {/* ✅ Pagination */}
<div className="flex justify-between items-center mt-4">
  <p className="text-sm text-gray-600">
    Menampilkan {paginatedCustomers.length} dari {filteredCustomers.length} data
  </p>
  <div className="flex space-x-1 flex-wrap">
    {/* Tombol Sebelumnya */}
    <button
      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
      disabled={currentPage === 1}
      className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
    >
      &laquo;
    </button>

    {/* Tombol Halaman */}
    {(() => {
      const pages = [];
      const current = currentPage;
      const total = totalPages;

      const showLeftEllipsis = current > 6;
      const showRightEllipsis = current < total - 5;

      const startPage = showLeftEllipsis ? Math.max(current - 4, 2) : 2;
      const endPage = showRightEllipsis ? Math.min(current + 4, total - 1) : total - 1;

      // Page 1
      pages.push(
        <button
          key={1}
          onClick={() => setCurrentPage(1)}
          className={`px-3 py-1 border rounded ${current === 1 ? 'bg-orange-500 text-white' : 'hover:bg-gray-100'}`}
        >
          1
        </button>
      );

      // Ellipsis kiri
      if (showLeftEllipsis) {
        pages.push(<span key="left-ellipsis" className="px-2">...</span>);
      }

      // Middle page range
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

      // Ellipsis kanan
      if (showRightEllipsis) {
        pages.push(<span key="right-ellipsis" className="px-2">...</span>);
      }

      // Page terakhir
      if (total > 1) {
        pages.push(
          <button
            key={total}
            onClick={() => setCurrentPage(total)}
            className={`px-3 py-1 border rounded ${current === total ? 'bg-orange-500 text-white' : 'hover:bg-gray-100'}`}
          >
            {total}
          </button>
        );
      }

      return pages;
    })()}

    {/* Tombol Selanjutnya */}
    <button
      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
      disabled={currentPage === totalPages}
      className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
    >
      &raquo;
    </button>
  </div>
</div>

      {/* Customer Detail Modal */}
      {selectedCustomer && (modalMode === 'detail' || modalMode === 'reorder') && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-semibold text-selection-safe">
                  {modalMode === 'reorder' ? 'Reorder Customer' : 'Detail Customer'}
                </h3>
                <button
                  onClick={() => {
                    if (selectedCustomer?.id) {
                      fetchHistoryLogs(selectedCustomer.id); // ✅ fetch ulang log
                    }
                    setSelectedCustomer(null);
                    setHistoryLogs([]);
                    setHistoryPage(1);;
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

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
                              <div className="relative group">
                                <img
                                  src={`${import.meta.env.VITE_API_PUBLIC_URL || ""}/uploads/${value}`}
                                  alt={key}
                                  className="w-full h-32 object-cover rounded-lg"
                                />
                                <a
                                  href={`${import.meta.env.VITE_API_PUBLIC_URL || ""}/uploads/${value}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
                                >
                                  <span className="text-white text-sm">Klik untuk memperbesar</span>
                                </a>
                              </div>
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

                  {modalMode === 'reorder' && (
                    <div className="w-full mt-8 border-t pt-4 flex justify-end">
                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          setModalMode(null);
                          setShowEditModal(true);
                          setEditedCustomer({ ...selectedCustomer! });
                          setSelectedCustomer(selectedCustomer);
                        }}
                        className="px-4 py-2 rounded bg-blue-500 text-white"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setModalMode(null);
                          setShowReorderForm(true);
                          setSelectedCustomer(selectedCustomer);
                        }}
                        className="px-4 py-2 rounded bg-orange-500 text-white"
                      >
                        Lanjutkan Order
                      </button>
                    </div>
                  </div>
                  )}


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
            </div>
          </div>
        </div>
      )}

                      {/* Edit Modal */}
                      {showEditModal && editedCustomer && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                      <div className="p-6">
                        <div className="flex justify-between items-center mb-6">
                          <h3 className="text-2xl font-semibold text-selection-safe">Edit Data Customer</h3>
                          <button
                            onClick={() => {
                              setShowEditModal(false);
                              setEditedCustomer(null);
                            }}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            ✕
                          </button>
                        </div>

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
                      {selectedCustomer?.documents?.[key] && (
                        <div className="relative group mb-2 w-40 h-28 rounded-lg overflow-hidden shadow">
                          <img
                            src={`${import.meta.env.VITE_API_PUBLIC_URL || ''}/uploads/${selectedCustomer.documents[key]}`}
                            alt={label}
                            className="w-full h-full object-cover "
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage(`${import.meta.env.VITE_API_PUBLIC_URL || ''}/uploads/${selectedCustomer.documents[key]}`)
                            }
                            className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-200"
                          >
                            <span className="text-white text-sm">Klik untuk memperbesar</span>
                          </button>
                        </div>
                      )}

                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => handleDocumentFileChange(key, e)}
                        className="w-full border border-gray-300 rounded-lg p-2 text-selection-safe"
                      />
                    </div>
                  ));
                })()}
                </div>



                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      if (selectedCustomer?.id) fetchHistoryLogs(selectedCustomer.id);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6">
              <div className="flex items-center mb-6 text-red-600">
                <AlertCircle size={24} className="mr-2" />
                <h3 className="text-xl font-semibold">Konfirmasi Penghapusan</h3>
              </div>

              <div className="space-y-4">
                <p className="text-gray-600">
                  Anda akan menghapus data customer dengan nama {' '}
                  <span className="font-semibold">{selectedCustomer.name}</span>
                  {' '} dan email:{' '}
                  <span className="font-semibold">{selectedCustomer.email}</span>
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
                    placeholder="Masukkan alasan penghapusan data customer..."
                    required
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeleteReason('');
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleDelete}
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



        {previewImage && (
          <div
            className="fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center"
            onClick={() => setPreviewImage(null)} // klik luar menutup
          >
            <div
              className="relative max-w-3xl w-full px-4"
              onClick={(e) => e.stopPropagation()} // cegah close saat klik gambar
            >
              <img
                src={previewImage}
                alt="Preview"
                className="w-full rounded-lg shadow-lg"
              />
            </div>
          </div>
        )}

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

        {showTermsModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
            <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <TermsAndConditions
                onAccept={() => {
                  setShowTermsModal(false);
                  setBookingCode(generateBookingCode());
                  setShowConfirmationModal(true);
                  // kirim ke API atau lanjut
                }}
                onBack={() => {
                  setShowTermsModal(false);
                  setShowReorderForm(true);
                  // if (!selectedCustomer) setSelectedCustomer(editedCustomer);
                }}
              />
            </div>
          </div>
        )}


        {showConfirmationModal && reorderFormData && selectedCustomer && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
              <BookingConfirmation
                formData={reorderFormData}
                identityData={selectedCustomer}
                bookingCode={bookingCode}
                onBack={() => {
                  setShowConfirmationModal(false);
                  setShowReorderForm(true);
                }}
                onSubmit={async () => {
                try {
                  const user = JSON.parse(localStorage.getItem("user") || "{}");

                  console.log("🔥 ReorderFormData:", reorderFormData); // ⬅️ TARUH DI SINI
                  console.log("💰 Grand Total:", reorderFormData.grandTotal);

                  const transactionPayload = {
                    ...reorderFormData,
                    customer_id: selectedCustomer.id,
                    booking_code: bookingCode,
                    username: user.username,
                    user_id: user.id,
                    created_at: new Date().toISOString(),

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

                    grand_total: reorderFormData.grandTotal,
                    deposit: reorderFormData.deposit,
                    discount: reorderFormData.discount,
                    trip_fee: reorderFormData.tripFee,
                    driver_fee: reorderFormData.driverFee,
                    delivery_fee: reorderFormData.deliveryFee,
                    pickup_fee: reorderFormData.pickupFee,

                    purpose: reorderFormData.purpose,
                  };

                  // 1. Kirim ke fact_transaction
                  const trxRes = await fetch(`${import.meta.env.VITE_API_URL}/fact_transaction`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify(transactionPayload),
                  });

                  if (!trxRes.ok) throw new Error("Gagal simpan fact_transaction");


                  // ✅ Berhasil semua
                  setShowConfirmationModal(false);
                  setSelectedCustomer(null);
                  toast.success("Booking berhasil dikonfirmasi!");
                } catch (err) {
                  console.error("Error saat submit:", err);
                  toast.error("Gagal menyimpan booking!");
                }
              }}
              />
            </div>
          </div>
        )}


        {showTransactionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="relative bg-white p-6 rounded-lg shadow-lg max-h-[80vh] w-full max-w-2xl overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Daftar Transaksi Customer</h2>

            {/* Tombol Close */}
            <button
              className="absolute top-4 right-6 text-gray-500 text-xl"
              onClick={() => setShowTransactionModal(false)}
            >
              ✕
            </button>

            <table className="w-full text-sm text-left text-gray-700">
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
        </div>
      )}

      </div>
  );
  };

export default CustomerDatabase;