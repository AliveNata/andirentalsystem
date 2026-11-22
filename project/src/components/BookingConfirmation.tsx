import React, { useState, useEffect, useMemo } from 'react';
import { FileText } from 'lucide-react';
import { CarRate, BookingAmounts, BookingEstimate, DOCUMENT_LABELS, estimateBooking } from '../types';
import ImagePreview from './ImagePreview';

interface BookingConfirmationProps {
  formData: BookingAmounts & {
    email: string;
    purpose: string;
    startDate: string;
    startTime: string;
    endDate: string;
    identityType: string;
  };
  identityData: any;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

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

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

interface PriceBreakdownProps {
  estimate: BookingEstimate;
  rangeRent: number;
}

// Shared by the booking form, the reorder form and this confirmation so all three show the same total.
export const PriceBreakdown: React.FC<PriceBreakdownProps> = ({ estimate, rangeRent }) => {
  const { totals } = estimate;
  const services: [string, number][] = (
    [
      ['Biaya Luar Kota', totals.trip_fee],
      ['Biaya Supir', totals.driver_fee],
      ['Biaya Antar', totals.delivery_fee],
      ['Biaya Jemput', totals.pickup_fee],
    ] as [string, number][]
  ).filter(([, value]) => value > 0);

  return (
    <div className="space-y-1 text-sm text-gray-800">
      <p className="font-semibold">
        {estimate.label}, {rangeRent} {estimate.durationLabel}
      </p>
      <div className="flex justify-between gap-4">
        <span>
          Harga sewa ({rupiah(estimate.rate)} x {rangeRent})
        </span>
        <span className="tabular-nums">{rupiah(totals.rental_cost)}</span>
      </div>
      {totals.discount_applied > 0 && (
        <div className="flex justify-between gap-4">
          <span>Diskon ({estimate.discountPercentage.toFixed(2)}%)</span>
          <span className="tabular-nums">- {rupiah(totals.discount_applied)}</span>
        </div>
      )}
      {services.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4">
          <span>{label}</span>
          <span className="tabular-nums">{rupiah(value)}</span>
        </div>
      ))}
      <div className="flex justify-between gap-4">
        <span>
          Deposit <span className="text-gray-600">(dikembalikan setelah masa sewa)</span>
        </span>
        <span className="tabular-nums">{rupiah(totals.deposit)}</span>
      </div>
      <hr className="my-2 border-orange-300" />
      <div className="flex justify-between gap-4 text-base font-bold text-gray-900">
        <span>Total Pembayaran</span>
        <span className="tabular-nums">{rupiah(totals.grand_total)}</span>
      </div>
    </div>
  );
};

const BookingConfirmation: React.FC<BookingConfirmationProps> = ({
  formData,
  identityData,
  onBack,
  onSubmit,
  isSubmitting = false,
}) => {

  const [carRates, setCarRates] = useState<CarRate[]>([]);
  const [ratesFailed, setRatesFailed] = useState(false);

useEffect(() => {
  fetch(`${API_BASE_URL.replace(/\/$/, '')}/car-rates`)
    .then(res => {
      if (!res.ok) throw new Error(`car-rates ${res.status}`);
      return res.json();
    })
    .then(data => setCarRates(data))
    .catch(err => {
      console.error('Error fetching car rates:', err);
      setRatesFailed(true);
    });
}, []);

  const estimate = useMemo(() => estimateBooking(formData, carRates), [formData, carRates]);

  const uploadedFiles = Object.entries(identityData)
    .filter(([key, value]) => key.toLowerCase().includes('file') && value instanceof File)
    .map(([key, value]) => ({ label: DOCUMENT_LABELS[key] || key, file: value as File }));

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8">
      <div className="text-center mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Konfirmasi Booking</h2>
        <div className="mt-4">
          <p className="text-sm text-gray-600">Kode Booking</p>
          <p className="mt-1 text-sm text-gray-700">Kode booking dibuat saat booking disimpan.</p>
          <p className="text-sm text-gray-600 mt-1">
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
        <div className="bg-orange-50 p-4 sm:p-6 rounded-lg">
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
                  formData.needsTrip && 'Luar Kota',
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

            <div className="md:col-span-2 grid grid-cols-2 mt-2 gap-x-4">
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

            <div className="md:col-span-2 mt-2 rounded-lg border border-orange-200 bg-white p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Rincian Biaya</h4>
              {estimate ? (
                <PriceBreakdown estimate={estimate} rangeRent={formData.rangeRent} />
              ) : ratesFailed ? (
                <p className="text-sm text-red-700" role="alert">
                  Tarif mobil gagal dimuat, jadi total belum bisa dihitung. Kembali ke formulir lalu coba lagi.
                </p>
              ) : carRates.length === 0 ? (
                <p className="text-sm text-gray-600">Memuat tarif mobil...</p>
              ) : (
                <p className="text-sm text-red-700" role="alert">
                  Tarif untuk mobil ini tidak ditemukan. Kembali dan pilih tipe mobil lagi.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 sm:p-6 rounded-lg">
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
                {uploadedFiles.map(({ label, file }) => (
                  <div key={label} className="space-y-2">
                    {file.type === 'application/pdf' ? (
                      <div className="w-24 h-24 rounded-lg border border-gray-200 bg-white flex flex-col items-center justify-center gap-1 px-1 text-center">
                        <FileText size={24} className="text-gray-600" aria-hidden="true" />
                        <span className="text-xs text-gray-700 break-all line-clamp-2">{file.name}</span>
                      </div>
                    ) : (
                      <ImagePreview file={file} label={label} />
                    )}
                    <p className="text-xs text-gray-600">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex-1 min-h-11 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Kembali
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || !estimate}
          aria-busy={isSubmitting}
          className="flex-1 min-h-11 px-5 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-xl shadow-md hover:from-orange-600 hover:to-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Menyimpan booking...' : 'Simpan Booking'}
        </button>
      </div>
    </div>
  );
};

export default BookingConfirmation;
