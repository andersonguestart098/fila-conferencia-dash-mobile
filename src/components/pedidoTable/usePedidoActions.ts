import { useState } from "react";
import type { DetalhePedido } from "../../types/conferencia";
import { api } from "../../api/client";
import {
  ROTA_DEFINIR_CONFERENTE,
  ROTA_FINALIZAR,
  ROTA_INICIAR,
} from "./constants";
import {
  saveConferenteByNunota,
  saveNuconfByNunota,
  type Conferente,
  type ConferenteByNunota,
  type NuconfByNunota,
} from "./storage";

interface UsePedidoActionsParams {
  nuconfByNunota: NuconfByNunota;
  setNuconfByNunota: React.Dispatch<React.SetStateAction<NuconfByNunota>>;
  setConferenteByNunota: React.Dispatch<React.SetStateAction<ConferenteByNunota>>;
  marcarOptimisticFinal: (nunota: number) => void;
  onRefresh?: () => void;
}

export function usePedidoActions({
  nuconfByNunota,
  setNuconfByNunota,
  setConferenteByNunota,
  marcarOptimisticFinal,
  onRefresh,
}: UsePedidoActionsParams) {
  const [loadingConfirmacao, setLoadingConfirmacao] = useState<number | null>(null);

  const [successModal, setSuccessModal] = useState<{
    open: boolean;
    nunota: number | null;
    nuconf: number | null;
    conferenteNome: string | null;
  }>({
    open: false,
    nunota: null,
    nuconf: null,
    conferenteNome: null,
  });

  async function definirConferenteNoBackend(nunota: number, conf: Conferente) {
    const res = await api.post(ROTA_DEFINIR_CONFERENTE, {
      nunota,
      nome: conf.nome,
      codUsuario: conf.codUsuario,
    });
    return res.data;
  }

  async function iniciarEObterNuconf(nunotaOrig: number, codUsuario: number): Promise<number> {
    const res = await api.post(ROTA_INICIAR, { nunotaOrig, codUsuario });
    const nuconf = Number(res?.data?.nuconf ?? 0);
    if (!nuconf) throw new Error(`Não consegui ler nuconf do /iniciar para o pedido #${nunotaOrig}`);
    return nuconf;
  }

  async function finalizarConferenciaViaBackend(nuconf: number, codUsuario: number) {
    const res = await api.post(ROTA_FINALIZAR, { nuconf, codUsuario });
    return res.data;
  }

  async function garantirNuconf(p: DetalhePedido, codUsuario: number): Promise<number> {
    const payload = Number((p as any).nuconf ?? 0);
    if (payload) return payload;

    const cached = Number(nuconfByNunota[p.nunota] ?? 0);
    if (cached) return cached;

    const nuconf = await iniciarEObterNuconf(p.nunota, codUsuario);

    setNuconfByNunota((prev) => {
      const next = { ...prev, [p.nunota]: nuconf };
      saveNuconfByNunota(next);
      return next;
    });

    return nuconf;
  }

async function confirmarConferenteEFinalizar(p: DetalhePedido, conf: Conferente) {
  setLoadingConfirmacao(p.nunota);

  try {
    setConferenteByNunota((prev) => {
      const next = { ...prev, [p.nunota]: conf };
      saveConferenteByNunota(next);
      return next;
    });

    await definirConferenteNoBackend(p.nunota, conf);
    const nuconf = await garantirNuconf(p, conf.codUsuario);
    await finalizarConferenciaViaBackend(nuconf, conf.codUsuario);

    marcarOptimisticFinal(p.nunota);

    setSuccessModal({
      open: true,
      nunota: p.nunota,
      nuconf,
      conferenteNome: conf.nome,
    });

    if (onRefresh) onRefresh();
  } catch (err: any) {
    console.error("❌ erro ao finalizar:", err);
    throw err;
  } finally {
    setLoadingConfirmacao(null);
  }
}

  return {
    loadingConfirmacao,
    successModal,
    setSuccessModal,
    confirmarConferenteEFinalizar,
  };
}