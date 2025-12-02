// src/hooks/useFilaConferencia.ts
import { useEffect, useState } from "react";
import type { DetalhePedido } from "../types/conferencia";
import { buscarPedidosPendentes } from "../api/conferencia";
import {
  AudioLogger,
  limparFilaAudio,
  dispararAlertasVoz,
} from "../../public/audio/audioManager";

interface UseFilaConferenciaResult {
  pedidos: DetalhePedido[];
  loadingInicial: boolean;
  erro: string | null;
  selecionado: DetalhePedido | null;
  setSelecionado: (p: DetalhePedido | null) => void;
}

export function useFilaConferencia(): UseFilaConferenciaResult {
  const [pedidos, setPedidos] = useState<DetalhePedido[]>([]);
  const [loadingInicial, setLoadingInicial] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<DetalhePedido | null>(null);

  useEffect(() => {
    AudioLogger.log("INSTANCE_INIT", "Inicializando painel de áudio");

    let ativo = true;
    let isLoading = false;

    const carregar = async () => {
      if (!ativo) return;

      if (isLoading) {
        AudioLogger.log(
          "POLL_SKIP",
          "Pulando busca porque ainda tem uma requisição em andamento"
        );
        return;
      }
      isLoading = true;

      try {
        const lista = await buscarPedidosPendentes();
        if (!ativo) return;

        // ❌ Erro/timeout: NÃO mexer em pedidos
        if (lista === null) {
          console.warn("⚠ Erro/timeout — mantendo últimos dados");
          setErro("Erro ao atualizar pedidos (mantendo últimos pedidos).");
          setLoadingInicial(false);
          return;
        }

        // ✅ Sucesso: limpa erro
        setErro(null);
        setLoadingInicial(false);

        // ✅ Sucesso com lista vazia
        if (lista.length === 0) {
          console.log("✔ Sem pedidos pendentes");
          setPedidos([]);
          setSelecionado(null);
          return;
        }

        // ✅ Sucesso com pedidos
        dispararAlertasVoz(lista);
        setPedidos(lista);

        setSelecionado((anterior) => {
          if (!anterior) return lista[0] ?? null;
          const aindaExiste = lista.find(
            (p) => p.nunota === anterior.nunota
          );
          return aindaExiste ?? lista[0] ?? null;
        });
      } catch (e) {
        console.error("Falha inesperada ao buscar pedidos:", e);
        if (ativo) {
          // fallback: erro inesperado (bug, parse, etc)
          setLoadingInicial(false);
          setErro("Erro ao atualizar pedidos (mantendo últimos pedidos).");
        }
      } finally {
        isLoading = false;
      }
    };

    // primeira carga
    carregar();
    // pooling a cada 5s
    const interval = setInterval(carregar, 5000);

    return () => {
      ativo = false;
      clearInterval(interval);
      limparFilaAudio();
    };
  }, []);

  return {
    pedidos,
    loadingInicial,
    erro,
    selecionado,
    setSelecionado,
  };
}
