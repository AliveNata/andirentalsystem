import React, { useState, useEffect, } from 'react';
import { CreditCard, Plus, Edit, Trash2, Star, Settings as SettingsIcon } from 'lucide-react';
import { notifyError, notifyResponseError, notifySuccess } from '../lib/notify';
import { ConfirmDialog } from './ui/Modal';
import WebConfigSettings from './WebConfigSettings';

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

  const [bankToDelete, setBankToDelete] = useState<BankAccount | null>(null);
  const [isSavingBank, setIsSavingBank] = useState(false);

  // The API answers in snake_case; reading it raw after a save left every field blank.
  const loadBankAccounts = async () => {
    const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/bank-accounts`);
    if (!response.ok) return;
    const data = await response.json();
    setBankAccounts(data.map((item: { id: string; bank_name: string; logo_url: string; account_number: string; account_holder_name: string }) => ({
      id: item.id,
      bankName: item.bank_name,
      logoUrl: item.logo_url,
      accountNumber: item.account_number,
      accountHolderName: item.account_holder_name,
    })));
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

  const action = editingAccount ? 'Rekening gagal diperbarui' : 'Rekening gagal ditambahkan';
  setIsSavingBank(true);
  try {
    const res = editingAccount
      ? await fetch(`${API_BASE_URL.replace(/\/$/, '')}/bank-accounts/${editingAccount.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch(`${API_BASE_URL.replace(/\/$/, '')}/bank-accounts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

    if (!res.ok) {
      await notifyResponseError(res, action);
      return;
    }

    notifySuccess(editingAccount ? 'Rekening berhasil diperbarui.' : 'Rekening berhasil ditambahkan.');
    resetForm();
    await loadBankAccounts();
  } catch (err) {
    console.error('Gagal simpan rekening:', err);
    notifyError(err, action);
  } finally {
    setIsSavingBank(false);
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
    const res = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/bank-accounts/delete/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id }) // <- kirim user_id ke backend
    });

    if (!res.ok) {
      await notifyResponseError(res, 'Rekening gagal dihapus');
      return;
    }

    notifySuccess('Rekening berhasil dihapus.');
    await loadBankAccounts();
  } catch (err) {
    console.error('Gagal hapus rekening:', err);
    notifyError(err, 'Rekening gagal dihapus');
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


    const res = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/loyalty-settings`, {
      method: 'POST', // atau 'PUT' jika endpoint mengharuskan update
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      await notifyResponseError(res, 'Pengaturan loyalty gagal disimpan');
      return;
    }

    notifySuccess('Pengaturan loyalty berhasil disimpan.');
  } catch (error) {
    console.error('Gagal simpan loyalty setting:', error);
    notifyError(error, 'Pengaturan loyalty gagal disimpan');
  }
};


  return (
    <div className="bg-gray-50 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <SettingsIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pengaturan</h1>
              <p className="text-gray-600">Kelola rekening bank, pengaturan web, dan loyalty poin</p>
            </div>
          </div>
        </div>

        {/* Bank Account Section */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
              className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 sm:w-auto bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:from-orange-600 hover:to-yellow-600"
            >
              <Plus className="w-4 h-4" />
              Tambah Rekening
            </button>
          </div>

         


          {/* Bank Account Form */}
          {showAddForm && (
            <div className="border border-gray-200 rounded-lg p-4 sm:p-6 mb-6 bg-gray-50">
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
                <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="h-11 w-full sm:w-auto bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingBank}
                    aria-busy={isSavingBank || undefined}
                    className="h-11 w-full sm:w-auto bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSavingBank ? 'Menyimpan...' : editingAccount ? 'Update Rekening' : 'Simpan Rekening'}
                  </button>
                </div>
              </form>
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
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <div className="w-16 h-16 shrink-0 bg-gray-100 rounded-lg overflow-hidden">
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
                      <div className="min-w-0 [overflow-wrap:anywhere]">
                        <h4 className="font-semibold text-gray-900">{account.bankName}</h4>
                        <p className="text-gray-600">{account.accountNumber}</p>
                        <p className="text-sm text-gray-500">{account.accountHolderName}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => handleEdit(account)}
                        aria-label={`Ubah rekening ${account.bankName}`}
                        className="inline-flex h-11 w-11 items-center justify-center text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setBankToDelete(account)}
                        aria-label={`Hapus rekening ${account.bankName}`}
                        className="inline-flex h-11 w-11 items-center justify-center text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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


        <WebConfigSettings />

        {/* Loyalty Points Section */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
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
              className="inline-flex min-h-11 w-full items-center justify-center sm:min-h-0 sm:w-auto bg-orange-600 text-white bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:from-orange-600 hover:to-yellow-600"
            >
              Simpan Pengaturan Loyalty
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!bankToDelete}
        onClose={() => setBankToDelete(null)}
        title="Hapus rekening?"
        description={
          <>
            Rekening <span className="font-semibold text-gray-900">{bankToDelete?.bankName}</span>{' '}
            {bankToDelete?.accountNumber} atas nama {bankToDelete?.accountHolderName} akan dihapus dan tidak tampil
            lagi di daftar.
          </>
        }
        confirmLabel="Hapus rekening"
        onConfirm={() => (bankToDelete ? handleDelete(bankToDelete.id) : undefined)}
      />

    </div>
  );
};

export default Settings;