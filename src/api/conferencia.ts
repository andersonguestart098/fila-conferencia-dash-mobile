// src/api/conferencia.ts
import { api } from "./client";
import type { DetalhePedido } from "../types/conferencia";

// Interface para a nova resposta do backend
interface PedidosResponse {
  pedidos: DetalhePedido[];
  total: number;
  page: number;
  pageSize: number;
}

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

// ✅ Tipos e funções para gerenciamento de conferentes no localStorage
type ConferenteByNunota = Record<number, { codUsuario: number; nome: string }>;

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

// ✅ Função para buscar conferentes do backend (opcional)
export async function buscarConferentesDoBackend(): Promise<{ codUsuario: number; nome: string }[]> {
  try {
    // Se você tiver um endpoint específico para conferentes no backend
    // const resp = await api.get<Conferente[]>('/api/conferentes');
    // return resp.data;
    
    // Por enquanto, retorna a lista fixa
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
    ];
  } catch (error) {
    console.error("Erro ao buscar conferentes do backend:", error);
    throw error;
  }
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

    console.log("📡 [API] Buscando pedidos pendentes...");

    // timeout só pra esse endpoint (se quiser manter 30s global)
    const data = await getComRetry<any>(
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

    // ✅ NOVO FORMATO: objeto com pedidos, total, page, pageSize
    if (data.pedidos && Array.isArray(data.pedidos)) {
      console.log("✅ [API] Dados recebidos do backend (novo formato):", {
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
        primeiroPedido: data.pedidos[0] ? {
          nunota: data.pedidos[0].nunota,
          itens: data.pedidos[0].itens?.length,
          primeiroItemEstoque: data.pedidos[0].itens?.[0]?.estoqueDisponivel,
          conferenteId: (data.pedidos[0] as any).conferenteId,
          conferenteNome: (data.pedidos[0] as any).conferenteNome,
          nomeConferente: data.pedidos[0].nomeConferente
        } : null
      });

      const pedidos = data.pedidos as DetalhePedido[];

      // ✅ Sincroniza conferentes locais com dados do backend
      const conferenteByNunota = loadConferenteByNunota();
      const updatedConferenteByNunota = { ...conferenteByNunota };
      let atualizados = 0;
      
      pedidos.forEach((pedido: DetalhePedido) => {  // ✅ TIPADO COMO DetalhePedido
        const idBackend = (pedido as any).conferenteId;
        const nomeBackend = (pedido as any).conferenteNome;
        const nomeConferenteOld = pedido.nomeConferente;
        
        // Primeiro, tenta usar os campos específicos do conferente
        if (idBackend && nomeBackend) {
          updatedConferenteByNunota[pedido.nunota] = {
            codUsuario: idBackend,
            nome: nomeBackend
          };
          atualizados++;
          console.log(`✅ [API] Conferente atualizado do backend: ${pedido.nunota} -> ${nomeBackend}`);
        } 
        // Fallback: se não tem os campos específicos, tenta usar o campo antigo
        else if (nomeConferenteOld && nomeConferenteOld !== "null" && nomeConferenteOld !== "-" && nomeConferenteOld !== "") {
          // Tenta encontrar o código correspondente
          const conferenteEncontrado = [
            { codUsuario: 1, nome: "Manoel" },
            { codUsuario: 2, nome: "Anderson" },
            { codUsuario: 3, nome: "Felipe" },
            { codUsuario: 4, nome: "Matheus" },
            { codUsuario: 5, nome: "Cristiano" },
            { codUsuario: 6, nome: "Cristiano Sanhudo" },
            { codUsuario: 7, nome: "Eduardo" },
            { codUsuario: 8, nome: "Everton" },
            { codUsuario: 9, nome: "Maximiliano" },
          ].find(c => c.nome.toLowerCase() === nomeConferenteOld.toLowerCase());
          
          if (conferenteEncontrado) {
            updatedConferenteByNunota[pedido.nunota] = conferenteEncontrado;
            atualizados++;
            console.log(`✅ [API] Conferente encontrado pelo nome: ${pedido.nunota} -> ${nomeConferenteOld}`);
          } else if (!conferenteByNunota[pedido.nunota]) {
            // Se não encontrou e não tem no localStorage, cria um temporário
            updatedConferenteByNunota[pedido.nunota] = {
              codUsuario: 0,
              nome: nomeConferenteOld
            };
            atualizados++;
            console.log(`✅ [API] Conferente criado temporariamente: ${pedido.nunota} -> ${nomeConferenteOld}`);
          }
        }
      });
      
      // Salva os conferentes atualizados no localStorage
      if (atualizados > 0) {
        saveConferenteByNunota(updatedConferenteByNunota);
        console.log(`🔄 [API] ${atualizados} conferentes sincronizados com localStorage`);
      }
      
      return pedidos;
    }

    // ✅ FORMATO ANTIGO: lista direta
    if (Array.isArray(data)) {
      console.log("✅ [API] Dados recebidos do backend (formato antigo):", {
        total: data.length,
        primeiroPedido: data[0] ? {
          nunota: data[0].nunota,
          itens: data[0].itens?.length,
          primeiroItemEstoque: data[0].itens?.[0]?.estoqueDisponivel,
          conferenteId: (data[0] as any).conferenteId,
          conferenteNome: (data[0] as any).conferenteNome,
          nomeConferente: data[0].nomeConferente
        } : null
      });

      const pedidos = data as DetalhePedido[];

      // ✅ Sincroniza conferentes locais com dados do backend
      const conferenteByNunota = loadConferenteByNunota();
      const updatedConferenteByNunota = { ...conferenteByNunota };
      let atualizados = 0;
      
      pedidos.forEach((pedido: DetalhePedido) => {  // ✅ TIPADO COMO DetalhePedido
        const idBackend = (pedido as any).conferenteId;
        const nomeBackend = (pedido as any).conferenteNome;
        const nomeConferenteOld = pedido.nomeConferente;
        
        if (idBackend && nomeBackend) {
          updatedConferenteByNunota[pedido.nunota] = {
            codUsuario: idBackend,
            nome: nomeBackend
          };
          atualizados++;
          console.log(`✅ [API] Conferente atualizado do backend: ${pedido.nunota} -> ${nomeBackend}`);
        } 
        else if (nomeConferenteOld && nomeConferenteOld !== "null" && nomeConferenteOld !== "-" && nomeConferenteOld !== "") {
          const conferenteEncontrado = [
            { codUsuario: 1, nome: "Manoel" },
            { codUsuario: 2, nome: "Anderson" },
            { codUsuario: 3, nome: "Felipe" },
            { codUsuario: 4, nome: "Matheus" },
            { codUsuario: 5, nome: "Cristiano" },
            { codUsuario: 6, nome: "Cristiano Sanhudo" },
            { codUsuario: 7, nome: "Eduardo" },
            { codUsuario: 8, nome: "Everton" },
            { codUsuario: 9, nome: "Maximiliano" },
          ].find(c => c.nome.toLowerCase() === nomeConferenteOld.toLowerCase());
          
          if (conferenteEncontrado) {
            updatedConferenteByNunota[pedido.nunota] = conferenteEncontrado;
            atualizados++;
            console.log(`✅ [API] Conferente encontrado pelo nome: ${pedido.nunota} -> ${nomeConferenteOld}`);
          } else if (!conferenteByNunota[pedido.nunota]) {
            updatedConferenteByNunota[pedido.nunota] = {
              codUsuario: 0,
              nome: nomeConferenteOld
            };
            atualizados++;
            console.log(`✅ [API] Conferente criado temporariamente: ${pedido.nunota} -> ${nomeConferenteOld}`);
          }
        }
      });
      
      if (atualizados > 0) {
        saveConferenteByNunota(updatedConferenteByNunota);
        console.log(`🔄 [API] ${atualizados} conferentes sincronizados com localStorage`);
      }
      
      return pedidos;
    }

    console.warn("⚠ [API] Resposta inesperada, retornando lista vazia", data);
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

// ✅ Exporta funções auxiliares para uso no componente
export { loadConferenteByNunota, saveConferenteByNunota };