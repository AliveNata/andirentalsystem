import React, { useState,useEffect, useMemo } from 'react';
import { Users, FileText, Settings, Home, Car, List, IdCardLanyard, Stamp, BadgeDollarSign  } from 'lucide-react';
import { CustomerForm, MarriedCustomerForm, SingleCustomerForm, CorporateCustomerForm, ForeignerCustomerForm, ReorderCustomerForm } from '../types';
import { MarriedForm, SingleForm, CorporateForm, ForeignerForm, ReorderForm } from './IdentityForms';
import TermsAndConditions from './TermsAndConditions';
import BookingConfirmation from './BookingConfirmation';
import CustomerDatabase from './CustomerDatabase';
import LoyaltyCustomer from './LoyaltyCustomer';
import TransactionDatabase from './TransactionDatabase';
import EmployeeManagement from './EmployeeManagement';
import CarManagement from './CarManagement';
import ActivityLog from './ActivityLog';
import Setting from './Settings';
import numeral from 'numeral';
import Select from 'react-select';
import { toast } from 'react-hot-toast';



interface DashboardProps {
  isSidebarOpen: boolean;
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

function Dashboard({ isSidebarOpen }: DashboardProps) {
  const [activeSection, setActiveSection] = useState<'welcome' | 'customer' | 'database' | 'transaction' | 'employee' | 'car' | 'activitylog' | 'loyalty' | 'setting'>('welcome');
  const [showIdentityForm, setShowIdentityForm] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showBookingConfirmation, setShowBookingConfirmation] = useState(false);
  const [carTypes, setCarTypes] = useState<{ 
        label: string; 
        value: string;
        }[]>([]);
  const [carRates, setCarRates] = useState<any[]>([]);
  const [bookingCode, setBookingCode] = useState('');
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

  

  const estimatedBreakdown = useMemo(() => {
    const selectedCar = carRates.find(
      (car) => car.value === formData.carType
    );
  
    if (!selectedCar || !formData.rangeRent || formData.rangeRent <= 0) return null;
  
    const isDaily = formData.rentalDuration === 'daily';
    const rate = isDaily ? Number(selectedCar.daily_rate) : Number(selectedCar.monthly_rate);
    const durationLabel = isDaily ? 'hari' : 'bulan';
    const rentalCost = rate * formData.rangeRent;
    // const driverFee = formData.needsDriver ? Number(selectedCar.driver_fee) || 0 : 0;
    // const deliveryFee = formData.needsDelivery ? Number(selectedCar.delivery_fee) || 0 : 0;
    const tripFee = formData.needsTrip ? formData.tripFee : 0;
    const driverFee = formData.needsDriver ? formData.driverFee : 0;
    const deliveryFee = formData.needsDelivery ? formData.deliveryFee : 0;
    const pickupFee = formData.needsPickup ? formData.pickupFee : 0;
    const maxDiscount = Math.min(formData.discount || 0, rentalCost);
    const discountedRentalCost = rentalCost - maxDiscount;
    const deposit = formData.deposit || 0;
    const grandTotalBeforeDiscount = rentalCost + deposit + tripFee + driverFee + deliveryFee + pickupFee;
    const grandTotalAfterDiscount = discountedRentalCost + deposit + tripFee + driverFee + deliveryFee + pickupFee ;
    const discountPercentage = rentalCost > 0 ? (maxDiscount / rentalCost) * 100 : 0;

    return {
      label: selectedCar.label,
      rate,
      durationLabel,
      deposit,
      rentalCost,
      discountedRentalCost,
      discount: maxDiscount,
      discountPercentage,
      tripFee,
      driverFee,
      deliveryFee,
      pickupFee, 
      grandTotalBeforeDiscount,
      grandTotalAfterDiscount,
    };
  }, [formData, carRates]);

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
    

  const [marriedFormData, setMarriedFormData] = useState<MarriedCustomerForm>({
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
  });

  const [singleFormData, setSingleFormData] = useState<SingleCustomerForm>({
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
  });

  const [corporateFormData, setCorporateFormData] = useState<CorporateCustomerForm>({
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
  });

  const [foreignerFormData, setForeignerFormData] = useState<ForeignerCustomerForm>({
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
  });

  const [reorderFormData, setReorderFormData] = useState<ReorderCustomerForm>({
    name: '',
    whatsapp: '',
    address: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowIdentityForm(true);
  };

  const handleIdentityFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowTerms(true);
  };

  const checkBookingCodeExists = async (code: string): Promise<boolean> => {
  try {
    const res = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/transaction/check-booking-code/${code}`);
    if (!res.ok) return false;
    const data = await res.json();
    return data.exists;
  } catch {
    return false;
  }
};
const handleTermsAccept = async () => {
  let generatedCode = '';
  let exists = true;

  // Ulangi generate sampai dapat yang belum ada
  while (exists) {
    generatedCode = generateBookingCode();
    exists = await checkBookingCodeExists(generatedCode);
  }

  setBookingCode(generatedCode);
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

// Dalam fungsi handleFinalSubmit, ganti bagian konversi dokumen
// Fungsi untuk menangani submit final dengan FormData
const handleFinalSubmit = async () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    console.log("🧪 User di localStorage:", user);           // ⬅️ Tambahkan ini
    console.log("📤 Username dikirim:", user?.username);     // ⬅️ Dan ini juga
    
    const identityData: IdentityData = getCurrentIdentityData();
    const selectedCar = carRates.find(
      (car) => car.value === formData.carType
    );
  
    if (!selectedCar || !formData.rangeRent || formData.rangeRent <= 0) return null;
    const isDaily = formData.rentalDuration === 'daily';
    const rate = isDaily ? Number(selectedCar.daily_rate) : Number(selectedCar.monthly_rate);
    const rentalCost = rate * formData.rangeRent;
    const tripFee = formData.needsTrip ? formData.tripFee : 0;
    const driverFee = formData.needsDriver ? formData.driverFee : 0;
    const deliveryFee = formData.needsDelivery ? formData.deliveryFee : 0;
    const pickupFee = formData.needsPickup ? formData.pickupFee : 0;
    const deposit = formData.deposit ? formData.deposit : 0;
    const maxDiscount = Math.min(formData.discount || 0, rentalCost)
    const grandTotal = rentalCost + deposit + tripFee + driverFee + deliveryFee + pickupFee - maxDiscount;



    const form = new FormData();
    // Tambahkan data non-file
    form.append('grand_total', grandTotal.toString());
    form.append('booking_code', bookingCode);
    form.append('email', formData.email);
    form.append('rental_duration', formData.rentalDuration);
    form.append('car_type', formData.carType);
    form.append('deposit', formData.deposit.toString());
    form.append('discount', formData.discount.toString());
    form.append('needs_trip', formData.needsTrip.toString());
    form.append('needs_driver', formData.needsDriver ? 'true' : 'false');
    form.append('needs_delivery', formData.needsDelivery ? 'true' : 'false');
    form.append('needs_pickup', formData.needsPickup ? 'true' : 'false');
    form.append('trip_fee', formData.tripFee.toString());
    form.append('driver_fee', formData.driverFee.toString());
    form.append('delivery_fee', formData.deliveryFee.toString());
    form.append('pickup_fee', formData.pickupFee.toString()); 
    form.append('start_date', formData.startDate);
    form.append('start_time', formData.startTime);
    form.append('end_date', formData.endDate);
    form.append('purpose', formData.purpose);
    form.append('identity_type', formData.identityType);
    form.append('range_rent', formData.rangeRent.toString());
    form.append('user_id', user?.id); 
    if (user?.username) {
      form.append('username', user.username);
    }


    const getFirst = (val: any) => Array.isArray(val) ? val[0] : val;
    form.append('name', getFirst(identityData.name));
    form.append('whatsapp', getFirst(identityData.whatsapp));
    form.append('address', getFirst(identityData.address));
    if (typeof identityData.companyAddress === 'string') {
      form.append('company_address', identityData.companyAddress);
    }

    // Kirim dokumen (File) saja, jangan string biasa
    for (const [key, value] of Object.entries(identityData)) {
      if (['name', 'whatsapp', 'address', 'companyAddress'].includes(key)) continue;

      if (value instanceof File) {
        form.append(key, value);
      }
    }
    

    // Debug (optional)
    console.log('=== FORM DATA ===');
    for (let [key, val] of form.entries()) {
      console.log(`${key}:`, val);
    }

    const response = await 
    fetch(`${API_BASE_URL.replace(/\/$/, '')}/customer`, {
      method: 'POST',
      body: form,
    });

    if (!response.ok) {
      throw new Error('Gagal menyimpan data ke server.');
    }

    // === Tambahan: kirim ke /transaction ===
    await fetch(`${API_BASE_URL.replace(/\/$/, '')}/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        booking_code: bookingCode,
        email: formData.email,
        rental_duration: formData.rentalDuration,
        range_rent: formData.rangeRent,
        car_type: formData.carType,
        needs_trip: formData.needsTrip,
        needs_driver: formData.needsDriver,
        needs_delivery: formData.needsDelivery,
        needs_pickup: formData.needsPickup,
        trip_fee: formData.tripFee,
        driver_fee: formData.driverFee,
        delivery_fee: formData.deliveryFee,
        pickup_fee: formData.pickupFee,
        deposit: formData.deposit,
        discount: formData.discount,
        start_date: formData.startDate,
        start_time: formData.startTime,
        end_date: formData.endDate,
        grand_total: grandTotal,
        identity_type: formData.identityType,
        name: identityData.name,
        whatsapp: identityData.whatsapp,
        address: identityData.address,
        company_address: identityData.companyAddress || '',
        purpose: formData.purpose,
        username: user?.username || 'system',
        user_id: user?.id || null,
      }),
});

    // Setelah sukses, kirim email konfirmasi
    // await 
    // fetch(`${API_BASE_URL.replace(/\/$/, '')}/send-confirmation-email`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     to: formData.email,
    //     customerName: identityData.name,
    //     bookingCode: bookingCode,
    //     totalPrice: formData.rangeRent,
    //     CarType: formData.carType,
    //     startDate: formData.startDate,
    //     startTime: formData.startTime,
    //     endDate: formData.endDate,
    //     needsDriver: formData.needsDriver,
    //     needsDelivery: formData.needsDelivery,
    //     rentalCost: rentalCost,
    //     driverFee: driverFee,
    //     deliveryFee: deliveryFee,
    //     grandTotal: grandTotal, 
    //   }),
    //  });

    // Reset form dan UI
    handleReset();
    setActiveSection('welcome');
    toast.success('Data berhasil disimpan!');
  } catch (error) {
    console.error('Error in handleFinalSubmit:', error);
    toast.error('Terjadi kesalahan saat menyimpan data.');
  }
};


  const generateBookingCode = () => {
    const date = new Date();
    const uniqueId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `ARMJ${day}${month}${year}${uniqueId}`;
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
    <div className="flex h-[calc(100vh-4rem)]">
      {isSidebarOpen && (
        <div className="w-64 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-md p-6">
          <h2 className="text-xl font-semibold mb-6 text-gray-800 dark:text-gray-100">Menu</h2>
          <nav className="space-y-4">
            <a 
              href="#" 
              onClick={() => setActiveSection('welcome')}
              className="group flex items-center space-x-3 transition-colors"
            >
              <Home
                size={20}
                className={`transition-colors ${
                  activeSection === 'welcome'
                    ? 'stroke-orange-500'
                    : 'stroke-gray-600 dark:stroke-white group-hover:stroke-orange-500'
                }`}
              />
              <span
                className={`transition-colors ${
                  activeSection === 'welcome'
                    ? 'text-orange-500'
                    : 'text-gray-600 dark:text-white group-hover:text-orange-500'
                }`}
              >
                Welcome
              </span>
            </a>
            <a 
              href="#" 
              onClick={() => setActiveSection('customer')}
              className="group flex items-center space-x-3 transition-colors"
            >
              <Users
                size={20}
                className={`transition-colors
                  ${
                    activeSection === 'customer'
                      ? 'stroke-orange-500'
                      : 'stroke-gray-600 dark:stroke-white group-hover:stroke-orange-500'
                  }`}
              />
              <span
                className={`transition-colors 
                  ${activeSection === 'customer'
                    ? 'text-orange-500'
                    : 'text-gray-600 dark:text-white group-hover:text-orange-500'}`}
              >
                Formulir Customer
              </span>
            </a>

            <a 
              href="#" 
              onClick={() => setActiveSection('database')}
              className="group flex items-center space-x-3 transition-colors"
            >
              <FileText
                size={20}
                className={`transition-colors ${
                  activeSection === 'database'
                    ? 'stroke-orange-500'
                    : 'stroke-gray-600 dark:stroke-white group-hover:stroke-orange-500'
                }`}
              />
              <span
                className={`transition-colors ${
                  activeSection === 'database'
                    ? 'text-orange-500'
                    : 'text-gray-600 dark:text-white group-hover:text-orange-500'
                }`}
              >
                Database Customer
              </span>
            </a>

            <a 
              href="#"
              onClick={() => setActiveSection('loyalty')}
              className="group flex items-center space-x-3 transition-colors"
            >
              <Stamp
                size={20}
                className={`transition-colors ${
                  activeSection === 'loyalty'
                    ? 'stroke-orange-500'
                    : 'stroke-gray-600 dark:stroke-white group-hover:stroke-orange-500'
                }`}
              />
              <span
                className={`transition-colors ${
                  activeSection === 'loyalty'
                    ? 'text-orange-500'
                    : 'text-gray-600 dark:text-white group-hover:text-orange-500'
                }`}
              >
                Loyalty Customer
              </span>
            </a>

            <a 
              href="#" 
              onClick={() => setActiveSection('transaction')}
              className="group flex items-center space-x-3 transition-colors"
            >
              <BadgeDollarSign
                size={20}
                className={`transition-colors ${
                  activeSection === 'transaction'
                    ? 'stroke-orange-500'
                    : 'stroke-gray-600 dark:stroke-white group-hover:stroke-orange-500'
                }`}
              />
              <span
                className={`transition-colors ${
                  activeSection === 'transaction'
                    ? 'text-orange-500'
                    : 'text-gray-600 dark:text-white group-hover:text-orange-500'
                }`}
              >
                Transaksi
              </span>
            </a>

            <a 
              href="#" 
              onClick={() => setActiveSection('employee')}
              className="group flex items-center space-x-3 transition-colors"
            >
              <IdCardLanyard
                size={20}
                className={`transition-colors ${
                  activeSection === 'employee'
                    ? 'stroke-orange-500'
                    : 'stroke-gray-600 dark:stroke-white group-hover:stroke-orange-500'
                }`}
              />
              <span
                className={`transition-colors ${
                  activeSection === 'employee'
                    ? 'text-orange-500'
                    : 'text-gray-600 dark:text-white group-hover:text-orange-500'
                }`}
              >
                Karyawan
              </span>
            </a>
            
            <a 
              href="#" 
              onClick={() => setActiveSection('car')}
              className="group flex items-center space-x-3 transition-colors"
            >
              <Car
                size={20}
                className={`transition-colors ${
                  activeSection === 'car'
                    ? 'stroke-orange-500'
                    : 'stroke-gray-600 dark:stroke-white group-hover:stroke-orange-500'
                }`}
              />
              <span
                className={`transition-colors ${
                  activeSection === 'car'
                    ? 'text-orange-500'
                    : 'text-gray-600 dark:text-white group-hover:text-orange-500'
                }`}
              >
                Mobil
              </span>
            </a>

            <a 
              href="#" 
              onClick={() => setActiveSection('activitylog')}
              className="group flex items-center space-x-3 transition-colors"
            >
              <List
                size={20}
                className={`transition-colors ${
                  activeSection === 'activitylog'
                    ? 'stroke-orange-500'
                    : 'stroke-gray-600 dark:stroke-white group-hover:stroke-orange-500'
                }`}
              />
              <span
                className={`transition-colors ${
                  activeSection === 'activitylog'
                    ? 'text-orange-500'
                    : 'text-gray-600 dark:text-white group-hover:text-orange-500'
                }`}
              >
                Aktifitas Log
              </span>
            </a>

            <a 
            href="#" 
            onClick={() => setActiveSection('setting')}
            className="group flex items-center space-x-3 transition-colors"
          >
            <Settings
              size={20}
              className={`transition-colors ${
                activeSection === 'setting'
                  ? 'stroke-orange-500'
                  : 'stroke-gray-600 dark:stroke-white group-hover:stroke-orange-500'
              }`}
            />
            <span
              className={`transition-colors ${
                activeSection === 'setting'
                  ? 'text-orange-500'
                  : 'text-gray-600 dark:text-white group-hover:text-orange-500'
              }`}
            >
              Pengaturan
            </span>
          </a>
          </nav>
        </div>
      )}
      <div className="flex-1 p-6 bg-gray-50 overflow-auto">
        {activeSection === 'welcome' ? (
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow-lg p-8">
              <h2 className="text-3xl font-bold text-white mb-3">Selamat Datang di Dashboard Andi Rental Mobil Jakarta</h2>
              <p className="text-orange-50 text-lg">Kelola operasional rental mobil Anda secara efisien dengan sistem yang komprehensif.</p>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                  <h3 className="text-white font-semibold mb-1">Rental Aktif</h3>
                  <p className="text-orange-50">12 kendaraan sedang disewa saat ini</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                  <h3 className="text-white font-semibold mb-1">Mobil Tersedia</h3>
                  <p className="text-orange-50">28 kendaraan siap untuk disewa</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                  <h3 className="text-white font-semibold mb-1">Pemesanan Hari Ini</h3>
                  <p className="text-orange-50">5 pemesanan baru</p>
                </div>
              </div>
            </div>
          </div>
        ) : activeSection === 'database' ? (
          <CustomerDatabase />
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
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-semibold mb-6 text-selection-safe">Formulir Customer</h2>
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
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                      required
                    />
                  </div>

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
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
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

                  <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
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
                          className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
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
                        className="w-full rounded-lg border border-gray-300 pl-10 pr-20 py-2 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                        placeholder="Contoh: 25.000"
                      />
                      <span className="absolute right-3 inset-y-0 flex items-center text-sm text-orange-600 font-semibold">
                        {estimatedBreakdown?.rentalCost
                          ? `${((formData.discount / estimatedBreakdown.rentalCost) * 100).toFixed(2)}%`
                          : '0%'}
                      </span>
                    </div>
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
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 text-selection-safe"
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
                      className="w-full rounded-lg border border-gray-300 bg-gray-100 px-4 py-2 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 text-selection-safe"
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
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                    />
                  </div>

                  <div className="flex space-x-6">
                      <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="needsTrip"
                        checked={formData.needsTrip}
                        onChange={(e) => setFormData({ ...formData, needsTrip: e.target.checked })}
                        className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                      <label htmlFor="needsTrip" className="ml-2 text-sm text-gray-700">
                        Biaya Luar Kota
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="needsDriver"
                        checked={formData.needsDriver}
                        onChange={(e) => setFormData({ ...formData, needsDriver: e.target.checked })}
                        className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                      <label htmlFor="needsDriver" className="ml-2 text-sm text-gray-700">
                        Butuh Supir
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="needsDelivery"
                        checked={formData.needsDelivery}
                        onChange={(e) => setFormData({ ...formData, needsDelivery: e.target.checked })}
                        className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                      <label htmlFor="needsDelivery" className="ml-2 text-sm text-gray-700">
                        Butuh Antar
                      </label>
                    </div>

                    <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="needsPickup"
                      checked={formData.needsPickup}
                      onChange={(e) => setFormData({ ...formData, needsPickup: e.target.checked })}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                    <label htmlFor="needsPickup" className="ml-2 text-sm text-gray-700">
                      Butuh Jemput
                    </label>
                  </div>
                  </div>

                  {(formData.needsTrip || formData.needsDelivery || formData.needsPickup || formData.needsDriver) && (
                    <div className="flex gap-4 col-span-2">
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
                                className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
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
                                className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
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


                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tujuan Sewa <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.purpose}
                      onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                      rows={3}
                      required
                    />
                  </div>

                  <div className="col-span-2">
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

                  <div className="col-span-2">
                  {estimatedBreakdown && (
                    <div className="mt-6 p-4 border border-orange-200 bg-orange-50 rounded-xl text-sm text-gray-800 space-y-1 w-full">
                      <p className="underline text-base font-bold text-black-800">Kisaran Harga</p>
                      <p className="font-semibold">{estimatedBreakdown.label} disewa Selama {formData.rangeRent} {estimatedBreakdown.durationLabel}</p>
                      <p>Harga Sewa Mobil: Rp {estimatedBreakdown.rate.toLocaleString()} x {formData.rangeRent} = Rp {estimatedBreakdown.rentalCost.toLocaleString()}</p>

                      {formData.deposit > 0 && (
                        <p>Deposit: Rp {estimatedBreakdown.deposit.toLocaleString()}</p>
                      )}
                      {formData.needsTrip && (
                        <p>Biaya Luar Kota: Rp {estimatedBreakdown.tripFee.toLocaleString()}</p>
                      )}
                      {formData.needsDriver && (
                        <p>Biaya Supir: Rp {estimatedBreakdown.driverFee.toLocaleString()}</p>
                      )}
                      {formData.needsDelivery && (
                        <p>Biaya Antar: Rp {estimatedBreakdown.deliveryFee.toLocaleString()}</p>
                      )}
                      {formData.needsPickup && (
                        <p>Biaya Jemput: Rp {estimatedBreakdown.pickupFee.toLocaleString()}</p>
                      )}

                      <hr className="my-2 border-orange-300" />

                      <p className="font-medium">Total Sebelum Diskon: Rp {estimatedBreakdown.grandTotalBeforeDiscount.toLocaleString()}</p>

                      {estimatedBreakdown.discount > 0 && (
                        <>
                          <p>
                            Diskon: - Rp {estimatedBreakdown.discount.toLocaleString()} /{' '}
                            <span className="font-semibold">
                              {estimatedBreakdown.discountPercentage.toFixed(2)}%
                            </span>
                          </p>
                          <p className="font-bold text-orange-700">
                            Total Setelah Diskon: Rp {estimatedBreakdown.grandTotalAfterDiscount.toLocaleString()}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                  </div>
                  
                  <div className="col-span-2">
                    <button
                      type="submit"
                      className="w-full px-5 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-xl shadow-md hover:from-orange-600 hover:to-yellow-600"
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
                bookingCode={bookingCode}
                identityData={getCurrentIdentityData()}
                onBack={() => setShowBookingConfirmation(false)}
                onSubmit={handleFinalSubmit}
              />
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-8">
                <form onSubmit={handleIdentityFormSubmit}>
                  {renderIdentityForm()}
                  <div className="mt-6 flex space-x-4">
                    <button
                      type="button"
                      onClick={() => setShowIdentityForm(false)}
                      className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                    >
                      Kembali
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-5 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-xl shadow-md hover:from-orange-600 hover:to-yellow-600"
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