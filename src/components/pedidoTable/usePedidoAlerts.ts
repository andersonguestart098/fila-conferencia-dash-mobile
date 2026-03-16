import { useEffect, useRef, useState } from "react";
import type { DetalhePedido } from "../../types/conferencia";
import { normalizeStatus } from "./helpers";
import { dispararAlertasVoz } from "../../../public/audio/audioManager";

function tocarSomAlerta() {
  try {
    const audio = new Audio("/audio/efeitoSonoro.wav");
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch {}
}

interface Params {
  pedidos: DetalhePedido[];
  somAlertaDesativado: boolean;
  timerByNunota: Record<number, { startAt: number | null; elapsedMs: number; running: boolean }>;
  isOptimisticFinal: (nunota: number) => boolean;
}

export function usePedidoAlerts({
  pedidos,
  somAlertaDesativado,
  timerByNunota,
  isOptimisticFinal,
}: Params) {
  const ultimoAlertaSomRef = useRef<number>(0);
  const somIntervalRef = useRef<number | null>(null);
  const [ultimosStatus, setUltimosStatus] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!pedidos.length) return;
    dispararAlertasVoz(pedidos);
  }, [pedidos]);

  useEffect(() => {
    if (!pedidos?.length || somAlertaDesativado) return;

    const novosStatus: Record<number, string> = {};
    pedidos.forEach((p) => (novosStatus[p.nunota] = normalizeStatus((p as any).statusConferencia)));

    pedidos.forEach((p) => {
      const nunota = p.nunota;
      const novoStatus = novosStatus[nunota];
      const statusAnterior = ultimosStatus[nunota];

      if (novoStatus === "AC" && statusAnterior !== "AC") {
        setTimeout(() => tocarSomAlerta(), 100);
      }
    });

    setUltimosStatus(novosStatus);
  }, [pedidos, somAlertaDesativado]);

  useEffect(() => {
    if (!pedidos?.length || somAlertaDesativado) {
      if (somIntervalRef.current) {
        window.clearInterval(somIntervalRef.current);
        somIntervalRef.current = null;
      }
      return;
    }

    const pedidosComMaisDe5Min = pedidos.filter((p) => {
      if (normalizeStatus((p as any).statusConferencia) !== "AC") return false;
      if (isOptimisticFinal(p.nunota)) return false;

      const timer = timerByNunota[p.nunota];
      if (!timer) return false;

      const now = Date.now();
      const elapsedMs = timer.running && timer.startAt ? timer.elapsedMs + (now - timer.startAt) : timer.elapsedMs;

      return elapsedMs >= 5 * 60 * 1000;
    });

    if (pedidosComMaisDe5Min.length > 0) {
      if (!somIntervalRef.current) {
        somIntervalRef.current = window.setInterval(() => {
          const agora = Date.now();
          if (agora - ultimoAlertaSomRef.current >= 5000) {
            tocarSomAlerta();
            ultimoAlertaSomRef.current = agora;
          }
        }, 5000);
      }
    } else if (somIntervalRef.current) {
      window.clearInterval(somIntervalRef.current);
      somIntervalRef.current = null;
    }

    return () => {
      if (somIntervalRef.current) {
        window.clearInterval(somIntervalRef.current);
        somIntervalRef.current = null;
      }
    };
  }, [pedidos, timerByNunota, somAlertaDesativado, isOptimisticFinal]);

  return {
    tocarSomAlerta,
  };
}