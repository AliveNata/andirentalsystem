import React, { useState,useEffect, useMemo, useRef, useCallback } from 'react';
import { CustomerForm, MarriedCustomerForm, SingleCustomerForm, CorporateCustomerForm, ForeignerCustomerForm, ReorderCustomerForm, CarRate, estimateBooking, readServerError } from '../types';
import { MarriedForm, SingleForm, CorporateForm, ForeignerForm, ReorderForm } from './IdentityForms';
import TermsAndConditions from './TermsAndConditions';
import BookingConfirmation, { PriceBreakdown } from './BookingConfirmation';
import CustomerDatabase from './CustomerDatabase';
import LoyaltyCustomer from './LoyaltyCustomer';
import TransactionDatabase from './TransactionDatabase';
import EmployeeManagement from './EmployeeManagement';
import CarManagement from './CarManagement';
import ActivityLog from './ActivityLog';
import WelcomeSummary from './WelcomeSummary';
import Setting from './Settings';
import numeral from 'numeral';
import Select from 'react-select';
import { toast } from 'react-hot-toast';
import ExistingCustomerNotice from './ExistingCustomerNotice';
import { useCustomerLookup } from '../lib/useCustomerLookup';
import { DESKTOP_QUERY, useMediaQuery } from '../lib/useMediaQuery';
import { MobileNavDrawer, SidebarNav, type DashboardSection } from './SidebarNav';



interface DashboardProps {
  // Desktop (lg and up) inline sidebar; below lg the menu is the drawer.
  isSidebarOpen: boolean;
  isMobileNavOpen: boolean;
  onMobileNavChange: (open: boolean) => void;
}

type IdentityData = {
  name: string;
  whatsapp: string;
  address: string;
  companyAddress?: string;
  [key: string]: any;
};

const deliveryOptions = [
  25000, 50000, 75000, 100000, 125000,
  150000, 175000, 200000, 225000, 250000,
  275000, 300000
];

const SERVICE_OPTIONS: { key: 'needsTrip' | 'needsDriver' | 'needsDelivery' | 'needsPickup'; label: string }[] = [
  { key: 'needsTrip', label: 'Biaya Luar Kota' },
  { key: 'needsDriver', label: 'Butuh Supir' },
  { key: 'needsDelivery', label: 'Butuh Antar' },
  { key: 'needsPickup', label: 'Butuh Jemput' },
];

const EMPTY_MARRIED: MarriedCustomerForm = {
  name: '',
  whatsapp: '',
  address: '',
  ktpFile: null,
  simFile: null,
  spouseKtpFile: null,
  kkFile: null,
  workIdFile: null,
  housePhotoFile: null,
  ticketFile: null,
  ticketHotelFile: null,
  verificationVideoFile: null,
  optionalRequirementFile: null
};

const EMPTY_SINGLE: SingleCustomerForm = {
  name: '',
  whatsapp: '',
  address: '',
  ktpFile: null,
  simFile: null,
  parentKtpFile: null,
  kkFile: null,
  workOrStudentIdFile: null,
  housePhotoFile: null,
  ticketFile: null,
  ticketHotelFile: null,
  verificationVideoFile: null,
  optionalRequirementFile: null
};

const EMPTY_CORPORATE: CorporateCustomerForm = {
  name: '',
  whatsapp: '',
  address: '',
  ktpFile: null,
  simFile: null,
  companyAddress: '',
  picKtpFile: null,
  picKkFile: null,
  companyNpwpFile: null,
  companySiupFile: null,
  companyNibFile: null,
  companyPhotoFile: null,
  ticketFile: null,
  ticketHotelFile: null,
  verificationVideoFile: null,
  optionalRequirementFile: null
};

const EMPTY_FOREIGNER: ForeignerCustomerForm = {
  name: '',
  whatsapp: '',
  address: '',
  passportFile: null,
  personalIdFile: null,
  simFile: null,
  kitasKitapFile: null,
  workIdFile: null,
  marriageDocFile: null,
  visaFile: null,
  housePhotoFile: null,
  ticketFile: null,
  ticketHotelFile: null,
  verificationVideoFile: null,
  optionalRequirementFile: null
};

const EMPTY_REORDER: ReorderCustomerForm = {
  name: '',
  whatsapp: '',
  address: '',
};

function Dashboard({ isSidebarOpen, isMobileNavOpen, onMobileNavChange }: DashboardProps) {
  const [activeSection, setActiveSection] = useState<DashboardSection>('welcome');
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const handleNavigate = (section: DashboardSection) => {
    setActiveSection(section);
    onMobileNavChange(false);
  };
  const [showIdentityForm, setShowIdentityForm] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showBookingConfirmation, setShowBookingConfirmation] = useState(false);
  const [carTypes, setCarTypes] = useState<{ 
        label: string; 
        value: string;
        }[]>([]);
  const [carRates, setCarRates] = useState<CarRate[]>([]);
  const [reorderCustomerId, setReorderCustomerId] = useState<string | null>(null);
  const [dismissedMatchKey, setDismissedMatchKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // State updates land after the next render, so a fast double click needs a synchronous lock.
  const submitLock = useRef(false);
  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    fetch(`${API_BASE_URL.replace(/\/$/, '')}/car-types`)
      .then(res => res.json())
      .then(data => setCarTypes(data))
      .catch(err => console.error('Error fetching car types:', err));
  }, []);

  useEffect(() => {
    fetch(`${API_BASE_URL.replace(/\/$/, '')}/car-rates`)
      .then(res => res.json())
      .then(data => setCarRates(data))
      .catch(err => console.error('Error fetching car rates:', err));
  }, []);  

  const [formData, setFormData] = useState<CustomerForm>({
    email: '',
    rentalDuration: '',
    rangeRent: 0,
    carType: '',
    deposit: 0,
    discount: 0,
    needsTrip: false,
    needsDriver: false,
    needsDelivery: false,
    needsPickup: false,
    startDate: '',
    startTime: '',
    endDate: '',
    purpose: '',
    identityType: 'single',
    tripFee: 0,
    deliveryFee: 0, 
    pickupFee: 0,
    driverFee: 0     
  });

  
// Validasi tanggal mulai tidak boleh kurang dari hari ini
useEffect(() => {
  if (!formData.startDate) return;

  const formDate = new Date(formData.startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (formDate < today) {
    toast.error('Tanggal mulai tidak boleh lebih kecil dari hari ini');
    setFormData(prev => ({ ...prev, startDate: '' }));
  }
}, [formData.startDate]);

// Validasi jam mulai hanya jika tanggal >= hari ini
useEffect(() => {
  if (!formData.startDate || formData.startTime === '') return;

  const formDate = new Date(formData.startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (formDate >= today) {
    const [hours, minutes] = formData.startTime.split(':').map(Number);
    const selectedTime = new Date();
    selectedTime.setHours(hours, minutes, 0, 0);

    const now = new Date();
    if (formDate.toDateString() === now.toDateString() && selectedTime < now) {
      toast.error('Jam mulai tidak boleh kurang dari waktu sekarang');
      setFormData(prev => ({ ...prev, startTime: '' }));
    }
  }
}, [formData.startTime, formData.startDate]);  

  

  const estimate = useMemo(() => estimateBooking(formData, carRates), [formData, carRates]);

  useEffect(() => {
    if (formData.startDate && formData.rangeRent && formData.rentalDuration) {
      const newEndDate = calculateEndDate(
        formData.startDate,
        Number(formData.rangeRent),
        formData.rentalDuration === 'daily' ? 'daily' : 'monthly'
      );
      setFormData((prev) => ({ ...prev, endDate: newEndDate }));
    }
  }, [formData.startDate, formData.rangeRent, formData.rentalDuration]);
  
  
    const calculateEndDate = (start: string, duration: number, type: 'daily' | 'monthly') => {
      const startDate = new Date(start);
      if (type === 'daily') {
        startDate.setDate(startDate.getDate() + duration);
      } else if (type === 'monthly') {
        startDate.setMonth(startDate.getMonth() + duration);
        startDate.setDate(startDate.getDate() - 1);
      }
      return startDate.toISOString().split('T')[0];
    };
    

  const [marriedFormData, setMarriedFormData] = useState<MarriedCustomerForm>(EMPTY_MARRIED);
  const [singleFormData, setSingleFormData] = useState<SingleCustomerForm>(EMPTY_SINGLE);
  const [corporateFormData, setCorporateFormData] = useState<CorporateCustomerForm>(EMPTY_CORPORATE);
  const [foreignerFormData, setForeignerFormData] = useState<ForeignerCustomerForm>(EMPTY_FOREIGNER);
  const [reorderFormData, setReorderFormData] = useState<ReorderCustomerForm>(EMPTY_REORDER);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowIdentityForm(true);
  };

  const handleIdentityFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowTerms(true);
  };

  // The server assigns the booking code when it saves the booking, so nothing is generated here.
  const handleTermsAccept = () => {
    setShowTerms(false);
    setShowBookingConfirmation(true);
  };

  const getCurrentIdentityData = () => {
    switch (formData.identityType) {
      case 'married':
        return marriedFormData;
      case 'single':
        return singleFormData;
      case 'corporate':
        return corporateFormData;
      case 'foreigner':
        return foreignerFormData;
      case 'reorder':
        return reorderFormData;
    }
  };

  const currentWhatsapp = String(getCurrentIdentityData()?.whatsapp ?? '');
  const lookupMatches = useCustomerLookup(formData.email, currentWhatsapp);
  const matchKey = lookupMatches.map((m) => m.id).sort().join(',');
  // "Tetap buat customer baru" hides this exact set of matches; a new match (e.g. from the WhatsApp field) shows it again.
  const showExistingNotice = lookupMatches.length > 0 && matchKey !== dismissedMatchKey;
  const existingNotice = showExistingNotice ? (
    <ExistingCustomerNotice
      matches={lookupMatches}
      email={formData.email}
      whatsapp={currentWhatsapp}
      onOpenReorder={(customerId) => {
        setReorderCustomerId(customerId);
        setActiveSection('database');
      }}
      onContinue={() => setDismissedMatchKey(matchKey)}
    />
  ) : null;
  const clearReorderRequest = useCallback(() => setReorderCustomerId(null), []);

const handleFinalSubmit = async () => {
  if (submitLock.current) return;

  if (!estimate) {
    toast.error('Total belum bisa dihitung. Periksa tipe mobil dan lama sewa.');
    return;
  }

  submitLock.current = true;
  setIsSubmitting(true);
  try {
    const identityData: IdentityData = getCurrentIdentityData();
    const { totals } = estimate;

    // Inactive services go out as 0 (computeTotals already zeroes them); the server recomputes grand_total.
    const form = new FormData();
    form.append('email', formData.email);
    form.append('rental_duration', formData.rentalDuration);
    form.append('car_type', formData.carType);
    form.append('range_rent', String(formData.rangeRent));
    form.append('start_date', formData.startDate);
    form.append('start_time', formData.startTime);
    form.append('end_date', formData.endDate);
    form.append('purpose', formData.purpose);
    form.append('identity_type', formData.identityType);
    form.append('rental_cost', String(totals.rental_cost));
    form.append('deposit', String(totals.deposit));
    form.append('discount', String(totals.discount_applied));
    form.append('needs_trip', String(formData.needsTrip));
    form.append('needs_driver', String(formData.needsDriver));
    form.append('needs_delivery', String(formData.needsDelivery));
    form.append('needs_pickup', String(formData.needsPickup));
    form.append('trip_fee', String(totals.trip_fee));
    form.append('driver_fee', String(totals.driver_fee));
    form.append('delivery_fee', String(totals.delivery_fee));
    form.append('pickup_fee', String(totals.pickup_fee));

    const getFirst = (val: unknown) => (Array.isArray(val) ? val[0] : val);
    form.append('name', String(getFirst(identityData.name) ?? ''));
    form.append('whatsapp', String(getFirst(identityData.whatsapp) ?? ''));
    form.append('address', String(getFirst(identityData.address) ?? ''));
    if (typeof identityData.companyAddress === 'string') {
      form.append('company_address', identityData.companyAddress);
    }

    for (const [key, value] of Object.entries(identityData)) {
      if (value instanceof File) {
        form.append(key, value);
      }
    }

    const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/booking`, {
      method: 'POST',
      body: form,
    });

    if (!response.ok) {
      // The session guard already handles 401 and 403; the form stays filled so the admin can fix and resend.
      if (response.status !== 401 && response.status !== 403) {
        toast.error(await readServerError(response, 'Booking gagal disimpan. Coba lagi.'));
      }
      return;
    }

    const saved: { transaction?: { booking_code?: string } } = await response.json().catch(() => ({}));
    const savedCode = saved.transaction?.booking_code;
    handleReset();
    setActiveSection('welcome');
    toast.success(
      savedCode ? `Booking ${savedCode} tersimpan.` : 'Booking tersimpan. Kode booking ada di menu Transaksi.',
    );
  } catch (error) {
    console.error('Error in handleFinalSubmit:', error);
    toast.error('Server tidak bisa dihubungi. Booking belum tersimpan.');
  } finally {
    submitLock.current = false;
    setIsSubmitting(false);
  }
};


  const handleReset = () => {
    setFormData({
      email: '',
      rentalDuration: '',
      rangeRent: 0,
      carType: '',
      needsTrip: false,
      needsDriver: false,
      needsDelivery: false,
      needsPickup: false,
      startDate: '',
      startTime: '',
      endDate: '',
      purpose: '',
      identityType: 'single',
      tripFee: 0,
      driverFee: 0,
      deliveryFee: 0,
      pickupFee: 0,
      deposit: 0,
      discount: 0
    });
    // Identity data and files must not carry over to the next customer (finding S4).
    setMarriedFormData(EMPTY_MARRIED);
    setSingleFormData(EMPTY_SINGLE);
    setCorporateFormData(EMPTY_CORPORATE);
    setForeignerFormData(EMPTY_FOREIGNER);
    setReorderFormData(EMPTY_REORDER);
    setDismissedMatchKey('');
    setShowIdentityForm(false);
    setShowTerms(false);
    setShowBookingConfirmation(false);
  };

  const renderIdentityForm = () => {
    switch (formData.identityType) {
      case 'married':
        return <MarriedForm data={marriedFormData} onChange={setMarriedFormData} />;
      case 'single':
        return <SingleForm data={singleFormData} onChange={setSingleFormData} />;
      case 'corporate':
        return <CorporateForm data={corporateFormData} onChange={setCorporateFormData} />;
      case 'foreigner':
        return <ForeignerForm data={foreignerFormData} onChange={setForeignerFormData} />;
      case 'reorder':
        return <ReorderForm data={reorderFormData} onChange={setReorderFormData} />;
      default:
        return null;
    }
  };

  return (
    // Below lg there is no fixed height: the document scrolls, not a panel inside it. flex-1 in the
    // App column still stretches a short page so the footer stays at the bottom of the screen.
    <div className="flex flex-1 flex-col lg:h-[calc(100dvh-4rem)] lg:flex-none lg:flex-row">
      {isSidebarOpen && isDesktop && (
        <div className="hidden w-64 shrink-0 overflow-y-auto bg-white p-6 text-gray-800 shadow-md dark:bg-gray-800 dark:text-gray-100 lg:block">
          <h2 className="text-xl font-semibold mb-6 text-gray-800 dark:text-gray-100">Menu</h2>
          <SidebarNav activeSection={activeSection} onNavigate={handleNavigate} />
        </div>
      )}
      <MobileNavDrawer
        open={isMobileNavOpen}
        onOpenChange={onMobileNavChange}
        activeSection={activeSection}
        onNavigate={handleNavigate}
      />
      {/* min-w-0 stops a wide table from stretching this flex child past the viewport. */}
      <div className="min-w-0 flex-1 bg-gray-50 px-4 py-4 sm:p-6 lg:overflow-auto">
        {activeSection === 'welcome' ? (
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 sm:p-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Selamat Datang di Dashboard Andi Rental Mobil Jakarta</h2>
              <p className="text-orange-50 text-lg">Kelola operasional rental mobil Anda secara efisien dengan sistem yang komprehensif.</p>
              <WelcomeSummary />
            </div>
          </div>
        ) : activeSection === 'database' ? (
          <CustomerDatabase
            initialReorderCustomerId={reorderCustomerId}
            onInitialReorderHandled={clearReorderRequest}
          />
        ) : activeSection === 'loyalty' ? (
          <LoyaltyCustomer />
        ) : activeSection === 'transaction' ? (
          <TransactionDatabase />
        ) : activeSection === 'employee' ? (
          <EmployeeManagement />
        ) : activeSection === 'car' ? (
          <CarManagement />
        ) : activeSection === 'activitylog' ? (
          <ActivityLog />
        ) : activeSection === 'setting' ? (
          <Setting />
        ) : (
          <div className="max-w-4xl mx-auto">
            {!showIdentityForm && !showTerms && !showBookingConfirmation ? (
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-semibold mb-6 text-selection-safe">Formulir Customer</h2>
                <p className="text-gray-500 mb-6">Untuk bertanda <span className="text-red-500">*</span> wajib diisi!</p>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 min-h-11 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                      required
                    />
                  </div>

                  {existingNotice && <div className="md:col-span-2">{existingNotice}</div>}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Durasi Sewa <span className="text-red-500">*</span>
                    </label>
                    <Select
                      options={[
                        { value: 'daily', label: 'Harian' },
                        { value: 'monthly', label: 'Bulanan' },
                      ]}
                      value={
                        [
                          { value: 'daily', label: 'Harian' },
                          { value: 'monthly', label: 'Bulanan' },
                        ].find((opt) => opt.value === formData.rentalDuration)
                      }
                      onChange={(selected) => {
                        if (selected) {
                          setFormData({ ...formData, rentalDuration: selected.value as 'daily' | 'monthly' });
                        }
                      }}
                      placeholder="Pilih Durasi"
                      className="react-select-container"
                      classNamePrefix="react-select"
                      styles={{
                        control: (base, state) => ({
                          ...base,
                          minHeight: 44,
                          borderColor: state.isFocused ? '#f97316' : base.borderColor, // orange-500 saat focus
                          boxShadow: state.isFocused ? '0 0 0 3px rgba(249, 115, 22, 0.5)' : base.boxShadow,
                          '&:hover': {
                            borderColor: '#f97316',
                          },
                        }),
                        option: (base, state) => ({
                          ...base,
                          backgroundColor: state.isSelected
                            ? '#f97316'
                            : state.isFocused
                            ? '#fed7aa'
                            : 'white',
                          color: state.isSelected
                            ? (state.isFocused ? 'black' : 'white')
                            : 'black',
                          '&:hover': {
                            backgroundColor: '#fed7aa',
                            color: 'black',
                          },
                        }),
                      }}
                    />
                  </div>

                  {formData.rentalDuration && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Berapa Lama? <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={formData.rangeRent}
                        onChange={(e) =>
                          setFormData({ ...formData, rangeRent: Number(e.target.value) })
                        }
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 min-h-11 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                        placeholder={`Contoh: 3 ${formData.rentalDuration === 'daily' ? 'hari' : 'bulan'}`}
                        required
                      />
                      <p className="text-sm text-gray-500">
                        {formData.rentalDuration === 'daily' ? 'Hari' : 'Bulan'}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipe Mobil <span className="text-red-500">*</span>
                    </label>
                    <Select
                      options={carTypes}
                      value={carTypes.find((opt) => opt.value === formData.carType)}
                      onChange={(selected) => {
                        if (selected) {
                          setFormData({ ...formData, carType: selected.value });
                        }
                      }}
                      placeholder="Pilih Mobil"
                      className="react-select-container"
                      classNamePrefix="react-select"
                      styles={{
                        control: (base, state) => ({
                          ...base,
                          minHeight: 44,
                          borderColor: state.isFocused ? '#f97316' : base.borderColor, // orange-500 saat focus
                          boxShadow: state.isFocused ? '0 0 0 3px rgba(249, 115, 22, 0.5)' : base.boxShadow, // ring effect
                          '&:hover': {
                            borderColor: '#f97316',
                          },
                        }),
                        option: (base, state) => ({
                          ...base,
                          backgroundColor: state.isSelected
                            ? '#f97316'
                            : state.isFocused
                            ? '#fed7aa'
                            : 'white',
                          color: state.isSelected
                            ? (state.isFocused ? 'black' : 'white')
                            : 'black',
                          '&:hover': {
                            backgroundColor: '#fed7aa',
                            color: 'black',
                          },
                        }),
                      }}          
                    />
                  </div>

                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Deposit</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-600">Rp</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formData.deposit === 0 ? '' : numeral(formData.deposit).format('0,0')}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, '');
                            setFormData({ ...formData, deposit: parseInt(raw || '0') });
                          }}
                          className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 min-h-11 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                          placeholder="Contoh: 100,000"
                        />
                      </div>
                    </div>

                    <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Diskon <span className="text-gray-500 text-xs font-normal">(diambil dari harga sewa mobil)</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-600">
                        Rp
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={
                          formData.discount === 0
                            ? ''
                            : numeral(formData.discount).format('0,0')
                        }
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, '');
                          setFormData({
                            ...formData,
                            discount: parseInt(raw || '0'),
                          });
                        }}
                        className="w-full rounded-lg border border-gray-300 pl-10 pr-20 py-2 min-h-11 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                        placeholder="Contoh: 25.000"
                      />
                      <span className="absolute right-3 inset-y-0 flex items-center text-sm text-orange-700 font-semibold">
                        {estimate ? `${estimate.discountPercentage.toFixed(2)}%` : '0%'}
                      </span>
                    </div>
                    {estimate && formData.discount > estimate.totals.rental_cost && (
                      <p className="mt-1 text-xs text-gray-700">
                        Diskon melebihi harga sewa, jadi yang dipakai Rp {estimate.totals.discount_applied.toLocaleString('id-ID')}.
                      </p>
                    )}
                  </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tanggal Mulai <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 min-h-11 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 text-selection-safe"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tanggal Selesai <span className="text-red-500">*</span>{' '}<span className="text-xs italic text-gray-500 font-normal">(Auto Generated)</span>
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      readOnly
                      className="w-full rounded-lg border border-gray-300 bg-gray-100 px-4 py-2 min-h-11 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 text-selection-safe"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Jam Mulai 
                    </label>
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 min-h-11 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                    />
                  </div>

                  {/* The whole label is the tap target, so each option reaches 44px on a phone. */}
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-6">
                    {SERVICE_OPTIONS.map(({ key, label }) => (
                      <label key={key} className="flex min-h-11 items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          id={key}
                          checked={formData[key]}
                          onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })}
                          className="h-5 w-5 shrink-0 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        {label}
                      </label>
                    ))}
                  </div>

                  {(formData.needsTrip || formData.needsDelivery || formData.needsPickup || formData.needsDriver) && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-2">
                        {formData.needsTrip && (
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Biaya Luar Kota
                            </label>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-600">
                                Rp
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={
                                  formData.tripFee === 0
                                    ? ''
                                    : numeral(formData.tripFee).format('0,0')
                                }
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/[^0-9]/g, ''); // hanya angka
                                  setFormData({
                                    ...formData,
                                    tripFee: parseInt(raw || '0'),
                                  });
                                }}
                                className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 min-h-11 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                                placeholder="Contoh: 50,000"
                              />
                            </div>
                          </div>
                      )}

                        {formData.needsDriver && (
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Biaya Supir
                            </label>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-600">
                                Rp
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={
                                  formData.driverFee === 0
                                    ? ''
                                    : numeral(formData.driverFee).format('0,0')
                                }
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/[^0-9]/g, ''); // hanya angka
                                  setFormData({
                                    ...formData,
                                    driverFee: parseInt(raw || '0'),
                                  });
                                }}
                                className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 min-h-11 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                                placeholder="Contoh: 50,000"
                              />
                            </div>
                          </div>
                      )}

                      {formData.needsDelivery && (
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Pilih Biaya Antar
                          </label>
                          <Select
                            options={deliveryOptions.map((fee) => ({
                              value: fee,
                              label: `Rp ${fee.toLocaleString('id-ID')}`,
                            }))}
                            value={
                                typeof formData.deliveryFee === 'number' && formData.deliveryFee > 0
                                  ? { value: formData.deliveryFee, label: `Rp ${formData.deliveryFee.toLocaleString('id-ID')}` }
                                  : null
                              }
                            onChange={(selected) => {
                              if (selected) {
                                setFormData((prev) => ({ ...prev, deliveryFee: selected.value }));
                              }
                            }}
                            placeholder="Pilih Biaya Antar"
                            className="react-select-container"
                            classNamePrefix="react-select"
                            styles={{
                              control: (base, state) => ({
                                ...base,
                                minHeight: 44,
                                borderColor: state.isFocused ? '#f97316' : base.borderColor,
                                boxShadow: state.isFocused ? '0 0 0 3px rgba(249, 115, 22, 0.5)' : base.boxShadow,
                                '&:hover': {
                                  borderColor: '#f97316',
                                },
                              }),
                              option: (base, state) => ({
                                ...base,
                                backgroundColor: state.isSelected
                                  ? '#f97316'
                                  : state.isFocused
                                  ? '#fed7aa'
                                  : 'white',
                                color: state.isSelected
                                  ? (state.isFocused ? 'black' : 'white')
                                  : 'black',
                                '&:hover': {
                                  backgroundColor: '#fed7aa',
                                  color: 'black',
                                },
                              }),
                            }}
                          />
                        </div>
                      )}

                      {formData.needsPickup && (
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Pilih Biaya Jemput
                          </label>
                          <Select
                            options={deliveryOptions.map((fee) => ({
                              value: fee,
                              label: `Rp ${fee.toLocaleString('id-ID')}`,
                            }))}
                            value={
                              typeof formData.pickupFee === 'number' && formData.pickupFee > 0
                                ? { value: formData.pickupFee, label: `Rp ${formData.pickupFee.toLocaleString('id-ID')}` }
                                : null
                            }
                            onChange={(selected) => {
                              if (selected) {
                                setFormData((prev) => ({ ...prev, pickupFee: selected.value }));
                              }
                            }}
                            placeholder="Pilih Biaya Jemput"
                            className="react-select-container"
                            classNamePrefix="react-select"
                            styles={{
                              control: (base, state) => ({
                                ...base,
                                minHeight: 44,
                                borderColor: state.isFocused ? '#f97316' : base.borderColor,
                                boxShadow: state.isFocused ? '0 0 0 3px rgba(249, 115, 22, 0.5)' : base.boxShadow,
                                '&:hover': {
                                  borderColor: '#f97316',
                                },
                              }),
                              option: (base, state) => ({
                                ...base,
                                backgroundColor: state.isSelected
                                  ? '#f97316'
                                  : state.isFocused
                                  ? '#fed7aa'
                                  : 'white',
                                color: state.isSelected
                                  ? (state.isFocused ? 'black' : 'white')
                                  : 'black',
                                '&:hover': {
                                  backgroundColor: '#fed7aa',
                                  color: 'black',
                                },
                              }),
                            }}
                          />
                        </div>
                      )}

                    </div>
                  )}


                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tujuan Sewa <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.purpose}
                      onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 min-h-11 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                      rows={3}
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipe Identitas <span className="text-red-500">*</span>
                    </label>
                    <Select
                      options={[
                        { value: 'married', label: 'Menikah' },
                        { value: 'single', label: 'Single' },
                        { value: 'corporate', label: 'Perusahaan' },
                        { value: 'foreigner', label: 'WNA' },
                        // { value: 'reorder', label: 'Re-Order' },
                      ]}
                      value={
                        formData.identityType
                          ? {
                              value: formData.identityType,
                              label:
                                {
                                  married: 'Menikah',
                                  single: 'Single',
                                  corporate: 'Perusahaan',
                                  foreigner: 'WNA',
                                  reorder: 'Re-Order',
                                }[formData.identityType] || '',
                            }
                          : null
                      }
                      onChange={(selected) => {
                        if (selected) {
                          setFormData({ ...formData, identityType: selected.value as CustomerForm['identityType'] });
                        }
                      }}
                      placeholder="Pilih Tipe Identitas"
                      className="react-select-container"
                      classNamePrefix="react-select"
                      styles={{
                        control: (base, state) => ({
                          ...base,
                          minHeight: 44,
                          borderColor: state.isFocused ? '#f97316' : base.borderColor,
                          boxShadow: state.isFocused ? '0 0 0 3px rgba(249, 115, 22, 0.5)' : base.boxShadow,
                          '&:hover': {
                            borderColor: '#f97316',
                          },
                        }),
                        option: (base, state) => ({
                          ...base,
                          backgroundColor: state.isSelected
                            ? '#f97316'
                            : state.isFocused
                            ? '#fed7aa'
                            : 'white',
                          color: state.isSelected
                            ? (state.isFocused ? 'black' : 'white')
                            : 'black',
                          '&:hover': {
                            backgroundColor: '#fed7aa',
                            color: 'black',
                          },
                        }),
                      }}
                    />
                  </div>

                  <div className="md:col-span-2">
                  {estimate && (
                    <div className="mt-6 p-4 border border-orange-200 bg-orange-50 rounded-xl w-full">
                      <p className="text-base font-bold text-gray-900 mb-2">Kisaran Harga</p>
                      <PriceBreakdown estimate={estimate} rangeRent={formData.rangeRent} />
                    </div>
                  )}
                  </div>
                  
                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      className="w-full min-h-11 px-5 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-xl shadow-md hover:from-orange-600 hover:to-yellow-600"
                      >
                      Lanjut
                    </button>
                  </div>
                </form>
              </div>
            ) : showTerms ? (
              <TermsAndConditions
                onAccept={handleTermsAccept}
                onBack={() => setShowTerms(false)}
              />
            ) : showBookingConfirmation ? (
              <BookingConfirmation
                formData={formData}
                identityData={getCurrentIdentityData()}
                onBack={() => setShowBookingConfirmation(false)}
                onSubmit={handleFinalSubmit}
                isSubmitting={isSubmitting}
              />
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8">
                <form onSubmit={handleIdentityFormSubmit}>
                  {existingNotice && <div className="mb-6">{existingNotice}</div>}
                  {renderIdentityForm()}
                  {/* Reversed on mobile so the primary action sits first, under the thumb after scrolling. */}
                  <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
                    <button
                      type="button"
                      onClick={() => setShowIdentityForm(false)}
                      className="flex-1 min-h-11 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                    >
                      Kembali
                    </button>
                    <button
                      type="submit"
                      className="flex-1 min-h-11 px-5 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-xl shadow-md hover:from-orange-600 hover:to-yellow-600"
                    >
                      Lanjut
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


export default Dashboard;