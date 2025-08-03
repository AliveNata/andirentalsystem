// ReorderDashboardModal.tsx
import React, { useEffect, useState } from 'react';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

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

interface ReorderDashboardModalProps {
  initialData: Partial<Customer>;
  onBack: () => void;
  onSubmit: (formData: Partial<Customer>) => void;
}

const ReorderDashboardModal: React.FC<ReorderDashboardModalProps> = ({
  initialData,
  onBack,
  onSubmit,
}) => {
  const [formData, setFormData] = useState<Partial<Customer>>({
    name: '',
    email: '',
    whatsapp: '',
    address: '',
    identity_type: '',
    company_address: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        email: initialData.email || '',
        whatsapp: initialData.whatsapp || '',
        address: initialData.address || '',
        identity_type: initialData.identity_type || '',
        company_address: initialData.company_address || '',
      });
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-xl p-6 shadow-lg">
        <h2 className="text-xl font-bold mb-4">Formulir Reorder</h2>

        <form>
          <div className="grid grid-cols-1 gap-4">
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
              <select value={formData.identity_type} disabled className="w-full rounded-lg border border-gray-300 px-4 py-2 bg-gray-100 cursor-not-allowed">
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
                value={formData.rental_duration}
                onChange={(e) => setFormData({ ...formData, rental_duration: e.target.value, range_rent: 0 })}
                className="w-full rounded-lg border border-grey-500 px-4 py-2"
              >
                <option value="">Pilih Durasi</option>
                <option value="daily">Harian</option>
                <option value="monthly">Bulanan</option>
              </select>
            </div>

          {formData.rental_duration && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Berapa Lama? <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                value={formData.range_rent}
                onChange={(e) =>
                  setFormData({ ...formData, range_rent: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                placeholder={`Contoh: 3 ${formData.rental_duration === 'daily' ? 'hari' : 'bulan'}`}
                required
              />
              <p className="text-sm text-gray-500">
                {formData.rental_duration === 'daily' ? 'Hari' : 'Bulan'}
              </p>
            </div>
          )}

            <div>
              <label className="block text-sm font-medium text-gray-700">Alamat Tempat Tinggal</label>
              <input
                name="address"
                type="text"
                value={formData.address}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-lg"
              />
            </div>

            {formData.identity_type === 'corporate' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Alamat Tempat Tinggal Perusahaan</label>
                <input
                  name="company_address"
                  type="text"
                  value={formData.company_address}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-4">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
            >
              Kembali
            </button>
            <button
              type="button"
              onClick={() => onSubmit(formData)}
              className="px-4 py-2 rounded bg-orange-500 text-white hover:bg-orange-600"
            >
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReorderDashboardModal;
