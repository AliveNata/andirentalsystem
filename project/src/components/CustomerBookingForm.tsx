import React, { useState, useEffect, useMemo } from 'react';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import numeral from 'numeral';
import { toast } from 'react-hot-toast';
import { CarRate, estimateBooking } from '../types';
import { PriceBreakdown } from './BookingConfirmation';
import { Modal, ModalButton } from './ui/Modal';

interface CustomerBookingFormProps {
  onCancel: () => void;
  onSubmit: (data: any) => void;
  initialData?: Partial<any>;
  // Restores the form when the admin comes back from the terms or confirmation step.
  savedData?: any;
  onChange?: (data: any) => void;
}



const CustomerBookingForm: React.FC<CustomerBookingFormProps> = ({
  onCancel,
  onSubmit,
  initialData = {},
  savedData,
  onChange,
}) => {
  
const deliveryOptions = [
  25000, 50000, 75000, 100000, 125000,
  150000, 175000, 200000, 225000, 250000,
  275000, 300000
];
  
const [formData, setFormData] = useState({
  name: '',
  whatsapp: '',
  email: '',
  identityType: '',
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
  tripFee: 0,
  driverFee: 0,
  deliveryFee: 0,
  pickupFee: 0,
});

  useEffect(() => {
  if (savedData) {
    setFormData(savedData);
  } else {
    setFormData({
      name: initialData.name || '',
      whatsapp: initialData.whatsapp || '',
      email: initialData.email || '',
      identityType: initialData.identity_type || '',
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
      tripFee: 0,
      driverFee: 0,
      deliveryFee: 0,
      pickupFee: 0,
    });
  }
}, [initialData, savedData]);

useEffect(() => {
  if (onChange) {
    onChange(formData);
  }
}, [formData]);
  

  const [carRates, setCarRates] = useState<CarRate[]>([]);
  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    fetch(`${API_BASE_URL.replace(/\/$/, '')}/car-rates`)
      .then((res) => res.json())
      .then((data) => setCarRates(data));
  }, []);

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

  const calculateEndDate = (start: string, duration: number, type: 'daily' | 'monthly') => {
    const startDate = new Date(start);
    if (type === 'daily') {
      startDate.setDate(startDate.getDate() + duration);
    } else {
      startDate.setMonth(startDate.getMonth() + duration);
      startDate.setDate(startDate.getDate() - 1);
    }
    return startDate.toISOString().split('T')[0];
  };

  const estimate = useMemo(() => estimateBooking(formData, carRates), [formData, carRates]);

  return (
    <Modal
      open
      onClose={onCancel}
      title="Formulir Reorder"
      size="xl"
      footer={
        <>
          <ModalButton onClick={onCancel}>Batal</ModalButton>
          <ModalButton type="submit" form="reorder-form" variant="primary">Lanjut</ModalButton>
        </>
      }
    >
          <form id="reorder-form" onSubmit={(e) => { e.preventDefault();
            if (!estimate) {
              toast.error('Total belum bisa dihitung. Periksa tipe mobil dan lama sewa.');
              return;
            }
            // The reorder request recomputes totals from rentalCost with computeTotals.
            onSubmit({ ...formData, rentalCost: estimate.totals.rental_cost }); }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
              <input
                type="text"
                value={formData.name}
                disabled
                className="w-full rounded-lg border border-grey-500 px-4 py-2 bg-gray-100 text-gray-600 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                disabled
                className="w-full rounded-lg border border-grey-500 px-4 py-2 bg-gray-100 text-gray-600 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Whatsapp</label>
              <PhoneInput
                country="id"
                value={formData.whatsapp}
                onChange={() => {}}
                enableAreaCodes
                disabled
                inputStyle={{
                  width: '100%',
                  height: '2.5rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #d1d5db', // gray-300
                  backgroundColor: '#f3f4f6',  // gray-100
                  color: '#6b7280', // gray-600
                  cursor: 'not-allowed',
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Identitas</label>
              <select value={formData.identityType} disabled className="w-full rounded-lg border border-gray-300 px-4 py-2 bg-gray-100 cursor-not-allowed">
                <option value="single">Single</option>
                <option value="married">Menikah</option>
                <option value="corporate">Perusahaan</option>
                <option value="foreigner">WNA</option>
                <option value="reorder">Reorder</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durasi Sewa <span className="text-red-500">*</span></label>
              <select
                required
                value={formData.rentalDuration}
                onChange={(e) => setFormData({ ...formData, rentalDuration: e.target.value, rangeRent: 0 })}
                className="w-full rounded-lg border border-grey-500 px-4 py-2"
              >
                <option value="">Pilih Durasi</option>
                <option value="daily">Harian</option>
                <option value="monthly">Bulanan</option>
              </select>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Mulai <span className="text-red-500">*</span></label>
              <input type="date" required value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="w-full rounded-lg border border-gray-300 px-4 py-2" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Selesai</label>
              <input type="date" readOnly value={formData.endDate} className="w-full rounded-lg border border-gray-300 px-4 py-2 bg-gray-100" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jam Mulai</label>
              <input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} className="w-full rounded-lg border border-gray-300 px-4 py-2" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Mobil <span className="text-red-500">*</span></label>
              <select required value={formData.carType} onChange={(e) => setFormData({ ...formData, carType: e.target.value })} className="w-full rounded-lg border border-gray-300 px-4 py-2">
                <option value="">Pilih Mobil</option>
                {carRates.map((car) => (
                  <option key={car.id} value={car.value}>{car.label}</option>
                ))}
              </select>
            </div>

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

              <div>      
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

            <div className="md:col-span-2 flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Layanan Tambahan</label>
              <div className="flex flex-wrap gap-4">
                <label><input type="checkbox" checked={formData.needsTrip} onChange={(e) => setFormData({ ...formData, needsTrip: e.target.checked })}/> Biaya Luar Kota</label>
                <label><input type="checkbox" checked={formData.needsDriver} onChange={(e) => setFormData({ ...formData, needsDriver: e.target.checked })}/> Butuh Supir</label>
                <label><input type="checkbox" checked={formData.needsDelivery} onChange={(e) => setFormData({ ...formData, needsDelivery: e.target.checked })}/> Butuh Antar</label>
                <label><input type="checkbox" checked={formData.needsPickup} onChange={(e) => setFormData({ ...formData, needsPickup: e.target.checked })}/> Butuh Jemput</label>
              </div>
            </div>

           {(formData.needsTrip || formData.needsDelivery || formData.needsPickup || formData.needsDriver) && (
              <div className="flex flex-col sm:flex-row gap-4 md:col-span-2">
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
                    <select
                      value={formData.deliveryFee}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          deliveryFee: parseInt(e.target.value),
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                    >
                      <option value="">Pilih Biaya Antar</option>
                      {deliveryOptions.map((fee) => (
                        <option key={fee} value={fee}>
                          Rp {fee.toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.needsPickup && (
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pilih Biaya Jemput
                    </label>
                    <select
                      value={formData.pickupFee}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          pickupFee: parseInt(e.target.value),
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                    >
                      <option value="">Pilih Biaya Jemput</option>
                      {deliveryOptions.map((fee) => (
                        <option key={fee} value={fee}>
                          Rp {fee.toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tujuan Sewa <span className="text-red-500">*</span></label>
              <textarea required value={formData.purpose} onChange={(e) => setFormData({ ...formData, purpose: e.target.value })} className="w-full rounded-lg border border-gray-300 px-4 py-2" />
            </div>

            <div className="md:col-span-2">
              {estimate && (
                <div className="mt-6 p-4 border border-orange-200 bg-orange-50 rounded-xl w-full">
                  <p className="text-base font-bold text-gray-900 mb-2">Kisaran Harga</p>
                  <PriceBreakdown estimate={estimate} rangeRent={formData.rangeRent} />
                </div>
              )}
            </div>
          </form>
    </Modal>
  );
};

export default CustomerBookingForm;
