// src/api/conferencia.ts
import { api } from "./client";
import type { DetalhePedido } from "../types/conferencia";

// controller compartilhado só pra essa rota
let pendentesController: AbortController | null = null;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// retry leve só para timeout/network
async function getComRetry<T>(
  url: string,
  config: any,
  tentativas = 2
): Promise<T> {
  let lastErr: any;

  for (let i = 0; i <= tentativas; i++) {
    try {
      const resp = await api.get<T>(url, config);
      return resp.data as T;
    } catch (err: any) {
      lastErr = err;

      const isCanceled =
        err?.code === "ERR_CANCELED" ||
        err?.message?.toLowerCase?.().includes("canceled");

      // se você mesmo cancelou, não é erro de rede: só sobe o cancel pra quem chamou
      if (isCanceled) throw err;

      const isTimeout =
        err?.code === "ECONNABORTED" ||
        String(err?.message || "").includes("timeout");

      const isNetwork = !err?.response; // sem status = caiu antes de responder

      const podeRetry = isTimeout || isNetwork;

      if (!podeRetry || i === tentativas) break;

      // backoff simples
      await sleep(400 * (i + 1));
    }
  }

  throw lastErr;
}

/**
 * Busca pedidos pendentes.
 *
 * Retornos:
 *  - DetalhePedido[]  -> sucesso (200), podendo ser [] se não tiver pendentes
 *  - null             -> erro (timeout, 5xx, network, etc.)
 */
export async function buscarPedidosPendentes(): Promise<DetalhePedido[] | null> {
  try {
    // Cancela o request anterior dessa mesma função (se existir)
    if (pendentesController) pendentesController.abort();
    pendentesController = new AbortController();

    const url = "/api/conferencia/pedidos-pendentes";

    // timeout só pra esse endpoint (se quiser manter 30s global)
    const data = await getComRetry<DetalhePedido[]>(
      url,
      {
        signal: pendentesController.signal,
        timeout: 60000, // pode subir só aqui, ex: 60s
      },
      1 // 1 retry já ajuda muito (total 2 tentativas)
    );

    // Se veio null/undefined por algum motivo, normaliza
    if (data == null) {
      console.warn("⚠ [API] Sem data, retornando lista vazia");
      return [];
    }

    if (Array.isArray(data)) return data;

    console.warn("⚠ [API] Resposta inesperada (data não é array), retornando lista vazia");
    return [];
  } catch (error: any) {
    const isCanceled =
      error?.code === "ERR_CANCELED" ||
      error?.message?.toLowerCase?.().includes("canceled");

    if (isCanceled) {
      // cancel é comportamento esperado quando o poll dispara de novo
      console.log("🟦 [API] Request cancelado (novo poll iniciou).");
      return null;
    }

    console.error("❌ [API] ERRO ao buscar pedidos:", {
      message: error?.message,
      code: error?.code,
      status: error?.response?.status,
      url: error?.config?.url,
    });

    return null;
  } finally {
    // libera controller (evita abort em request já finalizado)
    pendentesController = null;
  }
}
