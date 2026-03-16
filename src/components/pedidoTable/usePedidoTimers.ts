import { useEffect, useState } from "react";
import type { DetalhePedido } from "../../types/conferencia";
import { FINAL_OK_COLORS } from "./constants";
import { normalizeStatus } from "./helpers";
import { saveOptimisticFinalized, saveTimers, type OptimisticFinalizedByNunota, type TimerMap } from "./storage";
import { statusColors, statusMap } from "../../config/status";

interface UsePedidoTimersParams {
  pedidos: DetalhePedido[];
  optimisticFinalizedByNunota: OptimisticFinalizedByNunota;
  setOptimisticFinalizedByNunota: React.Dispatch<React.SetStateAction<OptimisticFinalizedByNunota>>;
}

export function usePedidoTimers({
  pedidos,
  optimisticFinalizedByNunota,
  setOptimisticFinalizedByNunota,
}: UsePedidoTimersParams) {
  const [timerByNunota, setTimerByNunota] = useState<TimerMap>({});

  function isOptimisticFinal(nunota: number) {
    const exp = Number(optimisticFinalizedByNunota[nunota] ?? 0);
    return exp > Date.now();
  }

  function marcarOptimisticFinal(nunota: number, ttlMs: number) {
    const exp = Date.now() + ttlMs;
    setOptimisticFinalizedByNunota((prev) => {
      const next = { ...prev, [nunota]: exp };
      saveOptimisticFinalized(next);
      return next;
    });
  }

  function removerOptimisticFinal(nunota: number) {
    setOptimisticFinalizedByNunota((prev) => {
      if (!(nunota in prev)) return prev;
      const next = { ...prev };
      delete next[nunota];
      saveOptimisticFinalized(next);
      return next;
    });
  }

  function getVisualStatus(p: DetalhePedido) {
    const statusBase = statusMap[(p as any).statusConferencia] || "-";
    const isFinalizadaOk = statusBase === "Finalizada OK";

    if (isFinalizadaOk) {
      return {
        label: "Finalizada OK",
        colors: statusColors[(p as any).statusConferencia] || FINAL_OK_COLORS,
        isFinalOk: true,
        isOptimistic: false,
      };
    }

    if (isOptimisticFinal(p.nunota)) {
      return {
        label: "Finalizada OK",
        colors: FINAL_OK_COLORS,
        isFinalOk: true,
        isOptimistic: true,
      };
    }

    return {
      label: statusBase,
      colors: statusColors[(p as any).statusConferencia] || statusColors.AL,
      isFinalOk: false,
      isOptimistic: false,
    };
  }

  useEffect(() => {
    if (!pedidos?.length) return;

    setTimerByNunota((prev) => {
      const next: TimerMap = { ...prev };
      const now = Date.now();

      for (const p of pedidos) {
        const nunota = p.nunota;
        const statusCode = normalizeStatus((p as any).statusConferencia);
        const visual = getVisualStatus(p);
        const isFinalizadaOk = visual.isFinalOk;

        if (isFinalizadaOk && !visual.isOptimistic) removerOptimisticFinal(nunota);

        const current = next[nunota] ?? { startAt: null, elapsedMs: 0, running: false };

        if (statusCode === "AC" && !isFinalizadaOk) {
          next[nunota] = !current.running
            ? { startAt: now, elapsedMs: current.elapsedMs, running: true }
            : current;
          continue;
        }

        if (isFinalizadaOk) {
          if (current.running && current.startAt) {
            const elapsed = current.elapsedMs + (now - current.startAt);
            next[nunota] = { startAt: null, elapsedMs: elapsed, running: false };
          } else {
            next[nunota] = { startAt: null, elapsedMs: current.elapsedMs, running: false };
          }
          continue;
        }

        if (current.running && current.startAt) {
          const elapsed = current.elapsedMs + (now - current.startAt);
          next[nunota] = { startAt: null, elapsedMs: elapsed, running: false };
        } else {
          next[nunota] = current;
        }
      }

      saveTimers(next);
      return next;
    });
  }, [pedidos, optimisticFinalizedByNunota]);

  return {
    timerByNunota,
    setTimerByNunota,
    isOptimisticFinal,
    marcarOptimisticFinal,
    removerOptimisticFinal,
    getVisualStatus,
  };
}