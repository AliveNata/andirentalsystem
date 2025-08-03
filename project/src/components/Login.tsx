import React, { useState, useEffect } from 'react';
import { LogIn, Eye, EyeOff, Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

type LoginProps = {
  onLogin: (username: string, password: string) => void;
};

function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const navigate = useNavigate();

  const toggleDark = () => setDarkMode(!darkMode);
  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      console.log('🟢 Login Berhasil:', data);

      if (!res.ok) {
        toast.error(data.message || 'Login gagal');
        throw new Error(data.message || 'Login failed');
      }

      localStorage.setItem('user', JSON.stringify({
        id: data.id,
        username: data.username,
        level: data.level
      }));

      onLogin(username, password); // ini akan update state Auth di App.tsx
      navigate('/dashboard'); // opsional
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.5, ease: 'easeOut' },
  });

  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
  const fetchLogo = async () => {
    try {
      const res = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/web-config/logo`);
      const data = await res.json();
      if (res.ok) {
        setLogoUrl(data?.url_image);
      } else {
        console.error('Gagal ambil logo:', data);
      }
    } catch (err) {
      console.error('Error fetching logo:', err);
    }
  };

  fetchLogo();
}, []);


  return (
    <div className={`${darkMode ? 'dark' : ''}`}>
      <div className="min-h-screen bg-gradient-to-br from-orange-100 to-white dark:from-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative backdrop-blur-md bg-white/30 dark:bg-black/30 shadow-2xl border border-white/30 dark:border-gray-700 rounded-2xl p-8 max-w-md w-full text-gray-800 dark:text-gray-100"
        >
          {/* Toggle Dark Mode */}
          <button
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
            onClick={toggleDark}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <motion.div {...fadeUp(0)}>
            <div className="flex justify-center mb-6">
              <div className="flex justify-center mb-6">
  {logoUrl ? (
    <img
      src={logoUrl}
      alt="Logo"
      className="h-24 w-24 rounded-full object-cover shadow-lg border-4 border-white dark:border-gray-700"
    />
  ) : (
    <LogIn size={48} className="text-orange-500" />
  )}
</div>
            </div>
          </motion.div>

          <motion.h2 {...fadeUp(0.1)} className="text-center text-3xl font-bold mb-2">
            Selamat Datang
          </motion.h2>

          <motion.p {...fadeUp(0.15)} className="text-center text-sm mb-8">
            Silakan login ke Andi Rental Mobil Jakarta System
          </motion.p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <motion.div {...fadeUp(0.2)}>
              <label htmlFor="username" className="block text-sm font-medium mb-1">Username</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white/70 dark:bg-gray-700 placeholder:text-gray-400 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Masukkan username"
                required
              />
            </motion.div>

            <motion.div {...fadeUp(0.25)} className="relative">
              <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
              <input
                type={showPass ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white/70 dark:bg-gray-700 placeholder:text-gray-400 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Masukkan password"
                required
              />
              <button
                type="button"
                className="absolute top-9 right-3 text-gray-600 dark:text-gray-300"
                onClick={() => setShowPass(!showPass)}
              >
                {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </motion.div>

            <motion.div {...fadeUp(0.35)}>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-3 px-4 rounded-xl text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-400 transition-colors duration-200 disabled:opacity-60"
              >
                {isLoading ? (
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  'Sign in'
                )}
              </button>
            </motion.div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

export default Login;
