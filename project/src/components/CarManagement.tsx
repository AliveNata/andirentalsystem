import { useEffect, useMemo, useState } from 'react';
import CarFormModal from './CarFormModal';
import EditCarFormModal from "./EditCarFormModal";
import DeleteCarModal from "./DeleteCarModal";
import axios from 'axios';
import { fileUrl } from '../lib/fileUrl';
import { notifyError, notifySuccess } from '../lib/notify';
import { ImageDialog, Modal } from './ui/Modal';
import { Pencil, Trash, Search, Eye, Car} from "lucide-react";
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination as SwiperPagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import Pagination from './ui/Pagination';
import { ScrollableTable, TABLE_HEAD_CLASS, Th } from './ui/DataTable';
import { usePagination } from '../lib/usePagination';

interface Car {
  id: number;
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
  colors?: string[];
  plates?: string[];
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

const CarManagement = () => {
  const [cars, setCars] = useState<Car[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [carToView, setCarToView] = useState<Car | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [carToDelete, setCarToDelete] = useState<Car | null>(null);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const pageSize = 10;

  const formatDateTime = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    };

    const date = new Date(dateString);
    const datePart = date.toLocaleDateString('id-ID', options);
    const timePart = date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return `${datePart} pukul ${timePart}`;
  };

  const formatCurrency = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

  const fetchCars = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/cars`);
      setCars(res.data);
    } catch (err) {
      console.error('Error fetching cars:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCars();
  }, []);

  const filteredCars = useMemo(() => {
    let filtered = cars.filter(car =>
      Object.values(car).some(val =>
        String(val).toLowerCase().includes(search.toLowerCase())
      )
    );
    return filtered;
  }, [cars, search]);

  const {
    page,
    setPage,
    totalPages,
    pageItems: paginatedCars,
    startIndex,
  } = usePagination(filteredCars, pageSize, search);

  const handleView = (car: Car) => {
    setCarToView(car);
  };

  const handleEdit = (car: Car) => {
    setSelectedCar(car);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (car: Car) => {
    setCarToDelete(car);
  };

  const [previewImage, setPreviewImage] = useState<string | null>(null);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Manajemen Mobil</h2>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Cari nama, brand, dll..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-64 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:from-orange-600 hover:to-yellow-600"
          >
            <Car size={20} />
            <span>Tambah Data Mobil</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-600">Memuat data mobil...</p>
      ) : filteredCars.length === 0 ? (
        <p className="text-gray-600">
          {search.trim()
            ? `Tidak ada mobil yang cocok dengan "${search.trim()}".`
            : 'Belum ada data mobil. Tambahkan lewat tombol Tambah Data Mobil.'}
        </p>
      ) : (
        <>
          <ScrollableTable label="Tabel data mobil" dragIgnore=".swiper">
            <table className="min-w-[1500px] w-full bg-white">
              <thead className={TABLE_HEAD_CLASS}>
                <tr>
                  <Th>#</Th>
                  <Th>Nama Mobil</Th>
                  <Th>Brand</Th>
                  <Th>Tipe</Th>
                  <Th>Transmisi</Th>
                  <Th>Bahan Bakar</Th>
                  <Th align="right">Harian</Th>
                  <Th align="right">Bulanan</Th>
                  <Th align="right">Deposit</Th>
                  <Th align="right">Jumlah Mobil</Th>
                  <Th>Gambar</Th>
                  <Th>Aksi</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedCars.map((car, idx) => (
                  <tr key={car.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-600 tabular-nums">{startIndex + idx + 1}</td>
                    <td className="px-6 py-4 text-sm">{car.name}</td>
                    <td className="px-6 py-4 text-sm">{car.brand}</td>
                    <td className="px-6 py-4 text-sm">{car.type}</td>
                    <td className="px-6 py-4 text-sm">{car.transmission}</td>
                    <td className="px-6 py-4 text-sm">{car.fuel}</td>
                    <td className="px-6 py-4 text-sm text-right">
                      {car.daily_rate ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(car.daily_rate) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      {car.monthly_rate ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(car.monthly_rate) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      {car.deposit ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(car.deposit) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-right tabular-nums">{car.quantity}</td>
                    <td className="px-6 py-4">
                      {(() => {
                        let imageList: string[] = [];

                        try {
                          if (Array.isArray(car.image)) {
                            imageList = car.image;
                          } else if (
                            typeof car.image === 'string' &&
                            car.image.trim().startsWith('[')
                          ) {
                            imageList = JSON.parse(car.image);
                          } else if (typeof car.image === 'string') {
                            imageList = [car.image];
                          }
                        } catch (err) {
                          console.error('Failed to parse image array:', err);
                          imageList = [];
                        }

                        return imageList.length > 0 ? (
                          <div className="swiper">
                            <Swiper
                              modules={[Autoplay, SwiperPagination]}
                              autoplay={{ delay: 2000, disableOnInteraction: false }}
                              pagination={{ clickable: true }}
                              spaceBetween={5}
                              slidesPerView={1}
                              className="w-24 h-16 rounded custom-swiper"
                            >
                              {imageList.map((img, idx) => (
                                <SwiperSlide key={idx}>
                                  <img
                                    src={fileUrl(img)}
                                    alt={`Slide ${idx + 1}`}
                                    onClick={() => setPreviewImage(fileUrl(img) ?? null)}
                                    className="w-full h-full object-cover rounded border cursor-pointer hover:opacity-90 transition"
                                  />
                                </SwiperSlide>
                              ))}
                            </Swiper>
                          </div>
                        ) : (
                          <div className="text-gray-400 italic text-sm">Tidak ada gambar</div>
                        );
                      })()}
                    </td>

                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleView(car)}
                          className="text-orange-500 hover:text-orange-600 hover:scale-110 transition-transform"
                          title="Lihat Detail"
                        >
                          <Eye size={18} />
                        </button>
                        <button onClick={() => handleEdit(car)} title="Ubah" aria-label={`Ubah ${car.name}`} className="text-blue-500 hover:text-blue-700 hover:scale-110 transition-transform">
                          <Pencil size={18} />
                        </button>
                        <button onClick={() => handleDeleteClick(car)} title="Hapus" aria-label={`Hapus ${car.name}`} className="text-red-500 hover:text-red-700 hover:scale-110 transition-transform">
                          <Trash size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>

          <ImageDialog src={previewImage} alt="Gambar mobil" onClose={() => setPreviewImage(null)} />

          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={filteredCars.length}
            pageCount={paginatedCars.length}
            startIndex={startIndex}
            onPageChange={setPage}
            itemLabel="data mobil"
          />
        </>
      )}

      {/* Modal Detail Mobil */}
      {carToView && (() => {
        const images: string[] = (() => {
          if (!carToView) return [];
          try {
            if (Array.isArray(carToView.image)) return carToView.image;
            if (
              typeof carToView.image === 'string' &&
              carToView.image.trim().startsWith('[')
            ) {
              return JSON.parse(carToView.image);
            }
            if (typeof carToView.image === 'string') return [carToView.image];
          } catch (e) {
            console.error("Failed to parse images", e);
          }
          return [];
        })();

        return (
          <Modal open onClose={() => setCarToView(null)} title="Detail Mobil" size="md">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-800">
                <p><strong>Nama Mobil:</strong> {carToView.name}</p>
                <p><strong>Brand:</strong> {carToView.brand}</p>
                <p><strong>Tipe Mobil:</strong> {carToView.type}</p>
                <p><strong>Transmisi:</strong> {carToView.transmission}</p>
                <p><strong>Bahan Bakar:</strong> {carToView.fuel}</p>
                <p><strong>Jumlah Kursi:</strong> {carToView.seats ?? '-'}</p>
                <div className="text-sm text-gray-800">
                  <p className="font-semibold">Warna Mobil:</p>
                  <ul className="list-inside ml-2">
                    {(() => {
                      try {
                        let colors: string[] = [];

                        if (Array.isArray(carToView.colors)) {
                          colors = carToView.colors;
                        } else if (
                          typeof carToView.colors === 'string' &&
                          (carToView.colors as string).trim().startsWith('[')
                        ) {
                          colors = JSON.parse(carToView.colors as string);
                        } else if (typeof carToView.colors === 'string') {
                          colors = [carToView.colors];
                        }

                        return colors.length > 0
                          ? colors.map((c: string, i: number) => (
                              <li key={i}>Warna Mobil {i + 1}: {c}</li>
                            ))
                          : <li>-</li>;
                      } catch (err) {
                        return <li>-</li>;
                      }
                    })()}
                  </ul>
                </div>

                <div className="text-sm text-gray-800">
                  <p className="font-semibold">Nomor Lisensi:</p>
                  <ul className="list-inside ml-2">
                    {(() => {
                      try {
                        let plates: string[] = [];

                        if (Array.isArray(carToView.plates)) {
                          plates = carToView.plates;
                        } else if (
                          typeof carToView.plates === 'string' &&
                          (carToView.plates as string).trim().startsWith('[')
                        ) {
                          plates = JSON.parse(carToView.plates as string);
                        } else if (typeof carToView.plates === 'string') {
                          plates = [carToView.plates];
                        }

                        return plates.length > 0
                          ? plates.map((p: string, i: number) => (
                              <li key={i}>Nomor Lisensi {i + 1}: {p}</li>
                            ))
                          : <li>-</li>;
                      } catch (err) {
                        return <li>-</li>;
                      }
                    })()}
                  </ul>
                </div>
                <p><strong>Harga Harian:</strong> {carToView.daily_rate ? formatCurrency(carToView.daily_rate) : '-'}</p>
                <p><strong>Harga Bulanan:</strong> {carToView.monthly_rate ? formatCurrency(carToView.monthly_rate) : '-'}</p>
                <p><strong>Deposit:</strong> {carToView.deposit ? formatCurrency(carToView.deposit) : '-'}</p>
                <p><strong>Jumlah Mobil:</strong> {carToView.quantity}</p>
                <p><strong>Dibuat:</strong> {carToView.created_at ? formatDateTime(carToView.created_at) : '-'}</p>
                <p><strong>Dibuat Oleh:</strong> {carToView.created_by || '-'}</p>
                <p><strong>Diedit:</strong> {carToView.updated_at ? formatDateTime(carToView.updated_at) : '-'}</p>
                <p><strong>Diedit Oleh:</strong> {carToView.updated_by || '-'}</p>
              </div>

              {/* Gambar di bawah detail */}
              {images.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-gray-600 mb-2">Gambar Mobil:</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {images.map((img: string, idx: number) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPreviewImageUrl(fileUrl(img) ?? null)}
                        aria-label={`Perbesar gambar ${idx + 1}`}
                        className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2"
                      >
                        <img
                          src={fileUrl(img)}
                          alt={`Preview ${idx + 1}`}
                          className="w-full h-32 object-cover rounded border hover:opacity-80 transition"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <ImageDialog src={previewImageUrl} alt={`Gambar ${carToView.name}`} onClose={() => setPreviewImageUrl(null)} />
          </Modal>
        );
      })()}

      {/* Modal Tambah Mobil */}
      <CarFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          fetchCars();
          setIsAddModalOpen(false);
        }}
      />

      {/* Modal Edit Mobil */}
      {selectedCar && (
        <EditCarFormModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedCar(null);
          }}
          onSuccess={() => {
            fetchCars();
            setIsEditModalOpen(false);
            setSelectedCar(null);
          }}
          car={selectedCar}
        />
      )}

      {/* Modal Hapus Mobil */}
      <DeleteCarModal
        carName={carToDelete?.name ?? ''}
        isOpen={!!carToDelete}
        onCancel={() => setCarToDelete(null)}
        onConfirm={async () => {
          if (!carToDelete) return;
          try {
            await axios.delete(`${API_BASE_URL}/cars/${carToDelete.id}`);
            notifySuccess('Mobil berhasil dihapus.');
            fetchCars();
          } catch (error) {
            console.error(error);
            notifyError(error, 'Mobil gagal dihapus');
          }
        }}
      />

    </div>
  );
};

export default CarManagement;