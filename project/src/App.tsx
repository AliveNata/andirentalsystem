import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { AuthState } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { Toaster, toast } from 'react-hot-toast';


const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
function App() {
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    username: '',
  });

  const [showChangelog, setShowChangelog] = useState(false);  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAppMounted, setIsAppMounted] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // 🔐 Cek session saat app pertama kali load
  useEffect(() => {
    fetch(`${API_BASE_URL.replace(/\/$/, '')}/me`, {
      credentials: 'include',
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setAuth({
            isAuthenticated: true,
            username: data.user.username,
          });
        } else if (res.status === 401) {
          // 🔵 Kalau 401 (belum login), biasa aja
          console.log('Belum login.');
        } else {
          // 🔴 Kalau error lain, baru log error
          const errText = await res.text();
          console.error(`Error: ${res.status} - ${errText}`);
        }
      })
      .catch((err) => {
        console.error('Error checking login status:', err);
      })
      .finally(() => {
        setIsAppMounted(true);
      });
  }, []);

  // ⏳ Auto logout saat idle 15 menit + warning 1 menit sebelumnya + sync antar tab + request ke server saat tab ditutup
  useEffect(() => {
    let idleTimeout: NodeJS.Timeout;
    let warningTimeout: NodeJS.Timeout;

    const logout = () => {
      setAuth({ isAuthenticated: false, username: '' });
      localStorage.removeItem('token');
      localStorage.setItem('lastLogout', Date.now().toString());
      window.location.href = '/';
    };

    const resetTimer = () => {
      clearTimeout(idleTimeout);
      clearTimeout(warningTimeout);
      setShowWarning(false);

      localStorage.setItem('lastActive', Date.now().toString());

      // Warning 1 menit sebelum logout
      warningTimeout = setTimeout(() => {
        setShowWarning(true);
      }, 14 * 60 * 1000);

      idleTimeout = setTimeout(() => {
        logout();
      }, 15 * 60 * 1000);
    };

    const handleBeforeUnload = () => {
      localStorage.removeItem('token');
      localStorage.setItem('lastLogout', Date.now().toString());
      // Kirim request logout ke server
      navigator.sendBeacon(`${API_BASE_URL.replace(/\/$/, '')}/logout`);
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'lastLogout') {
        logout();
      }
    };

    const events = ['mousemove', 'keydown', 'click'];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('storage', handleStorageChange);

    resetTimer();

    return () => {
      clearTimeout(idleTimeout);
      clearTimeout(warningTimeout);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleLogin = (username: string, password: string) => {
    if (username && password) {
      setAuth({
        isAuthenticated: true,
        username,
      });
      toast.success(`Hi ${username}, selamat datang kembali! 👋`); // ✅ Notifikasi personal
    }
  };

  if (!isAppMounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-600 text-lg">Loading...</div>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" reverseOrder={false} />

      {showWarning && (
        <div className="fixed top-4 right-4 bg-yellow-300 text-black px-4 py-2 rounded shadow-md z-50">
          Kamu akan logout dalam 1 menit karena tidak aktif
        </div>
      )}

      <nav className="bg-white dark:bg-gray-800 shadow-md">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="flex justify-between h-16 items-center">
      {/* Kiri: Sidebar toggle + Judul */}
      <div className="flex items-center">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="text-gray-500 dark:text-gray-300 hover:text-gray-700"
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <h1 className="ml-4 text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <span>Andi Rental Mobil System</span>
          <button
            onClick={() => setShowChangelog(true)}
            className="text-xs font-normal text-gray-500 dark:text-gray-400 underline hover:text-gray-700 dark:hover:text-gray-200"
          >
            v1.0.0
          </button>
        </h1>
      </div>

      {/* Kanan: Username dropdown */}
      <div className="relative group">
        <button className="flex items-center space-x-2 focus:outline-none text-gray-700 dark:text-gray-200">
          <span className="mr-2">{auth.username}</span>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5.5 7l4.5 4.5L14.5 7z" />
          </svg>
        </button>
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-md opacity-0 group-hover:opacity-100 transition duration-150 z-50 p-3 space-y-2">
          <div className="flex items-center justify-between">
  <span className="text-sm text-gray-700 dark:text-gray-200">
    {darkMode ? 'Mode Gelap' : 'Mode Terang'}
  </span>
  <button
    onClick={() => setDarkMode(!darkMode)}
    className={`w-10 h-5 flex items-center bg-gray-300 rounded-full p-1 duration-300 ease-in-out ${
      darkMode ? 'bg-orange-500' : ''
    }`}
  >
    <div
      className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${
        darkMode ? 'translate-x-5' : ''
      }`}
    />
  </button>
</div>
          <button
            onClick={() => setAuth({ isAuthenticated: false, username: '' })}
            className="w-full bg-red-500 text-white text-sm px-3 py-1 rounded hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  </div>
</nav>

      <Dashboard isSidebarOpen={isSidebarOpen} />

      {showChangelog && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-md w-full p-6 relative">
      <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">Version Log v1.0.0</h2>
      <ul className="text-sm text-gray-700 dark:text-gray-300 list-disc pl-5 space-y-2">
        <li>✅ Deployed new released</li>
        <li>🌙 Fitur dark mode toggle (Beta)</li>
        <li>📊 Pembersihan Logo</li>
        <li>🧾 Sistem invoice dan cap lunas</li>
      </ul>
      <button
        onClick={() => setShowChangelog(false)}
        className="absolute top-2 right-3 text-gray-500 hover:text-red-500 text-lg"
      >
        ×
      </button>
    </div>
  </div>
)}

      <footer className="text-center text-sm py-4 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300">
        © {new Date().getFullYear()} Andi Rental Mobil System. All rights reserved.
      </footer>
    </div>
  );
}

export default App;
