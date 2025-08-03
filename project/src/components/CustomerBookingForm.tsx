// FINAL FIXED CustomerBookingForm.tsx — lengkap semua field sesuai dashboard, prefill hanya Tipe Identitas
import React, { useState, useEffect, useMemo } from 'react';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import numeral from 'numeral';
import { toast } from 'react-hot-toast';

interface CustomerBookingFormProps {
  onCancel: () => void;
  onSubmit: (data: any) => void;
  initialData?: Partial<any>;
  savedData?: any; // ✅ untuk restore data dari parent
  onChange?: (data: any) => void; // ✅ untuk kirim perubahan ke parent
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
  

  const [carRates, setCarRates] = useState<any[]>([]);
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

  const estimatedBreakdown = useMemo(() => {
    const selectedCar = carRates.find((car) => car.value === formData.carType);
    if (!selectedCar || !formData.rangeRent || formData.rangeRent <= 0) return null;
    const isDaily = formData.rentalDuration === 'daily';
    const rate = isDaily ? Number(selectedCar.daily_rate) : Number(selectedCar.monthly_rate);
    const durationLabel = isDaily ? 'hari' : 'bulan';
    const rentalCost = rate * formData.rangeRent;
    const tripFee = formData.needsTrip ? formData.tripFee || 0 : 0;
    const driverFee = formData.needsDriver ? formData.driverFee || 0 : 0;
    const deliveryFee = formData.needsDelivery ? formData.deliveryFee || 0 : 0;
    const pickupFee = formData.needsPickup ? formData.pickupFee || 0 : 0;
    const deposit = formData.deposit || 0;
    const discount = formData.discount || 0;
    const discountedRentalCost = rentalCost - discount;
    const grandTotalBeforeDiscount = rentalCost + deposit + tripFee + driverFee + deliveryFee + pickupFee;
    const grandTotalAfterDiscount = discountedRentalCost + deposit + tripFee + driverFee + deliveryFee + pickupFee;
    const discountPercentage = rentalCost > 0 ? (discount / rentalCost) * 100 : 0;
    return {
      label: selectedCar.label,
      rate,
      durationLabel,
      rentalCost,
      discountedRentalCost,
      discount,
      deposit,
      discountPercentage,
      tripFee,
      driverFee,
      deliveryFee,
      pickupFee,
      grandTotalBeforeDiscount,
      grandTotalAfterDiscount,
    };
  }, [formData, carRates]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-semibold">Formulir Reorder</h3>
            <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>

          <form onSubmit={(e) => { e.preventDefault();
            const finalFormData = {
              ...formData,
              grandTotal: estimatedBreakdown?.grandTotalAfterDiscount ?? 0
            };
            onSubmit(finalFormData); }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <span className="absolute right-3 inset-y-0 flex items-center text-sm text-orange-600 font-semibold">
                  {estimatedBreakdown?.rentalCost
                    ? `${((formData.discount / estimatedBreakdown.rentalCost) * 100).toFixed(2)}%`
                    : '0%'}
                </span>
              </div>
            </div>

            <div className="col-span-2 flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Layanan Tambahan</label>
              <div className="flex gap-4">
                <label><input type="checkbox" checked={formData.needsTrip} onChange={(e) => setFormData({ ...formData, needsTrip: e.target.checked })}/> Biaya Luar Kota</label>
                <label><input type="checkbox" checked={formData.needsDriver} onChange={(e) => setFormData({ ...formData, needsDriver: e.target.checked })}/> Butuh Supir</label>
                <label><input type="checkbox" checked={formData.needsDelivery} onChange={(e) => setFormData({ ...formData, needsDelivery: e.target.checked })}/> Butuh Antar</label>
                <label><input type="checkbox" checked={formData.needsPickup} onChange={(e) => setFormData({ ...formData, needsPickup: e.target.checked })}/> Butuh Jemput</label>
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

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tujuan Sewa <span className="text-red-500">*</span></label>
              <textarea required value={formData.purpose} onChange={(e) => setFormData({ ...formData, purpose: e.target.value })} className="w-full rounded-lg border border-gray-300 px-4 py-2" />
            </div>

            <div className="col-span-2">
              {estimatedBreakdown && (
                <div className="mt-6 p-4 border border-orange-200 bg-orange-50 rounded-xl text-sm text-gray-800 space-y-1 w-full">
                  <p className="underline text-base font-bold text-black-800">Kisaran Harga</p>
                  <p className="font-semibold">{estimatedBreakdown.label} disewa Selama {formData.rangeRent} {estimatedBreakdown.durationLabel}</p>
                  <p>Harga Sewa Mobil: Rp {estimatedBreakdown.rate.toLocaleString()} x {formData.rangeRent} = Rp {estimatedBreakdown.rentalCost.toLocaleString()}</p>
                  {formData.deposit && <p>Biaya Deposit: Rp {estimatedBreakdown.deposit.toLocaleString()}</p>}
                  {formData.needsTrip && <p>Biaya Luar Kota: Rp {estimatedBreakdown.tripFee.toLocaleString()}</p>}
                  {formData.needsDriver && <p>Biaya Supir: Rp {estimatedBreakdown.driverFee.toLocaleString()}</p>}
                  {formData.needsDelivery && <p>Biaya Antar: Rp {estimatedBreakdown.deliveryFee.toLocaleString()}</p>}
                  {formData.needsPickup && <p>Biaya Jemput: Rp {estimatedBreakdown.pickupFee.toLocaleString()}</p>}
                  <hr className="my-2 border-orange-300" />
                  <p className="font-medium">Total Sebelum Diskon: Rp {estimatedBreakdown.grandTotalBeforeDiscount.toLocaleString()}</p>
                  {estimatedBreakdown.discount > 0 && (
                    <>
                      <p>Diskon: - Rp {estimatedBreakdown.discount.toLocaleString()} / <span className="font-semibold">{estimatedBreakdown.discountPercentage.toFixed(2)}%</span></p>
                      <p className="font-bold text-orange-700">Total Setelah Diskon: Rp {estimatedBreakdown.grandTotalAfterDiscount.toLocaleString()}</p>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="col-span-2 flex justify-end gap-4 mt-6">
              <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-300 rounded-lg">Batal</button>
              <button type="submit" className="px-4 py-2 bg-orange-500 text-white rounded-lg">Lanjut</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CustomerBookingForm;
