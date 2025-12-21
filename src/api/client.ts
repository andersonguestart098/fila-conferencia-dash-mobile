// src/api/client.ts
import axios from "axios";

export const api = axios.create({
  baseURL: "https://api-sankhya-fila-conferencia-6bbe82fb50b8.herokuapp.com",
  timeout: 60000, // 60s global (ou deixe 30s e ajuste por request)
});

// Marca tempo de início p/ medir duração
api.interceptors.request.use((config) => {
  (config as any).metadata = { startTime: Date.now() };
  return config;
});

// Log global (debug) + duração
api.interceptors.response.use(
  (res) => {
    const start = (res.config as any)?.metadata?.startTime;
    const ms = start ? Date.now() - start : undefined;

    console.log("✅ [AXIOS OK]:", {
      url: res.config?.url,
      status: res.status,
      ms,
    });

    return res;
  },
  (error) => {
    const start = (error?.config as any)?.metadata?.startTime;
    const ms = start ? Date.now() - start : undefined;

    console.error("❌ [AXIOS GLOBAL ERROR]:", {
      url: error?.config?.url,
      code: error?.code,
      status: error?.response?.status,
      message: error?.message,
      ms,
      isCanceled:
        error?.code === "ERR_CANCELED" ||
        error?.message?.toLowerCase?.().includes("canceled"),
    });

    return Promise.reject(error);
  }
);
