import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api', 
  timeout: 10000, // 10 detik
  headers: {
    'Content-Type': 'application/json',
  },
});

export default axiosInstance;
