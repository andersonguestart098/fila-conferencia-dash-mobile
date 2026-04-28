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
import { normalizeStatus } from "./helpers";

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
    const payload = {
      nunota: Number(nunota),
      nome: conf.nome,
      codUsuario: Number(conf.codUsuario),
    };

    console.log("📤 [CONFERENCIA] POST definir conferente", payload);

    const res = await api.post(ROTA_DEFINIR_CONFERENTE, payload);

    console.log("✅ [CONFERENCIA] definir conferente OK", {
      nunota,
      response: res.data,
    });

    return res.data;
  }

  async function iniciarEObterNuconf(nunotaOrig: number, codUsuario: number): Promise<number> {
    const payload = {
      nunotaOrig: Number(nunotaOrig),
      codUsuario: Number(codUsuario),
    };

    console.log("📤 [CONFERENCIA] POST iniciar", payload);

    const res = await api.post(ROTA_INICIAR, payload);

    console.log("✅ [CONFERENCIA] iniciar OK", {
      nunotaOrig,
      response: res.data,
    });

    const nuconf = Number(res?.data?.nuconf ?? 0);

    if (!nuconf) {
      throw new Error(`Não consegui ler nuconf do /iniciar para o pedido #${nunotaOrig}`);
    }

    return nuconf;
  }

  async function finalizarConferenciaViaBackend(nuconf: number, codUsuario: number) {
    const payload = {
      nuconf: Number(nuconf),
      codUsuario: Number(codUsuario),
    };

    console.log("📤 [CONFERENCIA] POST finalizar", payload);

    const res = await api.post(ROTA_FINALIZAR, payload);

    console.log("✅ [CONFERENCIA] finalizar OK", {
      nuconf,
      response: res.data,
    });

    return res.data;
  }

  function getNuconfDoPayload(p: DetalhePedido): number {
    return Number((p as any).nuconf ?? 0);
  }

  function getNuconfDoCache(nunota: number): number {
    return Number(nuconfByNunota[nunota] ?? 0);
  }

  function podeIniciarPeloStatus(p: DetalhePedido): boolean {
    const status = normalizeStatus((p as any).statusConferencia);
    return status === "A" || status === "AL";
  }

async function garantirNuconf(p: DetalhePedido, codUsuario: number): Promise<number> {
  const nunota = Number(p.nunota);
  const status = normalizeStatus((p as any).statusConferencia);

  const nuconfPayload = getNuconfDoPayload(p);
  if (nuconfPayload > 0) {
    console.log("ℹ️ [CONFERENCIA] usando nuconf do payload", {
      nunota,
      status,
      nuconf: nuconfPayload,
    });
    return nuconfPayload;
  }

  const nuconfCache = getNuconfDoCache(nunota);
  if (nuconfCache > 0) {
    console.log("ℹ️ [CONFERENCIA] usando nuconf do cache", {
      nunota,
      status,
      nuconf: nuconfCache,
    });
    return nuconfCache;
  }

  if (podeIniciarPeloStatus(p)) {
    console.log("ℹ️ [CONFERENCIA] sem nuconf, iniciando conferência", {
      nunota,
      status,
      codUsuario,
    });

    const nuconfNovo = await iniciarEObterNuconf(nunota, codUsuario);

    setNuconfByNunota((prev) => {
      const next = { ...prev, [nunota]: nuconfNovo };
      saveNuconfByNunota(next);
      return next;
    });

    return nuconfNovo;
  }

  if (status === "AC") {
    console.warn("⚠️ [CONFERENCIA] AC sem nuconf → tratando como A e iniciando nova conferência", {
      nunota,
      status,
      codUsuario,
      nuconfPayload,
      nuconfCache,
    });

    const nuconfNovo = await iniciarEObterNuconf(nunota, codUsuario);

    setNuconfByNunota((prev) => {
      const next = { ...prev, [nunota]: nuconfNovo };
      saveNuconfByNunota(next);
      return next;
    });

    return nuconfNovo;
  }

  throw new Error(
    `Não foi possível garantir NUCONF para o pedido #${nunota}. Status atual: ${status || "(vazio)"}.`
  );
}

  async function confirmarConferenteEFinalizar(p: DetalhePedido, conf: Conferente) {
    setLoadingConfirmacao(p.nunota);

    try {
      const codUsuario = Number(conf.codUsuario);
      const nunota = Number(p.nunota);
      const status = normalizeStatus((p as any).statusConferencia);

      if (!Number.isFinite(codUsuario) || codUsuario <= 0) {
        throw new Error("Conferente inválido.");
      }

      console.log("🚀 [CONFERENCIA] iniciar fluxo de confirmação/finalização", {
        nunota,
        status,
        conferente: {
          codUsuario,
          nome: conf.nome,
        },
        nuconfPayload: Number((p as any).nuconf ?? 0),
        nuconfCache: Number(nuconfByNunota[p.nunota] ?? 0),
      });

      setConferenteByNunota((prev) => {
        const next = { ...prev, [p.nunota]: { ...conf, codUsuario } };
        saveConferenteByNunota(next);
        return next;
      });

      await definirConferenteNoBackend(nunota, { ...conf, codUsuario });

      const nuconf = await garantirNuconf(p, codUsuario);

      await finalizarConferenciaViaBackend(nuconf, codUsuario);

      marcarOptimisticFinal(nunota);

      setSuccessModal({
        open: true,
        nunota,
        nuconf,
        conferenteNome: conf.nome,
      });

      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error("❌ [CONFERENCIA] erro ao finalizar", {
        nunota: p.nunota,
        status: (p as any).statusConferencia,
        nuconfPayload: (p as any).nuconf,
        nuconfCache: nuconfByNunota[p.nunota],
        message: err?.message,
        responseStatus: err?.response?.status,
        responseData: err?.response?.data,
      });

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