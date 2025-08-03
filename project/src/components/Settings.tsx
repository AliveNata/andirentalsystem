import React, { useState, useEffect, } from 'react';
import { CreditCard, Plus, Edit, Trash2, Star, Settings as SettingsIcon } from 'lucide-react';
import toast from 'react-hot-toast';

interface BankAccount {
  id: string;
  bankName: string;
  logoUrl: string;
  accountNumber: string;
  accountHolderName: string;
}

interface BankAccountFormData {
  bankName: string;
  logoUrl: string;
  accountNumber: string;
  accountHolderName: string;
}

const Settings: React.FC = () => {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([
//     {
//       id: '1',
//       bankName: 'Bank BCA',
//       logoUrl: 'https://images.pexels.com/photos/259027/pexels-photo-259027.jpeg?auto=compress&cs=tinysrgb&w=400',
//       accountNumber: '1234567890',
//       accountHolderName: 'John Doe'
//     },
//     {
//       id: '2',
//       bankName: 'Bank Mandiri',
//       logoUrl: 'https://images.pexels.com/photos/259100/pexels-photo-259100.jpeg?auto=compress&cs=tinysrgb&w=400',
//       accountNumber: '0987654321',
//       accountHolderName: 'Jane Smith'
//     }
  ]);


  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [formData, setFormData] = useState<BankAccountFormData>({
    bankName: '',
    logoUrl: '',
    accountNumber: '',
    accountHolderName: ''
  });
  

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const payload = {
    bankName: formData.bankName,
    logoUrl: formData.logoUrl,
    accountNumber: formData.accountNumber,
    accountHolderName: formData.accountHolderName,
    created_by: user?.id || null,
    updated_by: user?.id || null, 
    user_id: user?.id || null
  };

  try {
    if (editingAccount) {
      // Edit mode
      await fetch(`${API_BASE_URL.replace(/\/$/, '')}/bank-accounts/${editingAccount.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      // Tambah baru
      await fetch(`${API_BASE_URL.replace(/\/$/, '')}/bank-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    // Refresh data
    const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/bank-accounts`);
    const updatedData = await response.json();
    setBankAccounts(updatedData);
    toast.success(editingAccount ? 'Rekening berhasil diperbarui.' : 'Rekening berhasil ditambahkan.');
    resetForm();
  } catch (err) {
    console.error('Gagal simpan rekening:', err);
    toast.error('Terjadi kesalahan saat menyimpan rekening.');
  }
};


  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account);
    setFormData({
      bankName: account.bankName,
      logoUrl: account.logoUrl,
      accountNumber: account.accountNumber,
      accountHolderName: account.accountHolderName
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  try {
    await fetch(`${API_BASE_URL.replace(/\/$/, '')}/bank-accounts/delete/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id }) // <- kirim user_id ke backend
    });

    // Refresh
    const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/bank-accounts`);
    const updatedData = await response.json();
    setBankAccounts(updatedData);
    toast.success('Rekening berhasil dihapus.');
  } catch (err) {
    console.error('Gagal hapus rekening:', err);
    toast.error('Terjadi kesalahan saat menghapus rekening.');
  }
};

  const resetForm = () => {
    setFormData({
      bankName: '',
      logoUrl: '',
      accountNumber: '',
      accountHolderName: ''
    });
    setEditingAccount(null);
    setShowAddForm(false);
  };

  useEffect(() => {
  bankAccounts.forEach((account) => {
    console.log(account.logoUrl);
  });
}, [bankAccounts]);

useEffect(() => {
    fetch(`${API_BASE_URL.replace(/\/$/, '')}/bank-accounts`)
      .then(res => res.json())
      .then((data) => {
  const mappedData = data.map((item: any) => ({
    id: item.id,
    bankName: item.bank_name,
    logoUrl: item.logo_url,
    accountNumber: item.account_number,
    accountHolderName: item.account_holder_name,
  }));
  setBankAccounts(mappedData);
      })
      .catch(err => console.error('Gagal ambil bank:', err));
  }, []);


  // 🔽 ✅ WebConfig States
  interface WebConfig {
  id?: string; // ← tambahkan id (opsional), karena data baru belum tentu punya
  description: string;
  url_image: string;
}

const [webConfigs, setWebConfigs] = useState<WebConfig[]>([
  { description: 'Fav Icon', url_image: '' },
  { description: 'Logo', url_image: '' },
  { description: 'Tanda Tangan', url_image: '' }
]);


  useEffect(() => {
  fetch(`${API_BASE_URL.replace(/\/$/, '')}/web-configs`)
    .then((res) => res.json())
    .then((data) => {
      if (Array.isArray(data)) {
        setWebConfigs(data); // ← Update dari backend
      }
    })
    .catch((err) => {
      console.error('Gagal ambil web config:', err);
    });
}, []);

  type WebConfigField = 'description' | 'url_image';

  const updateWebConfig = (
    index: number,
    field: WebConfigField,
    value: string
  ) => {
    const newConfigs = [...webConfigs];
    newConfigs[index][field] = value;
    setWebConfigs(newConfigs);
  };

  const addWebConfigField = () => {
    setWebConfigs([...webConfigs, { description: '', url_image: '' }]);
  };

  const saveWebConfigs = async () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  for (const config of webConfigs) {
    if (!config.description || !config.url_image) continue;

    try {
      const res = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/web-configs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: config.description,
          url_image: config.url_image,
          created_by: user.username,
          updated_by: user.username,
          user_id: user.id
        })
      });

      if (res.status === 409) {
        const data = await res.json();
        toast.error(`❗ ${data.message}`);
        continue;
      }

      if (!res.ok) throw new Error();

      await res.json(); // bisa dipakai kalau mau update UI lebih lanjut
    } catch (err) {
      console.error('Gagal simpan web config:', err);
      toast.error(`Gagal menyimpan: ${config.description}`);
    }
  }

  toast.success('Pengaturan web berhasil disimpan.');
};

const deleteWebConfigFromDB = async (id: string) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    try {
    const res = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/web-configs/${id}?user_id=${user.id}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error();
  } catch (err) {
    console.error('Gagal hapus web config dari database:', err);
    toast.error('Gagal hapus dari database.');
  }
};

const [dailyPoint, setDailyPoint] = useState<number>(1);
const [monthlyPoint, setMonthlyPoint] = useState<number>(25);
const [pointValue, setPointValue] = useState<number>(2000); // 1 poin = Rp 2000
const [minExchangePoint, setMinExchangePoint] = useState<number>(25);

// Ambil data loyalty dari backend saat pertama kali load
useEffect(() => {
  fetch(`${API_BASE_URL.replace(/\/$/, '')}/loyalty-settings`)
    .then((res) => res.json())
    .then((data) => {
      if (data) {
        setDailyPoint(data.daily_point || 1);
        setMonthlyPoint(data.monthly_point || 25);
        setPointValue(data.point_value || 2000);
        setMinExchangePoint(data.min_exchange_point || 25);
      }
    })
    .catch((err) => console.error('Gagal ambil loyalty setting:', err));
}, []);

// Simpan perubahan ke backend
const handleSaveLoyaltySettings = async () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const payload = {
      daily_point: dailyPoint,
      monthly_point: monthlyPoint,
      point_value: pointValue,
      min_exchange_point: minExchangePoint,
      created_by: user?.username || 'system',
      updated_by: user?.username || 'system',
      user_id: user.id,
    };

    console.log('Payload yang dikirim ke backend:', payload); // ✅ Tambahkan ini


    await fetch(`${API_BASE_URL.replace(/\/$/, '')}/loyalty-settings`, {
      method: 'POST', // atau 'PUT' jika endpoint mengharuskan update
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    toast.success('Pengaturan loyalty berhasil disimpan.');
  } catch (error) {
    console.error('Gagal simpan loyalty setting:', error);
    toast.error('Terjadi kesalahan saat menyimpan pengaturan.');
  }
};


  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <SettingsIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pengaturan</h1>
              <p className="text-gray-600">Kelola akun bank dan pengaturan loyalty poin</p>
            </div>
          </div>
        </div>

        {/* Bank Account Section */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CreditCard className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Akun Bank</h2>
                <p className="text-gray-600">Kelola rekening bank untuk transaksi</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:from-orange-600 hover:to-yellow-600"
            >
              <Plus className="w-4 h-4" />
              Tambah Rekening
            </button>
          </div>

         


          {/* Bank Account Form */}
          {showAddForm && (
            <div className="border border-gray-200 rounded-lg p-6 mb-6 bg-gray-50">
              <h3 className="text-lg font-semibold mb-4">
                {editingAccount ? 'Edit Rekening Bank' : 'Tambah Rekening Bank'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nama Bank
                    </label>
                    <input
                      type="text"
                      name="bankName"
                      value={formData.bankName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Contoh: Bank BCA"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      URL Logo Bank
                    </label>
                    <input
                      type="url"
                      name="logoUrl"
                      value={formData.logoUrl}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="https://example.com/logo.png"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nomor Rekening
                    </label>
                    <input
                      type="text"
                      name="accountNumber"
                      value={formData.accountNumber}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="1234567890"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nama Pemilik Rekening
                    </label>
                    <input
                      type="text"
                      name="accountHolderName"
                      value={formData.accountHolderName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Andi Rental Mobil"
                      required
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    {editingAccount ? 'Update Rekening' : 'Simpan Rekening'}
                  </button>
                </div>
              </form>

                  {bankAccounts.map((account) => (
                    
                  <div key={account.id} className="flex items-center gap-3 p-4 border rounded-lg mb-4">
                    <img
              src={account.logoUrl || '/default-bank-icon.png'}
              alt={account.bankName}
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.src = '/default-bank-icon.png';
                e.currentTarget.onerror = null;
              }}
            />
        <div>
          <div className="font-semibold">{account.bankName}</div>
          <div className="text-sm">{account.accountNumber}</div>
          <div className="text-sm text-gray-600">{account.accountHolderName}</div>
        </div>
      </div>
    ))}

            </div>
          )}

          {/* Bank Account List */}
          <div className="space-y-4">
            {bankAccounts.length === 0 ? (
              <div className="text-center py-8">
                <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">Belum ada rekening bank yang ditambahkan</p>
              </div>
            ) : (
              bankAccounts.map((account) => (
                <div
                  key={account.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          src={account.logoUrl}
                          alt={account.bankName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.setAttribute('style', 'display: flex');
                          }}
                        />
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center hidden">
                          <CreditCard className="w-8 h-8 text-gray-400" />
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{account.bankName}</h4>
                        <p className="text-gray-600">{account.accountNumber}</p>
                        <p className="text-sm text-gray-500">{account.accountHolderName}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(account)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(account.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>


            <div className="bg-white rounded-xl shadow-sm p-6 mt-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-pink-100 rounded-lg">
            <SettingsIcon className="w-5 h-5 text-pink-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Pengaturan Web</h2>
            <p className="text-gray-600">Atur logo, favicon, dan lainnya</p>
          </div>
        </div>

        <div className="space-y-4">
          {webConfigs.map((item, index) => (
            <div key={index} className="grid md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Deskripsi (contoh: Fav Icon)"
                className="border px-3 py-2 rounded-lg w-full"
                value={item.description}
                onChange={(e) => updateWebConfig(index, 'description', e.target.value)}
              />
              <div className="flex items-center gap-3">
  <input
    type="url"
    placeholder="URL Gambar"
    className="border px-3 py-2 rounded-lg w-full"
    value={item.url_image}
    onChange={(e) => updateWebConfig(index, 'url_image', e.target.value)}
  />
  {item.url_image && (
    <div className="relative w-12 h-12">
      <img
        src={item.url_image}
        alt="Preview"
        className="w-12 h-12 rounded object-cover border"
        onError={(e) => {
          e.currentTarget.src = '/fallback.png';
        }}
      />
      <button
          onClick={async () => {
            const updated = [...webConfigs];
            const configToDelete = updated[index];

            if (configToDelete.id) {
              await deleteWebConfigFromDB(configToDelete.id); // ← Hapus dari DB
            }

            updated.splice(index, 1); // ← Hapus dari UI
            setWebConfigs(updated);
          }}
          className="absolute -top-2 -right-2 w-5 h-5 text-xs text-white bg-red-500 rounded-full flex items-center justify-center shadow"
          title="Hapus Gambar & Baris"
        >
          ×
        </button>
    </div>
  )}
</div>
            </div>
          ))}

          <div className="flex justify-between items-center mt-4">
            <button
              className="flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:from-orange-600 hover:to-yellow-600"
              onClick={addWebConfigField}
            >
              + Tambah Deskripsi
            </button>
            <button
              className="flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:from-orange-600 hover:to-yellow-600"
              onClick={saveWebConfigs}
            >
              Simpan Pengaturan Web
            </button>
          </div>
        </div>
      </div>




        {/* Loyalty Points Section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Star className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Loyalty Poin</h2>
              <p className="text-gray-600">Pengaturan sistem poin dan reward</p>
            </div>
          </div>

          {/* Placeholder Content
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <div className="max-w-md mx-auto">
              <Gift className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Fitur Dalam Pengembangan
              </h3>
              <p className="text-gray-600 mb-4">
                Sistem loyalty poin sedang dalam tahap pengembangan. Fitur ini akan segera tersedia untuk memberikan reward kepada pelanggan setia.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Coming Soon:</strong> Pengaturan poin per transaksi, level member, dan katalog reward
                </p>
              </div>
            </div>
          </div> */}

          {/* Preview of Future Features */}
          <div className="mt-6 grid md:grid-cols-3 gap-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Pengaturan Poin</h4>
              <p className="text-sm text-gray-600 mb-3">Atur berapa poin yang didapat per transaksi</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Poin Harian</label>
                  <input
                  type="number"
                  min={0}
                  value={dailyPoint}
                  onChange={(e) => {
                    const value = Math.max(0, Number(e.target.value));
                    setDailyPoint(value);
                  }}
                  onKeyDown={(e) => {
                    if (['-', '+', 'e'].includes(e.key)) e.preventDefault();
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Contoh: 1"
                />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Poin Bulanan</label>
                  <input
                  type="number"
                  min={0}
                  value={monthlyPoint}
                  onChange={(e) => {
                    const value = Math.max(0, Number(e.target.value));
                    setMonthlyPoint(value);
                  }}
                  onKeyDown={(e) => {
                    if (['-', '+', 'e'].includes(e.key)) e.preventDefault();
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Contoh: 25"
                />
                </div>
              </div>
            </div>

            {/* Level Member (belum aktif, tetap abu-abu) */}
            <div className="border border-gray-200 rounded-lg p-4 opacity-50">
              <h4 className="font-medium text-gray-900 mb-2">Level Member</h4>
              <p className="text-sm text-gray-600">Buat tingkatan member berdasarkan poin</p>
            </div>

            {/* Katalog Reward */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Katalog Reward</h4>
              <p className="text-sm text-gray-600 mb-3">Kelola hadiah yang dapat ditukar</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Konversi 1 Poin (Rp)</label>
                  <input
                  type="number"
                  min={1}
                  value={pointValue}
                  onChange={(e) => {
                    const value = Math.max(1, Number(e.target.value));
                    setPointValue(value);
                  }}
                  onKeyDown={(e) => {
                    if (['-', '+', 'e'].includes(e.key)) e.preventDefault();
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="2000"
                />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Minimal Tukar Poin</label>
                  <input
                  type="number"
                  min={0}
                  value={minExchangePoint}
                  onChange={(e) => {
                    const value = Math.max(0, Number(e.target.value));
                    setMinExchangePoint(value);
                  }}
                  onKeyDown={(e) => {
                    if (['-', '+', 'e'].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="25"
                />
                </div>
              </div>
            </div>
          </div>

          {/* Tombol Simpan */}
          <div className="mt-4 text-right">
            <button
              onClick={handleSaveLoyaltySettings}
              className="bg-orange-600 text-white pflex items-center space-x-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:from-orange-600 hover:to-yellow-600"
            >
              Simpan Pengaturan Loyalty
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;