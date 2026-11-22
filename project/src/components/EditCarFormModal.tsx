// EditCarFormModal.tsx
import { Fragment, useEffect, useRef, useState } from "react";
import axios from "axios";
import toast from 'react-hot-toast';
import { fileUrl } from "../lib/fileUrl";
import { notifyError, notifySuccess } from "../lib/notify";
import { ImageDialog, Modal, ModalButton } from "./ui/Modal";

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
  const [formData, setFormData] = useState<Car>({ ...car });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [popupImage, setPopupImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);


  const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

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

      notifySuccess("Mobil berhasil diperbarui.");
      onSuccess();
    } catch (err) {
      console.error("Gagal mengubah data mobil", err);
      notifyError(err, "Mobil gagal diperbarui");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Edit Data Mobil"
      size="lg"
      busy={isSubmitting}
      footer={
        <>
          <ModalButton onClick={onClose} disabled={isSubmitting}>Batal</ModalButton>
          <ModalButton variant="primary" onClick={handleSubmit} busy={isSubmitting} busyLabel="Menyimpan...">
            Simpan
          </ModalButton>
        </>
      }
    >
                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}>
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


                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                            src={fileUrl(img)}
                            alt={`Image ${idx + 1}`}
                            className="w-full h-32 object-cover border rounded cursor-pointer hover:opacity-80"
                            onClick={() => setPopupImage(fileUrl(img) ?? null)}
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

                <ImageDialog src={popupImage} alt="Gambar mobil" onClose={() => setPopupImage(null)} />
    </Modal>
  );
};

export default EditCarFormModal;
