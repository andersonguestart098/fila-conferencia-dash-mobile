import { useCallback, useEffect, useRef, useState } from "react";
import type { DetalhePedido } from "../types/conferencia";
import { buscarFilaDb } from "../api/conferencia";
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
  aplicarStatusLocal: (
    nunota: number,
    statusConferencia: string,
    nuconf?: number | null
  ) => void;
}

const STATUS_REMOVER = new Set(["EXCLUIDO"]);

export function useFilaConferencia(): UseFilaConferenciaResult {
  const [pedidos, setPedidos] = useState<DetalhePedido[]>([]);
  const [loadingInicial, setLoadingInicial] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<DetalhePedido | null>(null);

  // NUNOTAs que o SSE já marcou para remover da fila.
  // Veto: mesmo que a API retorne o pedido, ele não volta.
  const removidosRef = useRef<Set<number>>(new Set());

  const removerDaFila = useCallback((nunota: number) => {
    removidosRef.current.add(Number(nunota));

    setPedidos((prev) =>
      prev.filter((p) => Number(p.nunota) !== Number(nunota))
    );

    setSelecionado((atual) => {
      if (!atual || Number(atual.nunota) !== Number(nunota)) return atual;
      return null;
    });
  }, []);

  const aplicarStatusLocal = useCallback(
    (nunota: number, statusConferencia: string, nuconf?: number | null) => {
      const st = String(statusConferencia ?? "").trim().toUpperCase();

      console.log("⚡ [LOCAL_STATUS_UPDATE]", { nunota, statusConferencia: st, nuconf });

      // F ou EXCLUIDO → remove da fila imediatamente
      if (STATUS_REMOVER.has(st)) {
        removerDaFila(nunota);
        return;
      }

      // Outros status (AC, A, etc.) → atualiza o campo
      setPedidos((prev) =>
        prev.map((p) => {
          if (Number(p.nunota) !== Number(nunota)) return p;
          return {
            ...p,
            statusConferencia: st,
            nuconf: nuconf && nuconf > 0 ? nuconf : (p as any).nuconf,
          } as DetalhePedido;
        })
      );

      setSelecionado((atual) => {
        if (!atual || Number(atual.nunota) !== Number(nunota)) return atual;
        return {
          ...atual,
          statusConferencia: st,
          nuconf: nuconf && nuconf > 0 ? nuconf : (atual as any).nuconf,
        } as DetalhePedido;
      });
    },
    [removerDaFila]
  );

  const carregar = useCallback(async () => {
    try {
      const lista = await buscarFilaDb();

      if (lista === null) {
        console.warn("⚠ Erro/timeout — mantendo últimos dados");
        setErro("Erro ao atualizar pedidos (mantendo últimos pedidos).");
        setLoadingInicial(false);
        return;
      }

      setErro(null);
      setLoadingInicial(false);

      // Filtra pedidos que o SSE já marcou para remover
      const removidos = removidosRef.current;
      const listaFiltrada = lista.filter(
        (p) => !removidos.has(Number(p.nunota))
      );

      if (listaFiltrada.length === 0) {
        console.log("✔ Sem pedidos na fila");
        setPedidos([]);
        setSelecionado(null);
        return;
      }

      const pendentes = listaFiltrada.filter(
        (p) => String(p.statusConferencia ?? "").toUpperCase() !== "F"
      );
      dispararAlertasVoz(pendentes);
      setPedidos(listaFiltrada);

      setSelecionado((anterior) => {
        if (!anterior) return listaFiltrada[0] ?? null;
        const aindaExiste = listaFiltrada.find(
          (p) => p.nunota === anterior.nunota
        );
        return aindaExiste ?? listaFiltrada[0] ?? null;
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
    return () => { limparFilaAudio(); };
  }, [carregar]);

  return {
    pedidos,
    loadingInicial,
    erro,
    selecionado,
    setSelecionado,
    refresh: carregar,
    aplicarStatusLocal,
  };
}