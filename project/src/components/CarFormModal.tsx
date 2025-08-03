import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Dialog } from '@headlessui/react';

export interface CarData {
  name: string;
  brand: string;
  type: string;
  transmission: string;
  fuel: string;
  seats: number;
  daily_rate: number;
  monthly_rate: number;
  deposit: number;
  quantity: number;
  image: string | string[];
}

export interface Car extends CarData {
  id: number;
}

interface CarFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Car;
}

const CarFormModal: React.FC<CarFormModalProps> = ({ isOpen, onClose, onSuccess, initialData }) => {
  const defaultFormData = {
    name: '', brand: '', type: '', transmission: '', fuel: '',
    seats: '', daily_rate: '', monthly_rate: '', deposit: '', quantity: '', image: [] as File[]
  };

  type CarFormState = typeof defaultFormData;
  const [formData, setFormData] = useState<CarFormState>(defaultFormData);
  const [carColors, setCarColors] = useState<string[]>([]);
  const [licensePlates, setLicensePlates] = useState<string[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImagePreviews, setExistingImagePreviews] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});

  const API_BASE_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    const qty = Number(formData.quantity);
    if (isNaN(qty) || qty < 0) return;
    setCarColors((prev) => Array(qty).fill('').map((_, i) => prev[i] || ''));
    setLicensePlates((prev) => Array(qty).fill('').map((_, i) => prev[i] || ''));
  }, [formData.quantity]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        seats: initialData.seats.toString(),
        daily_rate: initialData.daily_rate.toString(),
        monthly_rate: initialData.monthly_rate.toString(),
        deposit: initialData.deposit.toString(),
        quantity: initialData.quantity.toString(),
        image: [],
      });

      let images: string[] = [];

      if (Array.isArray(initialData.image)) {
        images = initialData.image;
      } else if (typeof initialData.image === 'string') {
        try {
          const parsed = JSON.parse(initialData.image);
          images = Array.isArray(parsed) ? parsed : [initialData.image];
        } catch {
          images = [initialData.image];
        }
      }

      const imageUrls = images.map(img => `${API_BASE_URL.replace(/\/$/, '')}/uploads/${img}`);
      setExistingImagePreviews(imageUrls);
    } else {
      setFormData(defaultFormData);
      setImagePreviews([]);
      setExistingImagePreviews([]);
    }
  }, [initialData, isOpen]);

  const refs = {
    name: useRef<HTMLInputElement>(null),
    brand: useRef<HTMLInputElement>(null),
    type: useRef<HTMLInputElement>(null),
    seats: useRef<HTMLInputElement>(null),
    daily_rate: useRef<HTMLInputElement>(null),
    monthly_rate: useRef<HTMLInputElement>(null),
    deposit: useRef<HTMLInputElement>(null),
    quantity: useRef<HTMLInputElement>(null),
    image: useRef<HTMLInputElement>(null),
  };

  const validate = () => {
    const newErrors: { [key: string]: boolean } = {};
    const requiredFields = ['name', 'brand', 'type', 'transmission', 'fuel', 'seats', 'daily_rate', 'monthly_rate', 'deposit', 'quantity'];
    const fieldLabels: { [key: string]: string } = {
      name: "Nama Mobil", brand: "Brand", type: "Tipe Mobil", transmission: "Transmisi",
      fuel: "Bahan Bakar", seats: "Jumlah Kursi", daily_rate: "Harga Harian",
      monthly_rate: "Harga Bulanan", deposit: "Deposit", quantity: "Jumlah Mobil", image: "Gambar"
    };

    for (const key of requiredFields) {
      const value = formData[key as keyof typeof formData];
      if (!value) {
        newErrors[key] = true;
        toast.error(`Field "${fieldLabels[key]}" harus diisi, tidak boleh kosong.`);
      }
    }

    if (!formData.image.length && !initialData) {
      newErrors.image = true;
      toast.error(`Field "${fieldLabels.image}" harus diisi, tidak boleh kosong.`);
    }

    if (formData.image.length > 0) {
      for (const file of formData.image) {
        const sizeOK = file.size <= 2.5 * 1024 * 1024;
        const typeOK = ["image/jpeg", "image/jpg"].includes(file.type.toLowerCase());
        if (!sizeOK) toast.error("Ukuran maksimal 2.5 MB");
        if (!typeOK) toast.error("Format gambar harus JPG/JPEG");
        if (!sizeOK || !typeOK) newErrors.image = true;
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      const first = Object.keys(newErrors)[0];
      refs[first as keyof typeof refs]?.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    return true;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target;
    const { name, value } = target;

    if (['quantity', 'daily_rate', 'monthly_rate', 'deposit'].includes(name)) {
      const newValue = Number(value);
      if (newValue < 0) return;
    }

    if (name === 'image' && target instanceof HTMLInputElement && target.files) {
      const selectedFiles = Array.from(target.files).slice(0, 4);
      setFormData(prev => ({ ...prev, image: selectedFiles as File[] }));
      const previews = selectedFiles.map(file => URL.createObjectURL(file));
      setImagePreviews(previews);
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const currentUserId = currentUser.id;
    if (!currentUserId) {
      alert('User belum login. Tidak bisa menyimpan data.');
      return;
    }

    const data = new FormData();
    data.append('name', formData.name);
    data.append('brand', formData.brand);
    data.append('type', formData.type);
    data.append('transmission', formData.transmission);
    data.append('fuel', formData.fuel);
    data.append('seats', String(Number(formData.seats)));
    data.append('daily_rate', String(Number(formData.daily_rate)));
    data.append('monthly_rate', String(Number(formData.monthly_rate)));
    data.append('deposit', String(Number(formData.deposit)));
    data.append('quantity', String(Number(formData.quantity)));
    formData.image.forEach(file => data.append('image', file));
    data.append('colors', JSON.stringify(carColors));
    data.append('plates', JSON.stringify(licensePlates));
    data.append('created_by', currentUser.username);
    data.append('user_id', currentUserId);

    try {
      if (initialData) {
        await toast.promise(
          axios.put(`${API_BASE_URL.replace(/\/$/, '')}/cars/${initialData.id}`, data),
          {
            loading: 'Memperbarui data...',
            success: 'Data mobil berhasil diperbarui!',
            error: 'Gagal memperbarui data.',
          }
        );
      } else {
        await toast.promise(
          axios.post(`${API_BASE_URL.replace(/\/$/, '')}/cars`, data),
          {
            loading: 'Menyimpan data...',
            success: 'Data mobil berhasil ditambahkan!',
            error: 'Gagal menyimpan data.',
          }
        );
      }

      onSuccess();
      onClose();
      setFormData(defaultFormData);
      setCarColors([]);
      setLicensePlates([]);
      setImagePreviews([]);
      setExistingImagePreviews([]);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="fixed z-50 inset-0">
      <div className="bg-black/40 fixed inset-0" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <Dialog.Panel className="max-h-screen overflow-y-auto bg-white w-full max-w-xl rounded-xl shadow-lg p-6">
          <Dialog.Title className="text-lg font-semibold mb-4">
            {initialData ? 'Edit Data Mobil' : 'Tambah Data Mobil'}
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="space-y-3">
            {[{ label: 'Nama Mobil', name: 'name' },
              { label: 'Brand', name: 'brand' },
              { label: 'Tipe Mobil', name: 'type' },
              { label: 'Jumlah Kursi', name: 'seats', type: 'number' },
              { label: 'Harga Harian', name: 'daily_rate', type: 'number' },
              { label: 'Harga Bulanan', name: 'monthly_rate', type: 'number' },
              { label: 'Deposit', name: 'deposit', type: 'number' },
            ].map(({ label, name, type = 'text' }) => (
            <div key={name}>
              <label className="block text-sm font-medium mb-1">{label}</label>
              <input
                type={type}
                name={name}
                ref={refs[name as keyof typeof refs]}
                value={formData[name as keyof typeof formData] as string}
                onChange={handleChange}
                onWheel={type === 'number' ? (e) => e.currentTarget.blur() : undefined}
                min={type === 'number' ? 0 : undefined}
                step={type === 'number' ? 1 : undefined}
                className={`w-full border px-3 py-2 rounded ${errors[name] ? 'border-red-500' : 'border-gray-300'}`}
              />
            </div>
            ))}

            <div>
              <label className="block text-sm font-medium mb-1">Jumlah Mobil</label>
              <input
                type="number"
                name="quantity"
                ref={refs.quantity}
                value={formData.quantity}
                onChange={handleChange}
                min="0"
                className={`w-full border px-3 py-2 rounded ${errors.quantity ? 'border-red-500' : 'border-gray-300'}`}
              />
            </div>

            {carColors.map((_, index) => (
              <div key={index} className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Warna Mobil {index + 1}</label>
                  <input
                    type="text"
                    value={carColors[index]}
                    onChange={(e) => {
                      const updated = [...carColors];
                      updated[index] = e.target.value;
                      setCarColors(updated);
                    }}
                    className="w-full border px-3 py-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Nomor Lisensi Plat {index + 1}</label>
                  <input
                    type="text"
                    value={licensePlates[index]}
                    onChange={(e) => {
                      const updated = [...licensePlates];
                      updated[index] = e.target.value;
                      setLicensePlates(updated);
                    }}
                    className="w-full border px-3 py-2 rounded"
                  />
                </div>
              </div>
            ))}

            <div>
              <label className="block text-sm font-medium mb-1">Transmisi</label>
              <select
                name="transmission"
                value={formData.transmission}
                onChange={handleChange}
                className={`w-full border px-3 py-2 rounded ${errors.transmission ? 'border-red-500' : 'border-gray-300'}`}
              >
                <option value="">Pilih Transmisi</option>
                <option value="Manual">Manual</option>
                <option value="Automatic">Automatic</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Bahan Bakar</label>
              <select
                name="fuel"
                value={formData.fuel}
                onChange={handleChange}
                className={`w-full border px-3 py-2 rounded ${errors.fuel ? 'border-red-500' : 'border-gray-300'}`}
              >
                <option value="">Pilih Bahan Bakar</option>
                <option value="Bensin">Bensin</option>
                <option value="Solar">Solar</option>
                <option value="Listrik">Listrik</option>
              </select>
            </div>

            <label className="block text-sm font-medium mb-1">Upload Gambar (Max 2.5 MB, JPG/JPEG, Max 4 Gambar)</label>
            <input
              type="file"
              name="image"
              ref={refs.image}
              accept=".jpg,.jpeg"
              multiple
              onChange={handleChange}
              className={`w-full ${errors.image ? 'border-red-500' : 'border-gray-300'}`}
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[...existingImagePreviews, ...imagePreviews].map((src, idx) => (
                <img
                  key={idx}
                  src={src}
                  alt={`Preview ${idx + 1}`}
                  className="w-32 h-20 object-cover border rounded"
                />
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-xl hover:from-orange-600 hover:to-yellow-600"
              >
                Simpan
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default CarFormModal;
