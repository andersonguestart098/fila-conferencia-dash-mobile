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

  async function iniciarEObterNuconf(
    nunotaOrig: number,
    codUsuario: number
  ): Promise<number> {
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

  async function finalizarConferenciaViaBackend(
    nuconf: number,
    nunotaOrig: number,
    codUsuario: number
  ) {
    const payload = {
      nuconf: Number(nuconf),
      nunotaOrig: Number(nunotaOrig),
      codUsuario: Number(codUsuario),
    };

    console.log("📤 [CONFERENCIA] POST finalizar", payload);

    const res = await api.post(ROTA_FINALIZAR, payload);

    console.log("✅ [CONFERENCIA] finalizar OK", {
      nuconf,
      nunotaOrig,
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

  function salvarNuconfLocal(nunota: number, nuconf: number) {
    setNuconfByNunota((prev) => {
      const next = { ...prev, [nunota]: nuconf };
      saveNuconfByNunota(next);
      return next;
    });
  }

  async function iniciarConferenciaPedido(p: DetalhePedido, conf: Conferente) {
    setLoadingConfirmacao(p.nunota);

    try {
      const nunota = Number(p.nunota);
      const codUsuario = Number(conf.codUsuario);
      const status = normalizeStatus((p as any).statusConferencia);

      if (!Number.isFinite(codUsuario) || codUsuario <= 0) {
        throw new Error("Conferente inválido.");
      }

      const nuconfPayload = getNuconfDoPayload(p);
      const nuconfCache = getNuconfDoCache(nunota);

      if (nuconfPayload > 0 || nuconfCache > 0 || status === "A") {
        const nuconfExistente = nuconfPayload || nuconfCache;

        console.log("ℹ️ [CONFERENCIA] pedido já iniciado", {
          nunota,
          status,
          nuconf: nuconfExistente,
        });

        if (nuconfExistente > 0) {
          salvarNuconfLocal(nunota, nuconfExistente);
        }

        return nuconfExistente;
      }

      setConferenteByNunota((prev) => {
        const next = { ...prev, [nunota]: { ...conf, codUsuario } };
        saveConferenteByNunota(next);
        return next;
      });

      await definirConferenteNoBackend(nunota, { ...conf, codUsuario });

      const nuconfNovo = await iniciarEObterNuconf(nunota, codUsuario);

      salvarNuconfLocal(nunota, nuconfNovo);

      console.log("✅ [CONFERENCIA] conferência iniciada com sucesso", {
        nunota,
        nuconf: nuconfNovo,
        conferente: conf.nome,
      });

      if (onRefresh) onRefresh();

      return nuconfNovo;
    } catch (err: any) {
      console.error("❌ [CONFERENCIA] erro ao iniciar", {
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

  async function garantirNuconf(p: DetalhePedido): Promise<number> {
    const nunota = Number(p.nunota);
    const status = normalizeStatus((p as any).statusConferencia);

    const nuconfPayload = getNuconfDoPayload(p);
    if (nuconfPayload > 0) return nuconfPayload;

    const nuconfCache = getNuconfDoCache(nunota);
    if (nuconfCache > 0) return nuconfCache;

    throw new Error(
      `Pedido #${nunota} ainda não foi iniciado. Clique em Iniciar antes de finalizar. Status atual: ${status || "(vazio)"}.`
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

      console.log("🚀 [CONFERENCIA] iniciar fluxo de finalização", {
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

      const nuconf = await garantirNuconf(p);

      await finalizarConferenciaViaBackend(nuconf, nunota, codUsuario);

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
    iniciarConferenciaPedido,
    confirmarConferenteEFinalizar,
  };
}