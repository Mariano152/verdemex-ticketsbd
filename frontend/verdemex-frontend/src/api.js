import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

export const api = axios.create({
  baseURL: BASE,
});
