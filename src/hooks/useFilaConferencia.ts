// src/hooks/useFilaConferencia.ts
import { useCallback, useEffect, useState } from "react";
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
  refresh: () => Promise<void>;
}

export function useFilaConferencia(): UseFilaConferenciaResult {
  const [pedidos, setPedidos] = useState<DetalhePedido[]>([]);
  const [loadingInicial, setLoadingInicial] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<DetalhePedido | null>(null);

  const carregar = useCallback(async () => {
    try {
      const lista = await buscarPedidosPendentes();

      if (lista === null) {
        console.warn("⚠ Erro/timeout — mantendo últimos dados");
        setErro("Erro ao atualizar pedidos (mantendo últimos pedidos).");
        setLoadingInicial(false);
        return;
      }

      setErro(null);
      setLoadingInicial(false);

      if (lista.length === 0) {
        console.log("✔ Sem pedidos pendentes");
        setPedidos([]);
        setSelecionado(null);
        return;
      }

      dispararAlertasVoz(lista);
      setPedidos(lista);

      setSelecionado((anterior) => {
        if (!anterior) return lista[0] ?? null;

        const aindaExiste = lista.find((p) => p.nunota === anterior.nunota);

        return aindaExiste ?? lista[0] ?? null;
      });
    } catch (e) {
      console.error("Falha inesperada ao buscar pedidos:", e);
      setLoadingInicial(false);
      setErro("Erro ao atualizar pedidos (mantendo últimos pedidos).");
    }
  }, []);

  useEffect(() => {
    AudioLogger.log("INSTANCE_INIT", "Inicializando painel de áudio");

    carregar();

    return () => {
      limparFilaAudio();
    };
  }, [carregar]);

  return {
    pedidos,
    loadingInicial,
    erro,
    selecionado,
    setSelecionado,
    refresh: carregar,
  };
}