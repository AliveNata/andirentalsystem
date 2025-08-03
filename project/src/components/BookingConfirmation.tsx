import React, { useState, useEffect, useMemo } from 'react';
import { CustomerForm } from '../types';
import ImagePreview from './ImagePreview';

interface BookingConfirmationProps {
  formData: CustomerForm;
  identityData: any;
  bookingCode: string;
  onBack: () => void;
  onSubmit: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// const generateBookingCode = () => {
//   const date = new Date();
//   const uniqueId = Math.random().toString(36).substring(2, 8).toUpperCase();
//   const year = date.getFullYear().toString().slice(-2);
//   const month = (date.getMonth() + 1).toString().padStart(2, '0');
//   const day = date.getDate().toString().padStart(2, '0');
//   return `ARMJ${year}${month}${day}${uniqueId}`;
// };

  const formatIdentityType = (type: string) => {
  switch (type) {
    case 'single': return 'Single';
    case 'married': return 'Menikah';
    case 'corporate': return 'Perusahaan';
    case 'foreigner': return 'WNA';
    case 'reorder': return 'Reorder';
    default: return type;
  }
};

  const documentLabels: { [key: string]: string } = {
    kkFile: "Kartu Keluarga",
    simFile: "SIM",
    parentKtpFile: "KTP Orang Tua",
    housePhotoFile: "Foto Rumah",
    workOrStudentIdFile: "ID Kerja / Kartu Mahasiswa / Surat Usaha",
    spouseKtpFile: "KTP Suami / Istri",
    ktpFile: "KTP",
    workIdFile: "ID Kerja",
    picKtpFile: "KTP PIC",
    picKkFile: "KK PIC",
    companyNpwpFile: "NPWP Perusahaan",
    companySiupFile: "SIUP Perusahaan",
    companyNibFile: "NIB Perusahaan",
    companyPhotoFile: "Foto Perusahaan",
    passportFile: "Paspor",
    kitasKitapFile: "KITAS / KITAP",
    visaFile: "Visa",
    ticketFile: "Tiket Perjalanan",
    ticketHotelFile: "Tiket Booking Hotel",
    verificationVideoFile: "Verification Video Call",
    optionalRequirementFile: "Persyaratan Optional",
  };

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const BookingConfirmation: React.FC<BookingConfirmationProps> = ({
  formData,
  identityData,
  bookingCode,
  onBack,
  onSubmit,
}) => {

  const [carRates, setCarRates] = useState<any[]>([]);

useEffect(() => {
  fetch(`${API_BASE_URL.replace(/\/$/, '')}/car-rates`)
    .then(res => res.json())
    .then(data => setCarRates(data))
    .catch(err => console.error('Error fetching car rates:', err));
}, []);

 useEffect(() => {
    console.log('IDENTITY DATA:', identityData);
  }, [identityData]);

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
  const deposit = formData.deposit || 0;
  const tripFee = formData.needsTrip ? formData.tripFee : 0;
  const driverFee = formData.needsDriver ? formData.driverFee : 0;
  const deliveryFee = formData.needsDelivery ? formData.deliveryFee : 0;
  const pickupFee = formData.needsPickup ? formData.pickupFee : 0;
  const maxDiscount = Math.min(formData.discount || 0, rentalCost);
  const discountedRentalCost = rentalCost - maxDiscount;
  const grandTotalBeforeDiscount = rentalCost + deposit + tripFee + driverFee + deliveryFee + pickupFee;
  const grandTotalAfterDiscount = discountedRentalCost + deposit + tripFee + driverFee + deliveryFee + pickupFee;
  const discountPercentage = rentalCost > 0 ? (maxDiscount / rentalCost) * 100 : 0;

  return {
    label: selectedCar.label,
    rate,
    durationLabel,
    rentalCost,
    deposit: formData.deposit,
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

  // Get all files from identityData
  const getUploadedFiles = () => {
    const files: { label: string; file: File | null }[] = [];
    Object.entries(identityData).forEach(([key, value]) => {
      if (key.toLowerCase().includes('file') && value instanceof File) {
        const formattedLabel = documentLabels[key] || key; // ⬅ ambil dari object
        files.push({ label: formattedLabel, file: value as File });
      }
    });
    return files;
  };

  const uploadedFiles = getUploadedFiles();

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Konfirmasi Booking</h2>
        <div className="mt-4">
          <p className="text-sm text-gray-600">Kode Booking</p>
          <p className="text-3xl font-mono font-bold text-orange-500">{bookingCode}</p>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-orange-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Detail Penyewaan</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="font-medium">{formData.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tujuan Sewa</p>
              <p className="font-semibold">{formData.purpose}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Tipe Mobil</p>
              <p className="font-medium">{formData.carType}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Layanan Tambahan</p>
              <p className="font-medium">
                {[
                  formData.needsDriver && 'Supir',
                  formData.needsDelivery && 'Antar',
                  formData.needsPickup && 'Jemput',
                ]
                  .filter(Boolean)
                  .join(', ') || 'Tidak ada'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Tanggal Mulai</p>
              <p className="font-medium">
                {formatDate(formData.startDate)} {formData.startTime}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Tanggal Selesai</p>
              <p className="font-medium">{formatDate(formData.endDate)}</p>
            </div>

            <div className="col-span-2 grid grid-cols-2 mt-2 gap-x-4">
            <div>
              <p className="text-sm text-gray-600">Tipe Sewa</p>
              <p className="font-medium">
                {formData.rentalDuration === 'daily' ? 'Harian' : 'Bulanan'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Durasi Sewa</p>
              <p className="font-medium">
                <span className="font-medium">{formData.rangeRent}</span>
              </p>
            </div>
            </div>

            {estimatedBreakdown && (
  <div className="col-span-2 grid grid-cols-2 mt-2 gap-x-4">
       <div>
              <p className="text-sm text-gray-600">Deposit</p>
              <p className="font-medium">
                Rp {formData.deposit.toLocaleString()}
              </p>
            </div>
   

    <div className="relative">
      <p className="text-sm text-gray-500">Total Pembayaran</p>
      <div className="flex items-center gap-1 text-lg font-semibold text-gray-800">
        Rp {estimatedBreakdown.grandTotalAfterDiscount.toLocaleString()}
        <details className="relative">
          <summary className="ml-1 cursor-pointer text-orange-600 text-base list-none">▾</summary>
          <div className="absolute right-0 mt-2 w-[280px] bg-orange-50 border border-orange-200 rounded-lg p-4 shadow-xl text-sm text-gray-800 space-y-1 z-50">
            <p className="font-semibold">{estimatedBreakdown.label} disewa Selama {formData.rangeRent} {estimatedBreakdown.durationLabel}</p>
            <p>Harga Sewa Mobil: Rp {estimatedBreakdown.rate.toLocaleString()} x {formData.rangeRent} = Rp {estimatedBreakdown.rentalCost.toLocaleString()}</p>
            
            {formData.deposit && (
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
            {formData.needsDriver && (
              <p>Biaya Jemput: Rp {estimatedBreakdown.pickupFee.toLocaleString()}</p>
            )}
            {/* <p className="font-semibold">Grand Total: Rp {estimatedBreakdown.grandTotal.toLocaleString()}</p> */}
            <hr className="my-2 border-orange-300" />
            <p className="font-medium sm:font-bold">Total Sebelum Diskon: Rp {estimatedBreakdown.grandTotalBeforeDiscount.toLocaleString()}</p>

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
        </details>
      </div>
    </div>
  </div>
)}


          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Penyewa</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Nama</p>
              <p className="font-medium">{identityData.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Whatsapp</p>
              <p className="font-medium">{identityData.whatsapp}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Alamat</p>
              <p className="font-medium">{identityData.address}</p>
            </div>
            {(identityData.identityType === 'corporate' ||
                identityData.identity_type === 'corporate' ||
                formData.identityType === 'corporate') && (
                <div>
                  <p className="text-sm text-gray-600">Alamat Perusahaan</p>
                  <p className="font-medium">
                    {identityData.companyAddress ?? identityData.company_address ?? '-'}
                  </p>
                </div>
              )}
              <div>
              <p className="text-sm text-gray-600">Tipe Identitas</p>
              <p className="font-medium">
                {formatIdentityType(identityData.identityType ?? identityData.identity_type ?? formData.identityType ?? '')}
              </p>
              </div>
          </div>

          {uploadedFiles.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Dokumen yang Diupload</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {uploadedFiles.map(({ label, file }, index) => (
                  <div key={index} className="space-y-2">
                    <ImagePreview file={file} label={label} />
                    <p className="text-xs text-gray-600">{documentLabels[label.replace(/\s+/g, '').toLowerCase() + 'File'] || label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 flex space-x-4">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
        >
          Kembali
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="flex-1 px-5 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-xl shadow-md hover:from-orange-600 hover:to-yellow-600"
        >
          Submit
        </button>
      </div>
    </div>
  );
};

export default BookingConfirmation;