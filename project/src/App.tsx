import { useState, useEffect, useCallback } from 'react';
import { Menu, X } from 'lucide-react';
import { AuthState } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { toast } from 'react-hot-toast';
import { FORBIDDEN_EVENT, SESSION_EXPIRED_EVENT, type ForbiddenDetail } from './lib/sessionGuard';
import { GUARD_TOAST_ID } from './lib/notify';
import { Modal, ModalButton } from './components/ui/Modal';
import AccountMenu from './components/AccountMenu';
import { DESKTOP_QUERY, useMediaQuery } from './lib/useMediaQuery';


const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
function App() {
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    username: '',
  });

  const [showChangelog, setShowChangelog] = useState(false);  
  // Desktop (lg and up) inline sidebar. Below lg the menu lives in a drawer that starts closed.
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [isAppMounted, setIsAppMounted] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Widening past lg while the drawer is open would leave a focus trap over the inline sidebar.
  useEffect(() => {
    if (isDesktop) setIsMobileNavOpen(false);
  }, [isDesktop]);

  const toggleNav = () => {
    if (isDesktop) setIsSidebarOpen((v) => !v);
    else setIsMobileNavOpen(true);
  };

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
    <div className="flex min-h-dvh flex-col bg-gray-100">
      {showWarning && (
        <div className="fixed top-4 left-4 right-4 bg-yellow-300 text-black px-4 py-2 rounded shadow-md z-50 sm:left-auto">
          Kamu akan logout dalam 1 menit karena tidak aktif
        </div>
      )}

      {/* Sticky so the menu button stays in reach while a long page scrolls on a phone. */}
      <nav className="sticky top-0 z-40 bg-white dark:bg-gray-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between gap-2 h-16 items-center">
            <div className="flex min-w-0 flex-1 items-center">
              <button
                id="nav-toggle"
                type="button"
                onClick={toggleNav}
                aria-expanded={isDesktop ? isSidebarOpen : isMobileNavOpen}
                aria-controls={isDesktop ? undefined : 'mobile-nav'}
                aria-label={isDesktop ? (isSidebarOpen ? 'Sembunyikan menu' : 'Tampilkan menu') : 'Buka menu'}
                className="-ml-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 dark:text-gray-300"
              >
                {isDesktop && isSidebarOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
              </button>
              <h1 className="ml-2 flex min-w-0 items-center gap-2 font-semibold text-gray-800 dark:text-gray-100 sm:ml-4">
                <span className="truncate text-base sm:text-xl">Andi Rental Mobil System</span>
                <button
                  type="button"
                  onClick={() => setShowChangelog(true)}
                  className="hidden shrink-0 text-xs font-normal text-gray-500 underline hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 sm:inline"
                >
                  v1.0.0
                </button>
              </h1>
            </div>

            <AccountMenu
              username={auth.username}
              darkMode={darkMode}
              onToggleDarkMode={() => setDarkMode((v) => !v)}
              onLogout={() => { void logout(); }}
            />
          </div>
        </div>
      </nav>

      <Dashboard
        isSidebarOpen={isSidebarOpen}
        isMobileNavOpen={isMobileNavOpen}
        onMobileNavChange={setIsMobileNavOpen}
      />

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
