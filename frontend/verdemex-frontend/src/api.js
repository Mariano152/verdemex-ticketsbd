import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

const api = axios.create({
  baseURL: BASE,
});

// Interceptor para agregar el token en cada solicitud
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
