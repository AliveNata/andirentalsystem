// EditCarFormModal.tsx
import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useEffect, useRef, useState } from "react";
import axios from "axios";
import toast from 'react-hot-toast';

interface Car {
  id: number;
  name: string;
  brand: string;
  type: string;
  seats: number;
  daily_rate: number;
  monthly_rate: number;
  deposit: number;
  quantity: number;
  transmission: string;
  fuel: string;
  image: string | string[];
  colors?: string[];
  plates?: string[];
}

interface EditCarFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  car: Car;
  onSuccess: () => void;
}

const EditCarFormModal: React.FC<EditCarFormModalProps> = ({
  isOpen,
  onClose,
  car,
  onSuccess,
}) => {
  const cancelButtonRef = useRef(null);
  const [formData, setFormData] = useState<Car>({ ...car });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [popupImage, setPopupImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);


  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

  const refs = {
    name: useRef<HTMLInputElement>(null),
    brand: useRef<HTMLInputElement>(null),
    type: useRef<HTMLInputElement>(null),
    seats: useRef<HTMLInputElement>(null),
    daily_rate: useRef<HTMLInputElement>(null),
    monthly_rate: useRef<HTMLInputElement>(null),
    deposit: useRef<HTMLInputElement>(null),
    quantity: useRef<HTMLInputElement>(null),
    transmission: useRef<HTMLSelectElement>(null),
    fuel: useRef<HTMLSelectElement>(null),
    image: useRef<HTMLInputElement>(null),
  };

  useEffect(() => {
    const parsedColors = typeof car.colors === "string" ? JSON.parse(car.colors) : car.colors;
    const parsedPlates = typeof car.plates === "string" ? JSON.parse(car.plates) : car.plates;

    let parsedImage: string[] | string = car.image;
    if (typeof car.image === "string") {
      try {
        const maybeArray = JSON.parse(car.image);
        parsedImage = Array.isArray(maybeArray) ? maybeArray : [car.image];
      } catch {
        parsedImage = [car.image];
      }
    }

    setFormData({
      ...car,
      colors: Array.isArray(parsedColors) ? parsedColors : [],
      plates: Array.isArray(parsedPlates) ? parsedPlates : [],
      image: parsedImage,
    }); 
    setImagePreviews([]);
    }, [car]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  if (e.target.files && e.target.files.length > 0) {
    const files = Array.from(e.target.files).slice(0, 4); // Batas maksimal 4
    setSelectedFiles(files);
    const previews = files.map((file) => URL.createObjectURL(file));
    setImagePreviews(previews);
    }
  };

  const validate = () => {
    const newErrors: { [key: string]: boolean } = {};
    const fieldLabels: { [key: string]: string } = {
      name: "Nama Mobil",
      brand: "Brand",
      type: "Tipe",
      seats: "Jumlah Kursi",
      daily_rate: "Harga Harian",
      monthly_rate: "Harga Bulanan",
      deposit: "Deposit",
      quantity: "Jumlah Mobil",
      transmission: "Transmisi",
      fuel: "Bahan Bakar",
      image: "Gambar",
    };

    for (const key in fieldLabels) {
      if (key === "image") continue;
      const value = formData[key as keyof typeof formData];
      if (!value && value !== 0) {
        newErrors[key] = true;
        toast.error(`Field "${fieldLabels[key]}" harus diisi, tidak boleh kosong.`);
      }
    }

    const noOldImage =
      !formData.image || (Array.isArray(formData.image) && formData.image.length === 0);
    const noNewFile = selectedFiles.length === 0;

    if (noOldImage && noNewFile) {
      newErrors.image = true;
      toast.error(`Field "${fieldLabels["image"]}" harus diisi, tidak boleh kosong.`);
    }

    for (const file of selectedFiles) {
      const sizeOK = file.size <= 2.5 * 1024 * 1024;
      const typeOK = ["image/jpeg", "image/jpg"].includes(file.type.toLowerCase());
      if (!sizeOK) toast.error("Ukuran maksimal gambar adalah 2.5 MB");
      if (!typeOK) toast.error("Format gambar harus JPG atau JPEG");
      if (!sizeOK || !typeOK) newErrors.image = true;
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const first = Object.keys(newErrors)[0];
      refs[first as keyof typeof refs]?.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
    try {
      setIsSubmitting(true);
      const dataToSend = new FormData();

      dataToSend.append("name", formData.name);
      dataToSend.append("brand", formData.brand);
      dataToSend.append("type", formData.type);
      dataToSend.append("seats", String(formData.seats));
      dataToSend.append("daily_rate", String(formData.daily_rate));
      dataToSend.append("monthly_rate", String(formData.monthly_rate));
      dataToSend.append("deposit", String(formData.deposit));
      dataToSend.append("quantity", String(formData.quantity));
      dataToSend.append("transmission", formData.transmission);
      dataToSend.append("fuel", formData.fuel);
      dataToSend.append("updated_by", currentUser.username);
      dataToSend.append("user_id", currentUser.id);

      console.log("Sending colors:", formData.colors);
      console.log("Sending plates:", formData.plates);

      if (formData.colors) dataToSend.append("colors", JSON.stringify(formData.colors));
      if (formData.plates) dataToSend.append("plates", JSON.stringify(formData.plates));

      selectedFiles.forEach((file) => {
        dataToSend.append("image", file);
      });

      await axios.put(`${API_BASE_URL.replace(/\/$/, "")}/cars/${formData.id}`, dataToSend, {
        withCredentials: true,
      });

      toast.success("Berhasil mengubah data mobil");
      onSuccess();
    } catch (err) {
      console.error("Gagal mengubah data mobil", err);
      toast.error("Gagal mengubah data mobil");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" initialFocus={cancelButtonRef} onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-6 pb-6 pt-5 pr-12 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl sm:p-6">

                <button
                  onClick={onClose}
                  className="absolute top-4 right-12 text-gray-500 text-xl z-50"
                  aria-label="Tutup"
                >
                  ✕
                </button>
  
                <div className="max-h-[80vh] overflow-y-auto px-6 pb-6 pt-5 sm:p-6">
                <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900 mb-4">
                  Edit Data Mobil
                </Dialog.Title>

                <form className="space-y-4">
                  {["name", "brand", "type", "seats", "daily_rate", "monthly_rate", "deposit", "quantity"].map((key) => {
                    const isNumberField = ["seats", "daily_rate", "monthly_rate", "deposit", "quantity"].includes(key);
                    return (
                      <div key={key}>
                        <label className="block text-sm font-medium text-gray-700">
                          {{
                            name: "Nama Mobil",
                            brand: "Brand",
                            type: "Tipe",
                            seats: "Jumlah Kursi",
                            daily_rate: "Harga Harian",
                            monthly_rate: "Harga Bulanan",
                            deposit: "Deposit",
                            quantity: "Jumlah Mobil",
                          }[key]}
                        </label>
                        <input
                          ref={refs[key as keyof typeof refs] as any}
                          type={isNumberField ? "number" : "text"}
                          name={key}
                          value={formData[key as keyof Car] ?? ""}
                          onChange={handleChange}
                          onWheel={isNumberField ? (e) => e.currentTarget.blur() : undefined}
                          min={isNumberField ? 0 : undefined}
                          step={isNumberField ? 1 : undefined}
                          className={`mt-1 block w-full rounded-md px-3 py-2 shadow-sm border ${
                            errors[key] ? "border-red-500" : "border-gray-300"
                          }`}
                        />
                      </div>
                    );
                   })}


                  <div className="grid grid-cols-2 gap-4">
                    {Array.from({ length: formData.quantity || 0 }).map((_, index) => (
                      <Fragment key={index}>
                        <div>
                          <label className="text-sm font-medium">Warna Mobil {index + 1}</label>
                          <input
                            type="text"
                            value={formData.colors?.[index] || ""}
                            onChange={(e) => {
                              const updated = [...(formData.colors || [])];
                              updated[index] = e.target.value;
                              setFormData((prev) => ({ ...prev, colors: updated }));
                            }}
                            className="mt-1 block w-full rounded-md px-3 py-2 border border-gray-300"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Plat Nomor {index + 1}</label>
                          <input
                            type="text"
                            value={formData.plates?.[index] || ""}
                            onChange={(e) => {
                              const updated = [...(formData.plates || [])];
                              updated[index] = e.target.value;
                              setFormData((prev) => ({ ...prev, plates: updated }));
                            }}
                            className="mt-1 block w-full rounded-md px-3 py-2 border border-gray-300"
                          />
                        </div>
                      </Fragment>
                    ))}
                  </div>

                  {["transmission", "fuel"].map((key) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-700">
                        {key === "transmission" ? "Transmisi" : "Bahan Bakar"}
                      </label>
                      <select
                        ref={refs[key as keyof typeof refs] as any}
                        name={key}
                        value={formData[key as keyof Car] as string}
                        onChange={handleChange}
                        className={`mt-1 block w-full rounded-md px-3 py-2 border ${
                          errors[key] ? "border-red-500" : "border-gray-300"
                        }`}
                      >
                        <option value="">Pilih</option>
                        {(key === "transmission" ? ["Manual", "Automatic"] : ["Bensin", "Solar", "Listrik"]).map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  ))}

                  {/* Preview Gambar Lama */}
                  {Array.isArray(formData.image) && formData.image.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Gambar Saat Ini</label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {formData.image.map((img, idx) => (
                          <img
                            key={idx}
                            src={`http://localhost:5000/uploads/${img}`}
                            alt={`Image ${idx + 1}`}
                            className="w-full h-32 object-cover border rounded cursor-pointer hover:opacity-80"
                            onClick={() => setPopupImage(`http://localhost:5000/uploads/${img}`)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upload Baru */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Upload Gambar Baru (Max 2.5 MB, JPG/JPEG, Max 4 Gambar)</label>
                    <input
                      type="file"
                      name="image"
                      accept=".jpg,.jpeg"
                      multiple
                      ref={refs.image}
                      onChange={handleFileChange}
                      className={`mt-1 block w-full ${errors.image ? "border-red-500" : "border-gray-300"}`}
                    />
                    {imagePreviews.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {imagePreviews.map((src, idx) => (
                        <img
                          key={idx}
                          src={src}
                          alt={`Preview ${idx + 1}`}
                          className="w-full h-32 object-cover border rounded"
                          onClick={() => setPopupImage(src)}
                        />
                      ))}
                    </div>
                  )}
                  </div>
                </form>

                {/* Tombol */}
                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    onClick={onClose}
                    ref={cancelButtonRef}
                    disabled={isSubmitting}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-xl hover:from-orange-600 hover:to-yellow-600"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                  >
                    Simpan
                  </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>

        {/* Preview Gambar Pop Up */}
        {popupImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={() => setPopupImage(null)}>
            <img
              src={popupImage}
              alt="Popup"
              className="max-w-3xl max-h-[90vh] rounded shadow-2xl border-4 border-white"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </Dialog>
    </Transition.Root>
  );
};

export default EditCarFormModal;
