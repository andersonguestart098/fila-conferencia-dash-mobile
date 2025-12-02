// src/api/client.ts
import axios from "axios";

export const api = axios.create({
  baseURL: "https://api-sankhya-fila-conferencia-6bbe82fb50b8.herokuapp.com",
   timeout: 30000,
});

// Log global (debug)
api.interceptors.response.use(
  (res) => res,
  (error) => {
    console.error("❌ [AXIOS GLOBAL ERROR]:", {
      url: error?.config?.url,
      code: error?.code,
      status: error?.response?.status,
      message: error?.message,
    });
    return Promise.reject(error);
  }
);
