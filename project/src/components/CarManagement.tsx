import { useRef } from 'react';
import { useEffect, useMemo, useState } from 'react';
import CarFormModal from './CarFormModal';
import EditCarFormModal from "./EditCarFormModal";
import DeleteCarModal from "./DeleteCarModal";
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import { Pencil, Trash, Search, Eye, Car} from "lucide-react";
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

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

const CarManagement = () => {
  const [cars, setCars] = useState<Car[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [carToView, setCarToView] = useState<Car | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [carToDelete, setCarToDelete] = useState<Car | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const pageSize = 10;

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const scrollPos = useRef({ left: 0, top: 0 });


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

  // Setup drag functionality after data is loaded and component is mounted
  useEffect(() => {
    // Wait for next tick to ensure DOM is ready
    const timer = setTimeout(() => {
      const container = tableContainerRef.current;
      if (!container) {
        console.log('Container still not found after timeout');
        return;
      }

      console.log('Setting up drag handlers for container:', container);

      const handleMouseDown = (e: MouseEvent) => {
        console.log('Mouse down detected on:', e.target);
        
        // Skip drag if clicking on interactive elements
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'BUTTON' ||
          target.tagName === 'INPUT' ||
          target.tagName === 'IMG' ||
          target.closest('button') ||
          target.closest('.swiper') ||
          target.closest('input') ||
          target.closest('img')
        ) {
          console.log('Skipping drag - interactive element:', target.tagName);
          return;
        }

        e.preventDefault();
        isDragging.current = true;
        
        startPos.current = {
          x: e.clientX,
          y: e.clientY
        };
        
        scrollPos.current = {
          left: container.scrollLeft,
          top: container.scrollTop
        };

        container.style.cursor = 'grabbing';
        container.style.userSelect = 'none';
        
        console.log('Drag started', { 
          startPos: startPos.current, 
          scrollPos: scrollPos.current,
          target: target.tagName 
        });
      };

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current) return;
        
        e.preventDefault();
        
        const deltaX = e.clientX - startPos.current.x;
        const deltaY = e.clientY - startPos.current.y;
        
        container.scrollLeft = scrollPos.current.left - deltaX;
        container.scrollTop = scrollPos.current.top - deltaY;
        
        console.log('Dragging', { deltaX, deltaY, scrollLeft: container.scrollLeft, scrollTop: container.scrollTop });
      };

      const handleMouseUp = () => {
        if (isDragging.current) {
          console.log('Drag ended');
        }
        isDragging.current = false;
        container.style.cursor = 'grab';
        container.style.userSelect = '';
      };

      const handleMouseLeave = () => {
        if (isDragging.current) {
          console.log('Mouse left container - ending drag');
        }
        isDragging.current = false;
        container.style.cursor = 'grab';
        container.style.userSelect = '';
      };

      // Touch events
      const handleTouchStart = (e: TouchEvent) => {
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'BUTTON' ||
          target.tagName === 'INPUT' ||
          target.tagName === 'IMG' ||
          target.closest('button') ||
          target.closest('.swiper') ||
          target.closest('input') ||
          target.closest('img')
        ) {
          return;
        }

        const touch = e.touches[0];
        if (!touch) return;
        
        isDragging.current = true;
        
        startPos.current = {
          x: touch.clientX,
          y: touch.clientY
        };
        
        scrollPos.current = {
          left: container.scrollLeft,
          top: container.scrollTop
        };
        
        console.log('Touch drag started');
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (!isDragging.current) return;
        
        e.preventDefault();
        
        const touch = e.touches[0];
        if (!touch) return;
        
        const deltaX = touch.clientX - startPos.current.x;
        const deltaY = touch.clientY - startPos.current.y;
        
        container.scrollLeft = scrollPos.current.left - deltaX;
        container.scrollTop = scrollPos.current.top - deltaY;
      };

      const handleTouchEnd = () => {
        if (isDragging.current) {
          console.log('Touch drag ended');
        }
        isDragging.current = false;
      };

      // Set initial styles
      container.style.cursor = 'grab';

      // Add event listeners
      container.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      container.addEventListener('mouseleave', handleMouseLeave);

      container.addEventListener('touchstart', handleTouchStart, { passive: false });
      container.addEventListener('touchmove', handleTouchMove, { passive: false });
      container.addEventListener('touchend', handleTouchEnd);

      console.log('Event listeners added successfully');

      // Cleanup function
      return () => {
        console.log('Cleaning up event listeners');
        container.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        container.removeEventListener('mouseleave', handleMouseLeave);
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
      };
    }, 100); // Small delay to ensure DOM is ready

    return () => {
      clearTimeout(timer);
    };
  }, [cars]); // Re-run when cars data changes

  const fetchCars = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get('http://localhost:5000/cars');
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

  const paginatedCars = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCars.slice(start, start + pageSize);
  }, [filteredCars, page]);

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
      <Toaster position="top-right" />
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Manajemen Mobil</h2>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Cari nama, brand, dll..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
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
        <p className="text-gray-500">Memuat data mobil...</p>
      ) : filteredCars.length === 0 ? (
        <p className="text-gray-500">Data Mobil tidak ditemukan.</p>
      ) : (
        <>
          {/* Drag instruction */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              💡 <strong>Tips:</strong> Klik dan seret area kosong tabel (seperti header atau cell kosong) untuk menggulir horizontal/vertikal. Hindari menyeret pada tombol, gambar, atau elemen interaktif.
            </p>
          </div>

          <div 
            ref={tableContainerRef} 
            className="overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg select-none"
            style={{ 
              touchAction: 'none', 
              maxHeight: '75vh',
              cursor: 'grab'
            }}
          >
            <table className="min-w-[1500px] bg-white">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">No</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Nama Mobil</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Brand</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Tipe</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Transmisi</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Bahan Bakar</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Harian</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Bulanan</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Deposit</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Jumlah Mobil</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Gambar</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedCars.map((car, idx) => (
                  <tr key={car.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">{(page - 1) * pageSize + idx + 1}</td>
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
                    <td className="px-6 py-4 text-sm text-center">{car.quantity}</td>
                    <td className="px-6 py-4 text-center">
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
                              modules={[Autoplay, Pagination]}
                              autoplay={{ delay: 2000, disableOnInteraction: false }}
                              pagination={{ clickable: true }}
                              spaceBetween={5}
                              slidesPerView={1}
                              className="w-24 h-16 mx-auto rounded custom-swiper"
                            >
                              {imageList.map((img, idx) => (
                                <SwiperSlide key={idx}>
                                  <img
                                    src={`http://localhost:5000/uploads/${img}`}
                                    alt={`Slide ${idx + 1}`}
                                    onClick={() => setPreviewImage(`http://localhost:5000/uploads/${img}`)}
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

                    <td className="px-6 py-4 text-sm text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleView(car)}
                          className="text-orange-500 hover:text-orange-600 hover:scale-110 transition-transform"
                          title="Lihat Detail"
                        >
                          <Eye size={18} />
                        </button>
                        <button onClick={() => handleEdit(car)} className="text-blue-500 hover:text-blue-700 hover:scale-110 transition-transform">
                          <Pencil size={18} />
                        </button>
                        <button onClick={() => handleDeleteClick(car)} className="text-red-500 hover:text-red-700 hover:scale-110 transition-transform">
                          <Trash size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {previewImage && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70"
              onClick={() => setPreviewImage(null)}
            >
              <img
                src={previewImage}
                alt="Preview"
                className="max-w-3xl max-h-[80vh] rounded shadow-lg border-4 border-white"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-600">
              Menampilkan {paginatedCars.length} dari {filteredCars.length} data mobil
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className={`px-3 py-1 rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-100 ${
                  page === 1 ? 'opacity-50 cursor-allowed' : ''
                }`}
              >
                «
              </button>
              {Array.from({ length: Math.ceil(filteredCars.length / pageSize) }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`px-3 py-1 rounded ${
                    page === i + 1 ? 'bg-orange-500 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= Math.ceil(filteredCars.length / pageSize)}
                className="px-3 py-1 rounded bg-white text-gray-700 border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
              >
                »
              </button>
            </div>
          </div>
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
          <div
            className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center"
            onClick={() => setCarToView(null)}
          >
            <div
              className="bg-white relative rounded-xl p-6 max-w-xl w-full shadow-2xl border border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-bold mb-4 text-black-600">Detail Mobil</h3>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-800">
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
                      <img
                        key={idx}
                        src={`http://localhost:5000/uploads/${img}`}
                        alt={`Preview ${idx + 1}`}
                        className="w-full h-32 object-cover rounded border cursor-pointer hover:opacity-80 transition"
                        onClick={() => setPreviewImageUrl(`http://localhost:5000/uploads/${img}`)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 text-right">
                <button
                  onClick={() => setCarToView(null)}
                  className="absolute top-4 right-4 text-gray-500 text-xl font-bold"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {previewImageUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black bg-opacity-70 flex items-center justify-center"
          onClick={() => setPreviewImageUrl(null)}
        >
          <img
            src={previewImageUrl}
            alt="Preview"
            className="max-w-3xl max-h-[90vh] object-contain rounded shadow-2xl border-4 border-white"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

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
      {carToDelete && (
        <DeleteCarModal
          carName={carToDelete.name}
          isOpen={true}
          isDeleting={isDeleting}
          onCancel={() => setCarToDelete(null)}
          onConfirm={async () => {
            setIsDeleting(true);
            try {
              await axios.delete(`http://localhost:5000/cars/${carToDelete.id}`, {
                data: { 
                  user_id: user?.id,
                  username: user?.username,
                }
              });
              toast.success("Data Mobil sudah dihapus!");
              fetchCars();
            } catch (error) {
              console.error(error);
              toast.error("Gagal menghapus data mobil");
            } finally {
              setCarToDelete(null);
              setIsDeleting(false);
            }
          }}
        />
      )}
    </div>
  );
};

export default CarManagement;