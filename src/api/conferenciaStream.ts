import { API_BASE_URL } from "./client";

const SSE_DEBUG = true;

function logSse(message: string, data?: any) {
  if (!SSE_DEBUG) return;
  console.log(message, data ?? "");
}

export type PedidoStatusChangedEvent = {
  nunota: number;
  statusConferencia: string;
  updatedAt: string;
  initial?: boolean;
};

export type PedidoFinalizadoEvent = {
  nunota: number;
  nuconf: number;
  statusConferencia: "F";
  updatedAt: string;
};

type Params = {
  onPedidoStatusChanged?: (event: PedidoStatusChangedEvent) => void;
  onPedidoFinalizado?: (event: PedidoFinalizadoEvent) => void;
  onConnected?: () => void;
  onReconnect?: () => void;
  onError?: (error: Event) => void;
};

export function conectarConferenciaStream({
  onPedidoStatusChanged,
  onPedidoFinalizado,
  onConnected,
  onReconnect,
  onError,
}: Params) {
  const url = `${API_BASE_URL}api/conferencia/stream`;

  logSse("📡 [SSE_CLIENT_CONNECTING]", { url });

  const source = new EventSource(url);
  let wasConnected = false;

  source.addEventListener("connected", (event) => {
    const raw = (event as MessageEvent).data;

    if (wasConnected) {
      logSse("🔄 [SSE_CLIENT_RECONNECTED] disparando refresh");
      onReconnect?.();
    }

    wasConnected = true;

    logSse("✅ [SSE_CLIENT_CONNECTED]", raw);
    onConnected?.();
  });

  source.addEventListener("pedido_status_changed", (event) => {
    try {
      const raw = (event as MessageEvent).data;
      const data = JSON.parse(raw);

      const parsed = {
        nunota: Number(data.nunota),
        statusConferencia: String(data.statusConferencia ?? ""),
        updatedAt: String(data.updatedAt ?? ""),
        initial: Boolean(data.initial),
      };

      logSse("📩 [SSE_CLIENT_EVENT] pedido_status_changed", parsed);
      onPedidoStatusChanged?.(parsed);
    } catch (error) {
      console.error("❌ [SSE_CLIENT_PARSE_ERROR] pedido_status_changed", error);
    }
  });

  source.addEventListener("pedido_finalizado", (event) => {
    try {
      const raw = (event as MessageEvent).data;
      const data = JSON.parse(raw);

      const parsed = {
        nunota: Number(data.nunota),
        nuconf: Number(data.nuconf),
        statusConferencia: "F" as const,
        updatedAt: String(data.updatedAt ?? ""),
      };

      logSse("📩 [SSE_CLIENT_EVENT] pedido_finalizado", parsed);
      onPedidoFinalizado?.(parsed);
    } catch (error) {
      console.error("❌ [SSE_CLIENT_PARSE_ERROR] pedido_finalizado", error);
    }
  });

  source.onerror = (error) => {
    console.warn("⚠️ [SSE_CLIENT_ERROR] browser vai tentar reconectar", error);
    onError?.(error);
  };

  return () => {
    logSse("🔌 [SSE_CLIENT_CLOSE]", { url });
    source.close();
  };
}