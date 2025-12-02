// src/api/conferencia.ts
import { api } from "./client";
import type { DetalhePedido } from "../types/conferencia";

/**
 * Busca pedidos pendentes.
 *
 * Retornos:
 *  - DetalhePedido[]  -> sucesso (200), podendo ser [] se não tiver pendentes
 *  - null             -> erro (timeout, 5xx, network, etc.)
 */
export async function buscarPedidosPendentes(): Promise<DetalhePedido[] | null> {
  try {
    const resp = await api.get<DetalhePedido[]>("/api/conferencia/pedidos-pendentes");

    console.log("✅ [API] Sucesso ao buscar pedidos:", {
      status: resp.status,
      length: Array.isArray(resp.data) ? resp.data.length : "n/a",
      data: resp.data,
    });

    // Se a API retornar 204 No Content, normalizar para lista vazia
    if (resp.status === 204 || resp.data == null) {
      console.warn("⚠ [API] Resposta sem corpo (204/sem data), retornando lista vazia");
      return [];
    }

    if (Array.isArray(resp.data)) {
      return resp.data;
    }

    console.warn("⚠ [API] Resposta inesperada (data não é array), retornando lista vazia");
    return [];
  } catch (error: any) {
    console.error("❌ [API] ERRO ao buscar pedidos:", {
      message: error?.message,
      code: error?.code,
      status: error?.response?.status,
      url: error?.config?.url,
    });

    // Aqui é FUNDAMENTAL: sinalizar para o hook que deu erro
    // para ele NÃO limpar os pedidos atuais.
    return null;
  }
}
