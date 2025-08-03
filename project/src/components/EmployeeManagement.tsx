import React, { useState, useEffect } from 'react';
import {  Edit2, Search, Trash2, AlertCircle, UserPlus } from 'lucide-react';
import axios from 'axios';
import { Eye, EyeOff } from "lucide-react";
import toast from 'react-hot-toast';

interface Employee {
  id: string;
  username: string;
  full_name: string;
  level: 'admin' | 'manajemen' | 'superadmin';
  created_at: string;
}

const EmployeeManagement: React.FC = () => {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}'); // ✅ LETAKKAN DI SINI

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    level: 'admin',
    password: '',
  });

  const canEditOrDelete = (target: { username: string; level: string }) => {
    const userLevel = currentUser?.level?.toLowerCase();
    const targetLevel = target.level?.toLowerCase();
    const sameUser = target.username === currentUser?.username;

    if (userLevel === 'superadmin') {
      return targetLevel !== 'superadmin' || sameUser;
    }

    if (userLevel === 'manajemen') {
      return targetLevel === 'admin' || sameUser;
    }

    if (userLevel === 'admin') {
      return sameUser; // hanya bisa edit/hapus dirinya sendiri
    }

    return false;
  };

  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

  interface FormErrors {
    username: string;
    full_name: string;
    password: string;
  }

  const [formErrors, setFormErrors] = useState<FormErrors>({
    username: '',
    full_name: '',
    password: '',
  });  

  const formatLevel = (level: string) => {
    switch (level) {
      case 'admin':
        return 'Admin';
      case 'superadmin':
        return 'Super Admin';
      case 'manajemen':
        return 'Manajemen';
      default:
        return level;
    }
  };
  
  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL.replace(/\/$/, '')}/employees`);
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };
  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setFormErrors({ username: '', full_name: '', password: '' });

    let hasError = false;
    const errors: { username: string; full_name: string; password: string } = {
      username: '',
      full_name: '',
      password: '',
    };

    if (/\s/.test(formData.username)) {
      toast.error('Username tidak boleh mengandung spasi!');
      hasError = true;
    }

    if (!formData.full_name.trim()) {
      errors.full_name = 'Nama lengkap wajib diisi';
      hasError = true;
    }
  
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;
    if (!passwordRegex.test(formData.password)) {
      errors.password = 'Password minimal 6 karakter, ada huruf besar, angka, dan simbol.';
      hasError = true;
    }

    if (hasError) {
      setFormErrors(errors);
      return;
    }
  
    try {
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          const payload = {
            ...formData,
          user_id: user?.id, // ✅ Tambahkan user_id ke payload
        };
      // Kirim data ke backend lokal (port 5000)
      console.log("Kirim data:", payload);
      await await axios.post(`${API_BASE_URL.replace(/\/$/, '')}/employees`, payload);
  
      // Kalau sukses, reset form dan reload data
      setShowAddModal(false);
      setFormData({
        username: '',
        full_name: '',
        level: 'admin',
        password: '',
      });
      fetchEmployees();
      toast.success('Data karyawan berhasil ditambahkan!');
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message;
      const isDuplicateUsername = backendMessage?.includes('username');

      if (isDuplicateUsername) {
        toast.error('Username sudah digunakan. Silakan pilih username lain.');
      } else {
        toast.error(backendMessage || 'Gagal menambahkan data karyawan. Silakan coba lagi.');
      }

      console.error('Error adding employee:', error);
    }
  };
  

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
  
    try {

      const user = JSON.parse(localStorage.getItem('user') || '{}');

      const updateData = {
        full_name: formData.full_name,
        level: formData.level,
        ...(formData.password ? { password: formData.password } : {}),
        user_id: user?.id,
        username: user?.username
      };
  
      await axios.put(`${API_BASE_URL.replace(/\/$/, '')}/employees/${selectedEmployee?.id}`, updateData);
  
      setShowEditModal(false);
      setSelectedEmployee(null);
      fetchEmployees();
      toast.success('Data karyawan berhasil diperbarui!');
    } catch (error) {
      console.error('Error updating employee:', error);
      toast.error('Gagal memperbarui data karyawan. Silakan coba lagi.');
    }
  };

  const handleDelete = async () => {
    if (!selectedEmployee) return;
  
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    try {
      await axios.delete(`${API_BASE_URL.replace(/\/$/, '')}/employees/${selectedEmployee?.id}`, {
        data: {
          user_id: user?.id,
          username: user?.username,
        }
      });
  
      setShowDeleteModal(false);
      setSelectedEmployee(null);
      fetchEmployees();
      toast.success('Data karyawan berhasil dihapus!');
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error('Gagal menghapus data karyawan. Silakan coba lagi.');
    }
  };
  
  const search = searchTerm.toLowerCase();
  const filteredEmployees = employees.filter(employee =>
      (employee.username || '').toLowerCase().includes(search) ||
      (employee.full_name || '').toLowerCase().includes(search) ||
      (employee.level || '').toLowerCase().includes(search)
    );

const indexOfLastItem = currentPage * itemsPerPage;
const indexOfFirstItem = indexOfLastItem - itemsPerPage;
const currentEmployees = filteredEmployees.slice(indexOfFirstItem, indexOfLastItem);

const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

const sortedEmployees = [...employees].sort((a, b) => {
  const order = { 'superadmin': 1, 'manajemen': 2, 'admin': 3 };

  const levelOrderA = order[a.level] || 4;
  const levelOrderB = order[b.level] || 4;

  if (levelOrderA !== levelOrderB) {
    return levelOrderA - levelOrderB; // urutkan berdasarkan level dulu
  } else {
    // Kalau level sama, urutkan berdasarkan tanggal dibuat
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return dateB - dateA; // tanggal terbaru dulu
  }
});

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Manajemen Karyawan</h2>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Cari username, nama, atau level..."
              value={searchTerm}
                onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);}}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-64 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
          </div>
          {currentUser?.level?.toLowerCase() !== 'admin' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:from-orange-600 hover:to-yellow-600"
          >
            <UserPlus size={20} />
            <span>Tambah Karyawan</span>
          </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Username
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nama Lengkap
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Level
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tanggal Dibuat
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
              
            <tbody className="divide-y divide-gray-200">
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-6 text-gray-500">
                  Data karyawan kosong, silakan ditambah data karyawan!
                </td>
              </tr>
            ) : (
              sortedEmployees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {employee.username}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {employee.full_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatLevel(employee.level)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(employee.created_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {canEditOrDelete(employee) && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setFormData({
                            username: employee.username,
                            full_name: employee.full_name,
                            level: employee.level,
                            password: '',
                          });
                          setShowEditModal(true);
                        }}
                        className="text-blue-500 hover:text-blue-700 transition-all duration-200 hover:scale-110"
                      >
                        <Edit2 size={20} />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setShowDeleteModal(true);
                        }}
                        className="text-red-500 hover:text-red-700 transition-all duration-200 hover:scale-110"
                        title="Hapus"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>

          </table>
          <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-600">
                  Menampilkan {currentEmployees.length} dari {filteredEmployees.length} data
                </div>
          <div className="flex space-x-2">

          <button
            onClick={() => paginate(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
          >
            «
          </button>
          {Array.from({ length: totalPages }, (_, index) => (
                    <button
                      key={index + 1}
                      onClick={() => paginate(index + 1)}
                      className={`px-3 py-1 rounded ${
                        currentPage === index + 1 ? 'bg-orange-500 text-white' : 'bg-gray-200'
                      }`}
                    >
                      {index + 1}
                    </button>
    ))}

  <button
      onClick={() => paginate(currentPage + 1)}
      disabled={currentPage === totalPages}
      className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
    >
      »
    </button>
  </div>
  </div>

          </div>
        )}

        {/* Add Employee Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold">Tambah Karyawan Baru</h3>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setFormData({
                        username: '',
                        full_name: '',
                        level: 'admin',
                        password: '',
                      });
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className={`w-full p-2 border ${formErrors.username ? 'border-red-500' : 'border-gray-300'} rounded`}
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      required
                    />
                      {formErrors.username && (
                        <p className="text-red-500 text-sm">{formErrors.username}</p>
                      )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nama Lengkap <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                      required
                    />
                      {formErrors.full_name && (
                        <p className="text-red-500 text-sm">{formErrors.full_name}</p>
                      )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Level <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.level}
                      onChange={(e) => setFormData({ ...formData, level: e.target.value as 'admin' | 'manajemen' })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                      required
                    >
                      <option value="admin">Admin</option>
                      <option value="manajemen">Manajemen</option>
                    </select>
                  </div>
                  <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-9 right-3 text-gray-600 hover:text-gray-900 focus:outline-none"
                  >
                    {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                  </button>
                      {formErrors.password && (
                        <p className="text-red-500 text-sm">{formErrors.password}</p>
                      )}

                      {/* Password Checklist */}
                    <div className="text-sm mt-2 space-y-1">
                      <p className={`${formData.password.length >= 6 ? 'text-green-600' : 'text-gray-500'}`}>
                        {formData.password.length >= 6 ? '✔️' : '❌'} Minimal 6 karakter
                      </p>
                      <p className={`${/[A-Z]/.test(formData.password) ? 'text-green-600' : 'text-gray-500'}`}>
                        {/[A-Z]/.test(formData.password) ? '✔️' : '❌'} Mengandung huruf besar (A-Z)
                      </p>
                      <p className={`${/\d/.test(formData.password) ? 'text-green-600' : 'text-gray-500'}`}>
                        {/\d/.test(formData.password) ? '✔️' : '❌'} Mengandung angka (0-9)
                      </p>
                      <p className={`${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password) ? 'text-green-600' : 'text-gray-500'}`}>
                        {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password) ? '✔️' : '❌'} Mengandung simbol (!@#$%^&*)
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-lg shadow-md hover:from-orange-600 hover:to-yellow-600"
                    >
                      Simpan
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

      {/* Edit Employee Modal */}
      {showEditModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold">Edit Karyawan</h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedEmployee(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 bg-gray-100"
                    disabled
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Lengkap <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Level <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value as 'admin' | 'manajemen' })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                    required
                  >
                    <option value="admin">Admin</option>
                    <option value="manajemen">Manajemen</option>
                  </select>
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password Baru <span className="text-gray-500">(Kosongkan jika tidak ingin mengubah)</span>
                  </label>
                  <input
                    type={showPassword ? "text" : "password"} 
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                  />

                      {/* Password Checklist */}
                  <div className="text-sm mt-2 space-y-1">
                    <p className={`${formData.password.length >= 6 ? 'text-green-600' : 'text-gray-500'}`}>
                      {formData.password.length >= 6 ? '✔️' : '❌'} Minimal 6 karakter
                    </p>
                    <p className={`${/[A-Z]/.test(formData.password) ? 'text-green-600' : 'text-gray-500'}`}>
                      {/[A-Z]/.test(formData.password) ? '✔️' : '❌'} Mengandung huruf besar (A-Z)
                    </p>
                    <p className={`${/\d/.test(formData.password) ? 'text-green-600' : 'text-gray-500'}`}>
                      {/\d/.test(formData.password) ? '✔️' : '❌'} Mengandung angka (0-9)
                    </p>
                    <p className={`${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password) ? 'text-green-600' : 'text-gray-500'}`}>
                      {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password) ? '✔️' : '❌'} Mengandung simbol (!@#$%^&*)
                    </p>
                  </div> 

                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute top-9 right-3 text-gray-600 hover:text-gray-900 focus:outline-none"
                    >
                      {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                    </button>

                    {formErrors.password && (
                      <p className="text-red-500 text-sm">{formErrors.password}</p>
                    )}


                    

<div className="flex items-center mt-2 space-x-2">
  <button
    type="button"
    onClick={() => setFormData({ ...formData, password: 'Andirental!23' })}
    className="text-sm px-3 py-1 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:from-orange-600 hover:to-yellow-600"
  >
    Reset Password
  </button>
  <span className="text-xs text-red-500">
    *Password akan direset ke <strong>Andirental!23</strong>
  </span>
  </div>

                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedEmployee(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:from-orange-600 hover:to-yellow-600"
                  >
                    Simpan
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6">
              <div className="flex items-center mb-6 text-red-600">
                <AlertCircle size={24} className="mr-2" />
                <h3 className="text-xl font-semibold">Konfirmasi Penghapusan</h3>
              </div>

              <p className="text-gray-600 mb-6">
                Apakah Anda yakin ingin menghapus karyawan dengan username:{' '}
                <span className="font-semibold">{selectedEmployee.username}</span>?
              </p>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedEmployee(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-lg shadow-md hover:from-orange-600 hover:to-yellow-600"
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;