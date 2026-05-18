import { api } from "./client";
import type { DetalhePedido } from "../types/conferencia";

type ConferenteByNunota = Record<number, { codUsuario: number; nome: string }>;

let pendentesEmAndamento: Promise<DetalhePedido[] | null> | null = null;

const API_DEBUG = true;

function apiLog(message: string, data?: any) {
  if (!API_DEBUG) return;
  console.log(message, data ?? "");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getComRetry<T>(
  url: string,
  config: any,
  tentativas = 1
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

      if (isCanceled) throw err;

      const isTimeout =
        err?.code === "ECONNABORTED" ||
        String(err?.message || "").toLowerCase().includes("timeout");

      const isNetwork = !err?.response;
      const is5xx = Number(err?.response?.status) >= 500;

      const podeRetry = isTimeout || isNetwork || is5xx;

      if (!podeRetry || i === tentativas) break;

      await sleep(400 * (i + 1));
    }
  }

  throw lastErr;
}

function loadConferenteByNunota(): ConferenteByNunota {
  try {
    return JSON.parse(localStorage.getItem("conferenteByNunota") || "{}");
  } catch {
    return {};
  }
}

function saveConferenteByNunota(next: ConferenteByNunota) {
  try {
    localStorage.setItem("conferenteByNunota", JSON.stringify(next));
  } catch {
    // ignore
  }
}

function sincronizarConferentesLocais(pedidos: DetalhePedido[]) {
  const conferenteByNunota = loadConferenteByNunota();
  const updatedConferenteByNunota = { ...conferenteByNunota };
  let atualizados = 0;

  const listaConferentes = [
    { codUsuario: 1, nome: "Manoel" },
    { codUsuario: 2, nome: "Anderson" },
    { codUsuario: 3, nome: "Felipe" },
    { codUsuario: 4, nome: "Matheus" },
    { codUsuario: 5, nome: "Cristiano" },
    { codUsuario: 6, nome: "Cristiano Sanhudo" },
    { codUsuario: 7, nome: "Eduardo" },
    { codUsuario: 8, nome: "Everton" },
    { codUsuario: 9, nome: "Maximiliano" },
    { codUsuario: 10, nome: "Miqueias" },
    { codUsuario: 11, nome: "Marcelo" },
  ];

  pedidos.forEach((pedido) => {
    const idBackend = (pedido as any).conferenteId;
    const nomeBackend = (pedido as any).conferenteNome;
    const nomeConferenteOld = pedido.nomeConferente;

    if (idBackend && nomeBackend) {
      updatedConferenteByNunota[pedido.nunota] = {
        codUsuario: idBackend,
        nome: nomeBackend,
      };
      atualizados++;
      return;
    }

    if (
      nomeConferenteOld &&
      nomeConferenteOld !== "null" &&
      nomeConferenteOld !== "-" &&
      nomeConferenteOld !== ""
    ) {
      const conferenteEncontrado = listaConferentes.find(
        (c) => c.nome.toLowerCase() === nomeConferenteOld.toLowerCase()
      );

      if (conferenteEncontrado) {
        updatedConferenteByNunota[pedido.nunota] = conferenteEncontrado;
        atualizados++;
      } else if (!conferenteByNunota[pedido.nunota]) {
        updatedConferenteByNunota[pedido.nunota] = {
          codUsuario: 0,
          nome: nomeConferenteOld,
        };
        atualizados++;
      }
    }
  });

  if (atualizados > 0) {
    saveConferenteByNunota(updatedConferenteByNunota);
    apiLog(`🔄 [API] ${atualizados} conferentes sincronizados com localStorage`);
  }
}

/**
 * Busca pedidos pendentes sob demanda.
 *
 * Novo fluxo:
 * - carga inicial da tela chama esta função uma vez
 * - eventos SSE chamam esta função via onRefresh()
 * - se já existir request em andamento, reutiliza a mesma Promise
 * - não faz controle de polling / intervalo mínimo
 */
export async function buscarPedidosPendentes(): Promise<DetalhePedido[] | null> {
  if (pendentesEmAndamento) {
    apiLog("🟦 [API] Busca reaproveitada: já existe request em andamento.");
    return pendentesEmAndamento;
  }

  pendentesEmAndamento = (async () => {
    try {
      const url = "/api/conferencia/fila-db";

      apiLog("📡 [API] Buscando pedidos pendentes sob demanda...");

      const data = await getComRetry<any>(
        url,
        {
          timeout: 60000,
        },
        1
      );

      if (data == null) {
        console.warn("⚠ [API] Sem data, retornando lista vazia");
        return [];
      }

      if (data.pedidos && Array.isArray(data.pedidos)) {
        const pedidos = data.pedidos as DetalhePedido[];

        apiLog("✅ [API] Dados recebidos do backend", {
          total: data.total,
          page: data.page,
          pageSize: data.pageSize,
          primeiroPedido: pedidos[0]
            ? {
                nunota: pedidos[0].nunota,
                statusConferencia: pedidos[0].statusConferencia,
                itens: pedidos[0].itens?.length,
                conferenteId: (pedidos[0] as any).conferenteId,
                conferenteNome: (pedidos[0] as any).conferenteNome,
                nomeConferente: pedidos[0].nomeConferente,
                tempoConferenciaMs: (pedidos[0] as any).tempoConferenciaMs,
              }
            : null,
        });

        sincronizarConferentesLocais(pedidos);
        return pedidos;
      }

      if (Array.isArray(data)) {
        const pedidos = data as DetalhePedido[];

        apiLog("✅ [API] Dados recebidos do backend em formato antigo", {
          total: pedidos.length,
          primeiroPedido: pedidos[0]
            ? {
                nunota: pedidos[0].nunota,
                statusConferencia: pedidos[0].statusConferencia,
                itens: pedidos[0].itens?.length,
                conferenteId: (pedidos[0] as any).conferenteId,
                conferenteNome: (pedidos[0] as any).conferenteNome,
                nomeConferente: pedidos[0].nomeConferente,
                tempoConferenciaMs: (pedidos[0] as any).tempoConferenciaMs,
              }
            : null,
        });

        sincronizarConferentesLocais(pedidos);
        return pedidos;
      }

      console.warn("⚠ [API] Resposta inesperada, retornando lista vazia", data);
      return [];
    } catch (error: any) {
      console.error("❌ [API] ERRO ao buscar pedidos:", {
        message: error?.message,
        code: error?.code,
        status: error?.response?.status,
        url: error?.config?.url,
      });

      return null;
    } finally {
      pendentesEmAndamento = null;
    }
  })();

  return pendentesEmAndamento;
}

export async function buscarConferentesDoBackend(): Promise<
  { codUsuario: number; nome: string }[]
> {
  return [
    { codUsuario: 1, nome: "Manoel" },
    { codUsuario: 2, nome: "Anderson" },
    { codUsuario: 3, nome: "Felipe" },
    { codUsuario: 4, nome: "Matheus" },
    { codUsuario: 5, nome: "Cristiano" },
    { codUsuario: 6, nome: "Cristiano Sanhudo" },
    { codUsuario: 7, nome: "Eduardo" },
    { codUsuario: 8, nome: "Everton" },
    { codUsuario: 9, nome: "Maximiliano" },
    { codUsuario: 10, nome: "Miqueias" },
    { codUsuario: 11, nome: "Marcelo" },
  ];
}

let filaDbEmAndamento: Promise<DetalhePedido[] | null> | null = null;

export async function buscarFilaDb(): Promise<DetalhePedido[] | null> {
  if (filaDbEmAndamento) {
    apiLog("🟦 [API] buscarFilaDb reaproveitada: já existe request em andamento.");
    return filaDbEmAndamento;
  }

  filaDbEmAndamento = (async () => {
    try {
      apiLog("📡 [API] Buscando fila-db...");

      const data = await getComRetry<DetalhePedido[]>(
        "/api/conferencia/fila-db",
        { timeout: 60000 },
        1
      );

      if (!Array.isArray(data)) {
        console.warn("⚠ [API] fila-db retornou formato inesperado", data);
        return [];
      }

      apiLog("✅ [API] fila-db recebida", { total: data.length });
      sincronizarConferentesLocais(data);
      return data;
    } catch (error: any) {
      console.error("❌ [API] ERRO ao buscar fila-db:", {
        message: error?.message,
        code: error?.code,
        status: error?.response?.status,
      });
      return null;
    } finally {
      filaDbEmAndamento = null;
    }
  })();

  return filaDbEmAndamento;
}

export { loadConferenteByNunota, saveConferenteByNunota };