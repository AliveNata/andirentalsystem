import { useState, useEffect, useCallback } from 'react';
import { Menu, X } from 'lucide-react';
import { AuthState } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { toast } from 'react-hot-toast';
import { FORBIDDEN_EVENT, SESSION_EXPIRED_EVENT, type ForbiddenDetail } from './lib/sessionGuard';
import { GUARD_TOAST_ID } from './lib/notify';
import { Modal, ModalButton } from './components/ui/Modal';


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

  const clearLocalSession = useCallback(() => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setShowWarning(false);
    setAuth({ isAuthenticated: false, username: '' });
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL.replace(/\/$/, '')}/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Error logging out:', err);
    }
    clearLocalSession();
    // Other open tabs listen for this key and drop their session too.
    localStorage.setItem('lastLogout', Date.now().toString());
  }, [clearLocalSession]);

  useEffect(() => {
    fetch(`${API_BASE_URL.replace(/\/$/, '')}/me`, {
      credentials: 'include',
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          // Components read the level from localStorage, so keep it in step with the server session.
          localStorage.setItem('user', JSON.stringify(data.user));
          setAuth({
            isAuthenticated: true,
            username: data.user.username,
          });
        } else if (res.status === 401) {
          localStorage.removeItem('user');
        } else {
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

  useEffect(() => {
    const handleExpired = () => {
      clearLocalSession();
      // A fixed id collapses several failing requests into one toast.
      toast.error('Sesi login sudah berakhir. Silakan login lagi.', { id: GUARD_TOAST_ID.expired });
    };
    const handleForbidden = (e: Event) => {
      const { message } = (e as CustomEvent<ForbiddenDetail>).detail ?? {};
      toast.error(message || 'Akses ditolak untuk level akun ini.', { id: GUARD_TOAST_ID.forbidden });
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    window.addEventListener(FORBIDDEN_EVENT, handleForbidden);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
      window.removeEventListener(FORBIDDEN_EVENT, handleForbidden);
    };
  }, [clearLocalSession]);

  // Idle logout after 15 minutes with a warning at 14. Only runs while logged in.
  useEffect(() => {
    if (!auth.isAuthenticated) return;

    let idleTimeout: ReturnType<typeof setTimeout>;
    let warningTimeout: ReturnType<typeof setTimeout>;

    const idleLogout = () => {
      logout().then(() => {
        toast('Kamu otomatis logout karena tidak aktif selama 15 menit.', { id: 'idle-logout' });
      });
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

      idleTimeout = setTimeout(idleLogout, 15 * 60 * 1000);
    };

    // The server session is already gone; clear locally without re-broadcasting,
    // otherwise two tabs keep triggering each other.
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'lastLogout') {
        clearLocalSession();
      }
    };

    const events = ['mousemove', 'keydown', 'click'];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    window.addEventListener('storage', handleStorageChange);

    resetTimer();

    return () => {
      clearTimeout(idleTimeout);
      clearTimeout(warningTimeout);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [auth.isAuthenticated, logout, clearLocalSession]);

  const handleLogin = (username: string, password: string) => {
    if (username && password) {
      setAuth({
        isAuthenticated: true,
        username,
      });
      toast.success(`Halo, ${username}.`);
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
            onClick={() => { void logout(); }}
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

      <Modal
        open={showChangelog}
        onClose={() => setShowChangelog(false)}
        title="Version Log v1.0.0"
        size="sm"
        footer={<ModalButton onClick={() => setShowChangelog(false)}>Tutup</ModalButton>}
      >
        <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700">
          <li>Deployed new released</li>
          <li>Fitur dark mode toggle (Beta)</li>
          <li>Pembersihan Logo</li>
          <li>Sistem invoice dan cap lunas</li>
        </ul>
      </Modal>

      <footer className="text-center text-sm py-4 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300">
        © {new Date().getFullYear()} Andi Rental Mobil System. All rights reserved.
      </footer>
    </div>
  );
}

export default App;
