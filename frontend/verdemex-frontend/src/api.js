import axios from "axios";

// Local:  VITE_API_URL=http://localhost:3001
// Prod :  VITE_API_URL=https://tu-backend.onrender.com
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});
