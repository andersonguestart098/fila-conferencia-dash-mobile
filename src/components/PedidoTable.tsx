// src/components/PedidoTable.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { DetalhePedido } from "../types/conferencia";
import { statusColors, statusMap } from "../config/status";
import { dispararAlertasVoz } from "../../public/audio/audioManager";
import { api } from "../api/client";
import { Portal } from "./Portal";

interface PedidoTableProps {
  pedidos: DetalhePedido[];
  loadingInicial: boolean;
  erro: string | null;

  selecionado: DetalhePedido | null;
  onSelect: (pedido: DetalhePedido) => void;

  onRefresh?: () => void;
}

const ITENS_POR_PAGINA = 50;

// ✅ rotas REAIS do teu backend (ConferenciaController)
const ROTA_INICIAR = "/api/conferencia/iniciar";
const ROTA_DEFINIR_CONFERENTE = "/api/conferencia/conferente";
const ROTA_FINALIZAR = "/api/conferencia/finalizar";

// ⏳ por quanto tempo manter o "Finalizada OK" visual antes do backend atualizar
const OPTIMISTIC_FINAL_TTL_MS = 65_000;

const VENDEDORES: string[] = [
  "LUIS TIZONI",
  "MARCIA MELLER",
  "JONATHAS RODRIGUES",
  "PAULO FAGUNDES",
  "RAFAEL AZEVEDO",
  "GB",
  "GILIARD CAMPOS",
  "SABINO BRESOLIN",
  "GUILHERME FRANCA",
  "LEONARDO MACHADO",
  "EDUARDO SANTOS",
  "RICARDO MULLER",
  "GABRIEL AIRES",
  "GASPAR TARTARI",
  "FERNANDO SERAFIM",
  "DAIANE CAMPOS",
  "FELIPE TARTARI",
  "BETO TARTARI",
  "DANIEL MACCARI",
];

type Conferente = { codUsuario: number; nome: string };
const CONFERENTES: Conferente[] = [
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

function normalizeStatus(status: any): string {
  return String(status ?? "").trim().toUpperCase();
}

function formatElapsed(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function tocarSomAlerta() {
  try {
    const audio = new Audio("/audio/efeitoSonoro.wav");
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch {}
}

type TimerState = { startAt: number | null; elapsedMs: number; running: boolean };
type TimerMap = Record<number, TimerState>;

function loadTimers(): TimerMap {
  try {
    const raw = localStorage.getItem("timerByNunota");
    if (!raw) return {};
    return (JSON.parse(raw) as TimerMap) ?? {};
  } catch {
    return {};
  }
}
function saveTimers(next: TimerMap) {
  try {
    localStorage.setItem("timerByNunota", JSON.stringify(next));
  } catch {}
}

// ✅ salva conferente por pedido (local)
type ConferenteByNunota = Record<number, Conferente>;
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
  } catch {}
}

/**
 * ✅ Regras para habilitar "Finalizar"
 * - Aguardando conferência: statusCode === "AC"
 * - Em andamento: statusCode === "A"
 */
function podeFinalizar(statusCode: string) {
  return statusCode === "AC" || statusCode === "A";
}

/** ✅ checklist por pedido (localStorage) */
type CheckedItemsByNunota = Record<number, Record<string, boolean>>;
function loadCheckedItems(): CheckedItemsByNunota {
  try {
    return JSON.parse(localStorage.getItem("checkedItemsByNunota") || "{}");
  } catch {
    return {};
  }
}
function saveCheckedItems(next: CheckedItemsByNunota) {
  try {
    localStorage.setItem("checkedItemsByNunota", JSON.stringify(next));
  } catch {}
}

function itemKey(item: any, idx: number) {
  const cod = item?.codProd ?? item?.codigo ?? "X";
  return `${cod}-${idx}`;
}

// ✅ quantidade conferida por item (localStorage)
type QtdByNunota = Record<number, Record<string, number | "">>;
function loadQtdByNunota(): QtdByNunota {
  try {
    return JSON.parse(localStorage.getItem("qtdConferidaByNunota") || "{}");
  } catch {
    return {};
  }
}
function saveQtdByNunota(next: QtdByNunota) {
  try {
    localStorage.setItem("qtdConferidaByNunota", JSON.stringify(next));
  } catch {}
}

// ✅ cache local: nunota -> nuconf (pra não chamar /iniciar sempre)
type NuconfByNunota = Record<number, number>;
function loadNuconfByNunota(): NuconfByNunota {
  try {
    return JSON.parse(localStorage.getItem("nuconfByNunota") || "{}");
  } catch {
    return {};
  }
}
function saveNuconfByNunota(next: NuconfByNunota) {
  try {
    localStorage.setItem("nuconfByNunota", JSON.stringify(next));
  } catch {}
}

// ✅ cache optimistic: nunota -> expiresAt
type OptimisticFinalizedByNunota = Record<number, number>;
function loadOptimisticFinalized(): OptimisticFinalizedByNunota {
  try {
    return JSON.parse(localStorage.getItem("optimisticFinalizedByNunota") || "{}");
  } catch {
    return {};
  }
}
function saveOptimisticFinalized(next: OptimisticFinalizedByNunota) {
  try {
    localStorage.setItem("optimisticFinalizedByNunota", JSON.stringify(next));
  } catch {}
}

// ✅ “cores verdes” pro estado final (quando a gente força visualmente)
const FINAL_OK_COLORS = {
  bg: "rgba(22, 163, 74, 0.10)",
  border: "rgba(22, 163, 74, 0.55)",
  text: "#16a34a",
};

export function PedidoTable({ pedidos, loadingInicial, erro, onSelect, onRefresh }: PedidoTableProps) {
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);

  const [somenteAguardando, setSomenteAguardando] = useState(false);
  const [vendedorFiltro, setVendedorFiltro] = useState<string | null>(null);

  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [somAlertaDesativado, setSomAlertaDesativado] = useState(false);

  const [conferentesBackend] = useState<Conferente[]>(CONFERENTES);

  const [timerByNunota, setTimerByNunota] = useState<TimerMap>(() => loadTimers());
  const [conferenteByNunota, setConferenteByNunota] = useState<ConferenteByNunota>(() => loadConferenteByNunota());
  const [nuconfByNunota, setNuconfByNunota] = useState<NuconfByNunota>(() => loadNuconfByNunota());

  const [optimisticFinalizedByNunota, setOptimisticFinalizedByNunota] =
    useState<OptimisticFinalizedByNunota>(() => loadOptimisticFinalized());

  const [expandedNunota, setExpandedNunota] = useState<number | null>(null);

  // modal de finalizar
  const [finalizarNunotaOpen, setFinalizarNunotaOpen] = useState<number | null>(null);
  const [finalizarConferenteId, setFinalizarConferenteId] = useState<number | "">("");

  const [loadingConfirmacao, setLoadingConfirmacao] = useState<number | null>(null);

  const ultimoAlertaSomRef = useRef<number>(0);
  const somIntervalRef = useRef<number | null>(null);
  const [ultimosStatus, setUltimosStatus] = useState<Record<number, string>>({});

  const [checkedByNunota, setCheckedByNunota] = useState<CheckedItemsByNunota>(() => loadCheckedItems());

  // ✅ qtd digitada por item
  const [qtdByNunota, setQtdByNunota] = useState<QtdByNunota>(() => loadQtdByNunota());

  const [successModal, setSuccessModal] = useState<{
    open: boolean;
    nunota: number | null;
    nuconf: number | null;
    conferenteNome: string | null;
  }>({ open: false, nunota: null, nuconf: null, conferenteNome: null });

  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => forceTick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      setOptimisticFinalizedByNunota((prev) => {
        let changed = false;
        const next: OptimisticFinalizedByNunota = { ...prev };
        for (const k of Object.keys(next)) {
          const nunota = Number(k);
          if (!nunota) continue;
          if (Number(next[nunota] ?? 0) <= now) {
            delete next[nunota];
            changed = true;
          }
        }
        if (changed) saveOptimisticFinalized(next);
        return changed ? next : prev;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;

      setFiltrosOpen(false);

      if (successModal.open) {
        setSuccessModal({ open: false, nunota: null, nuconf: null, conferenteNome: null });
      }

      if (finalizarNunotaOpen !== null && loadingConfirmacao === null) {
        setFinalizarNunotaOpen(null);
        setFinalizarConferenteId("");
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [successModal.open, finalizarNunotaOpen, loadingConfirmacao]);

  useEffect(() => {
    const anyOpen = successModal.open || finalizarNunotaOpen !== null;
    if (!anyOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [successModal.open, finalizarNunotaOpen]);

  function isOptimisticFinal(nunota: number) {
    const exp = Number(optimisticFinalizedByNunota[nunota] ?? 0);
    return exp > Date.now();
  }

  function marcarOptimisticFinal(nunota: number) {
    const exp = Date.now() + OPTIMISTIC_FINAL_TTL_MS;
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

  function getVisualStatus(p: any): { label: string; colors: any; isFinalOk: boolean; isOptimistic: boolean } {
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
          if (!current.running) next[nunota] = { startAt: now, elapsedMs: current.elapsedMs, running: true };
          else next[nunota] = current;
          continue;
        }

        if (isFinalizadaOk) {
          if (current.running && current.startAt) {
            const elapsed = current.elapsedMs + (now - current.startAt);
            next[nunota] = { startAt: null, elapsedMs: elapsed, running: false };
          } else next[nunota] = { startAt: null, elapsedMs: current.elapsedMs, running: false };
          continue;
        }

        if (current.running && current.startAt) {
          const elapsed = current.elapsedMs + (now - current.startAt);
          next[nunota] = { startAt: null, elapsedMs: elapsed, running: false };
        } else next[nunota] = current;
      }

      saveTimers(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidos, optimisticFinalizedByNunota]);

  useEffect(() => {
    if (!pedidos?.length || somAlertaDesativado) return;

    const novosStatus: Record<number, string> = {};
    pedidos.forEach((p) => (novosStatus[p.nunota] = normalizeStatus((p as any).statusConferencia)));

    pedidos.forEach((p) => {
      const nunota = p.nunota;
      const novoStatus = novosStatus[nunota];
      const statusAnterior = ultimosStatus[nunota];
      if (novoStatus === "AC" && statusAnterior !== "AC") setTimeout(() => tocarSomAlerta(), 100);
    });

    setUltimosStatus(novosStatus);
  }, [pedidos, somAlertaDesativado]); // eslint-disable-line react-hooks/exhaustive-deps

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
    } else {
      if (somIntervalRef.current) {
        window.clearInterval(somIntervalRef.current);
        somIntervalRef.current = null;
      }
    }

    return () => {
      if (somIntervalRef.current) {
        window.clearInterval(somIntervalRef.current);
        somIntervalRef.current = null;
      }
    };
  }, [pedidos, timerByNunota, somAlertaDesativado, optimisticFinalizedByNunota]);

  const toggleSomAlerta = () => {
    const novoEstado = !somAlertaDesativado;
    setSomAlertaDesativado(novoEstado);

    if (novoEstado && somIntervalRef.current) {
      window.clearInterval(somIntervalRef.current);
      somIntervalRef.current = null;
    }
  };

  const sincronizarConferentes = () => {
    try {
      localStorage.removeItem("conferenteByNunota");
      localStorage.removeItem("nuconfByNunota");
      localStorage.removeItem("optimisticFinalizedByNunota");
      // opcional:
      // localStorage.removeItem("checkedItemsByNunota");
      // localStorage.removeItem("qtdConferidaByNunota");

      if (onRefresh) onRefresh();
      alert("Cache sincronizado. Os dados serão atualizados.");
      setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      console.error("Erro ao sincronizar:", error);
      alert("Erro ao sincronizar.");
    }
  };

  useEffect(() => {
    setPagina(1);
  }, [busca, somenteAguardando, vendedorFiltro]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    let base = pedidos;

    if (somenteAguardando) base = base.filter((p) => normalizeStatus((p as any).statusConferencia) === "AC");
    if (vendedorFiltro) base = base.filter((p) => (p.nomeVendedor ?? "").toLowerCase() === vendedorFiltro.toLowerCase());
    if (!termo) return base;

    return base.filter((p) => {
      return (
        p.nunota.toString().includes(termo) ||
        p.numNota?.toString().includes(termo) ||
        p.nomeParc?.toLowerCase().includes(termo) ||
        p.nomeVendedor?.toLowerCase().includes(termo)
      );
    });
  }, [busca, pedidos, somenteAguardando, vendedorFiltro]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / ITENS_POR_PAGINA));
  const inicio = (pagina - 1) * ITENS_POR_PAGINA;
  const paginaPedidos = filtrados.slice(inicio, inicio + ITENS_POR_PAGINA);

  useEffect(() => {
    if (!pedidos.length) return;
    dispararAlertasVoz(pedidos);
  }, [pedidos]);

  function getConferenteExibicao(p: any): Conferente | null {
    const idBackend = (p as any).conferenteId as number | null | undefined;
    const nomeBackend = (p as any).conferenteNome as string | null | undefined;
    const nomeConferenteOld = (p as any).nomeConferente as string | null | undefined;

    if (idBackend && nomeBackend && nomeBackend !== "null" && nomeBackend !== "-" && nomeBackend !== "") {
      return { codUsuario: idBackend, nome: nomeBackend };
    }

    const nomeApenas =
      (nomeBackend && nomeBackend !== "null" && nomeBackend !== "-" && nomeBackend !== "" ? nomeBackend : null) ??
      (nomeConferenteOld && nomeConferenteOld !== "null" && nomeConferenteOld !== "-" && nomeConferenteOld !== ""
        ? nomeConferenteOld
        : null);

    if (nomeApenas) {
      const encontrado = conferentesBackend.find((c) => c.nome.toLowerCase() === nomeApenas.toLowerCase());
      if (encontrado) return encontrado;

      const local = conferenteByNunota[p.nunota];
      if (local && local.nome.toLowerCase() === nomeApenas.toLowerCase()) return local;

      return { codUsuario: 0, nome: nomeApenas };
    }

    return conferenteByNunota[p.nunota] ?? null;
  }

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

      setFinalizarNunotaOpen(null);
      setFinalizarConferenteId("");

      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error("❌ erro ao finalizar:", err);

      const status = err?.response?.status;
      const msgBackend = err?.response?.data?.message || err?.response?.data?.error;

      if (status === 409) {
        alert(msgBackend || "Este pedido já foi finalizado por outro usuário.");
        if (onRefresh) onRefresh();
        setFinalizarNunotaOpen(null);
        setFinalizarConferenteId("");
        return;
      }

      alert("Não consegui finalizar a conferência. Verifique o backend/logs.");
    } finally {
      setLoadingConfirmacao(null);
    }
  }

  // ✅ mantém regra: check manual NÃO preenche qtd automaticamente
  function toggleItemChecked(nunota: number, key: string) {
    setCheckedByNunota((prev) => {
      const next: any = { ...prev };
      const map = { ...(next[nunota] ?? {}) };
      map[key] = !map[key];
      next[nunota] = map;
      saveCheckedItems(next);
      return next;
    });
  }

  // ✅ NOVO: botão "Tudo" marca checks E preenche qtd esperada automaticamente
  function marcarTodos(nunota: number, itens: any[], value: boolean) {
    // 1) marca checks
    setCheckedByNunota((prev) => {
      const next: any = { ...prev };
      const map: Record<string, boolean> = { ...(next[nunota] ?? {}) };
      itens.forEach((it, idx) => {
        map[itemKey(it, idx)] = value;
      });
      next[nunota] = map;
      saveCheckedItems(next);
      return next;
    });

    // 2) preenche qtd somente quando value === true
    setQtdByNunota((prev) => {
      const next: QtdByNunota = { ...prev };
      const map = { ...(next[nunota] ?? {}) };

      if (value) {
        itens.forEach((it, idx) => {
          const k = itemKey(it, idx);
          const qtdEsperada = it.qtdConferida ?? it.qtdAtual ?? it.qtdOriginal ?? it.qtdEsperada ?? 0;
          map[k] = Math.max(0, Math.floor(Number(qtdEsperada) || 0));
        });
      } else {
        // ao limpar tudo, limpa qtd também (mantém coerência)
        itens.forEach((it, idx) => {
          const k = itemKey(it, idx);
          map[k] = "";
        });
      }

      next[nunota] = map;
      saveQtdByNunota(next);
      return next;
    });
  }

  function setQtdConferida(nunota: number, key: string, value: number | "") {
    setQtdByNunota((prev) => {
      const next: QtdByNunota = { ...prev };
      const map = { ...(next[nunota] ?? {}) };
      map[key] = value;
      next[nunota] = map;
      saveQtdByNunota(next);
      return next;
    });
  }

  function isQtdMatch(qtdEsperada: number, digitada: number | ""): boolean {
    if (digitada === "") return false; // ✅ se não digitou, não vale
    const a = Number(qtdEsperada ?? 0);
    const b = Number(digitada);
    return Number.isFinite(a) && Number.isFinite(b) && a === b;
  }

  function pedidoChecklistOk(p: DetalhePedido): { allChecked: boolean; allQtyOk: boolean; ok: boolean; done: number; okQty: number } {
    const mapCheck = checkedByNunota[p.nunota] ?? {};
    const mapQtd = qtdByNunota[p.nunota] ?? {};
    const total = p.itens.length;

    let done = 0;
    let okQty = 0;

    for (let idx = 0; idx < p.itens.length; idx++) {
      const item = p.itens[idx];
      const k = itemKey(item, idx);

      const checked = !!mapCheck[k];
      if (checked) done++;

      const qtdEsperada = item.qtdConferida ?? item.qtdAtual ?? item.qtdOriginal ?? item.qtdEsperada ?? 0;

      const digitada = mapQtd[k] ?? ""; // ✅ se vazio, não conta
      const match = isQtdMatch(Number(qtdEsperada) || 0, digitada);
      if (match) okQty++;
    }

    const allChecked = total > 0 ? done === total : false;
    const allQtyOk = total > 0 ? okQty === total : false;

    // ✅ Só libera quando TUDO está marcado E TUDO tem qtd digitada batendo.
    return { allChecked, allQtyOk, ok: allChecked && allQtyOk, done, okQty };
  }

  if (loadingInicial && pedidos.length === 0) return <div className="center">Carregando…</div>;
  if (erro && pedidos.length === 0) return <div className="center">{erro}</div>;

  const overlayStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    zIndex: 200000,
  };

  const modalStyle: CSSProperties = {
    position: "fixed",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: "min(860px, calc(100vw - 28px))",
    background: "rgba(255,255,255,0.98)",
    border: "1px solid rgba(0,0,0,0.14)",
    borderRadius: 18,
    boxShadow: "0 30px 90px rgba(0,0,0,0.28)",
    zIndex: 200001,
    overflow: "hidden",
  };

  const spinnerWhite: CSSProperties = {
    width: 18,
    height: 18,
    borderRadius: 999,
    border: "2px solid rgba(255,255,255,0.45)",
    borderTopColor: "rgba(255,255,255,1)",
    animation: "spin 0.9s linear infinite",
  };

  return (
    <div>
      {/* ✅ Modal sucesso (PORTAL) */}
      {successModal.open && (
        <Portal>
          <>
            <div
              className="modal-overlay"
              onClick={() => setSuccessModal({ open: false, nunota: null, nuconf: null, conferenteNome: null })}
            />
            <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <div className="modal-icon">✅</div>
              <div className="modal-title">Conferência finalizada!</div>

              <div className="modal-sub">
                Pedido <b>#{successModal.nunota}</b> finalizado com sucesso.
              </div>

              <div className="modal-meta">
                {successModal.nuconf ? (
                  <div>
                    <span className="modal-badge">NUCONF</span> <b>{successModal.nuconf}</b>
                  </div>
                ) : null}
                {successModal.conferenteNome ? (
                  <div style={{ marginTop: 6 }}>
                    <span className="modal-badge">Conferente</span> <b>{successModal.conferenteNome}</b>
                  </div>
                ) : null}

                <div style={{ marginTop: 10, opacity: 0.8, fontSize: 12 }}>
                  Atualizando status do backend… (pode levar alguns segundos)
                </div>
              </div>

              <div className="modal-actions">
                <button
                  className="chip chip-active"
                  onClick={() => setSuccessModal({ open: false, nunota: null, nuconf: null, conferenteNome: null })}
                  style={{ minWidth: 140 }}
                >
                  OK
                </button>
              </div>
            </div>
          </>
        </Portal>
      )}

      {/* ✅ Modal FINALIZAR (PORTAL) */}
      {finalizarNunotaOpen !== null &&
        (() => {
          const p = pedidos.find((x) => x.nunota === finalizarNunotaOpen);
          if (!p) return null;

          const isLoadingThis = loadingConfirmacao === p.nunota;
          const checklist = pedidoChecklistOk(p);
          const canConfirm = checklist.ok;

          return (
            <Portal>
              <>
                <div
                  style={overlayStyle}
                  onClick={() => {
                    if (isLoadingThis) return;
                    setFinalizarNunotaOpen(null);
                    setFinalizarConferenteId("");
                  }}
                />

                <div style={modalStyle} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "18px 18px 12px 18px",
                      borderBottom: "1px solid rgba(0,0,0,0.08)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 1000, fontSize: 20 }}>Finalizar conferência</div>
                      <div style={{ marginTop: 4, fontSize: 13, opacity: 0.8, fontWeight: 700 }}>
                        Pedido <b>#{p.nunota}</b>
                        {p.numNota ? (
                          <>
                            {" "}
                            · NF <b>{p.numNota}</b>
                          </>
                        ) : null}
                      </div>

                      {!canConfirm && (
                        <div style={{ marginTop: 8, fontSize: 12, fontWeight: 900, color: "#b91c1c" }}>
                          ⚠️ Para finalizar: marque TODOS os itens e DIGITE a quantidade conferida em cada item (sem auto-preencher).
                        </div>
                      )}

                      {/* ✅ mensagem pedida */}
                      <div style={{ marginTop: 8, fontSize: 12, fontWeight: 1000, color: "#b91c1c" }}>
                        REALIZAR CORTE PELO SANKHYA!
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (isLoadingThis) return;
                        setFinalizarNunotaOpen(null);
                        setFinalizarConferenteId("");
                      }}
                      disabled={isLoadingThis}
                      title="Fechar"
                      style={{
                        border: 0,
                        background: "rgba(0,0,0,0.05)",
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        cursor: isLoadingThis ? "not-allowed" : "pointer",
                        fontWeight: 900,
                        opacity: isLoadingThis ? 0.6 : 1,
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ padding: "16px 18px 18px 18px" }}>
                    <div style={{ fontWeight: 900, marginBottom: 10 }}>Selecionar conferente</div>

                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 14 }}>
                      <div
                        style={{
                          border: "1px solid rgba(0,0,0,0.08)",
                          borderRadius: 14,
                          padding: 14,
                          background: "rgba(0,0,0,0.015)",
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75, marginBottom: 8 }}>Conferente</div>

                        <select
                          className="select"
                          value={finalizarConferenteId}
                          onChange={(e) => {
                            const cod = Number(e.target.value || 0);
                            const found = conferentesBackend.find((c) => c.codUsuario === cod) || null;
                            setFinalizarConferenteId(found?.codUsuario ?? "");
                          }}
                          style={{ width: "100%" }}
                          disabled={isLoadingThis}
                        >
                          <option value="">Escolha…</option>
                          {conferentesBackend.map((c) => (
                            <option key={c.codUsuario} value={c.codUsuario}>
                              {c.nome}
                            </option>
                          ))}
                        </select>

                        <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12 }}>
                          Ao confirmar, vamos definir o conferente e finalizar a conferência.
                        </div>
                      </div>

                      <div
                        style={{
                          border: "1px solid rgba(0,0,0,0.08)",
                          borderRadius: 14,
                          padding: 14,
                          background: "rgba(0,0,0,0.015)",
                        }}
                      >
                        <div style={{ fontWeight: 1000, marginBottom: 10 }}>Resumo</div>

                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0" }}>
                          <span style={{ opacity: 0.8 }}>Cliente</span>
                          <b>{p.nomeParc ?? "-"}</b>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0" }}>
                          <span style={{ opacity: 0.8 }}>Vendedor</span>
                          <b>{p.nomeVendedor ?? "-"}</b>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0" }}>
                          <span style={{ opacity: 0.8 }}>Itens</span>
                          <b>{p.itens?.length ?? 0}</b>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0" }}>
                          <span style={{ opacity: 0.8 }}>Checklist</span>
                          <b style={{ color: checklist.ok ? "#16a34a" : "#c97f2a" }}>
                            {checklist.done}/{p.itens.length} checks · {checklist.okQty}/{p.itens.length} qtd ok
                          </b>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: 10,
                      padding: "12px 18px 18px 18px",
                      borderTop: "1px solid rgba(0,0,0,0.08)",
                    }}
                  >
                    <button
                      className="chip"
                      onClick={() => {
                        if (isLoadingThis) return;
                        setFinalizarNunotaOpen(null);
                        setFinalizarConferenteId("");
                      }}
                      disabled={isLoadingThis}
                    >
                      Cancelar
                    </button>

                    <button
                      className="chip chip-active"
                      onClick={() => {
                        const cod = Number(finalizarConferenteId || 0);
                        const found = conferentesBackend.find((c) => c.codUsuario === cod) || null;
                        if (!found) return alert("Selecione o conferente.");
                        if (!canConfirm)
                          return alert("Checklist incompleto: digite a quantidade conferida em todos os itens e ela precisa bater.");
                        confirmarConferenteEFinalizar(p, found);
                      }}
                      disabled={isLoadingThis || !canConfirm || !(Number(finalizarConferenteId || 0) > 0)}
                      style={{
                        minWidth: 260,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                        opacity: isLoadingThis ? 0.92 : 1,
                      }}
                      title={
                        !canConfirm
                          ? "Bloqueado: precisa marcar todos e digitar a quantidade conferida (sem auto-preencher)."
                          : "Confirmar e finalizar"
                      }
                    >
                      {isLoadingThis ? (
                        <>
                          <span style={spinnerWhite} />
                          Finalizando...
                        </>
                      ) : (
                        "Confirmar e finalizar"
                      )}
                    </button>
                  </div>
                </div>
              </>
            </Portal>
          );
        })()}

      {/* Toolbar */}
      <div className="cards-toolbar" style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <input
          className="input"
          placeholder="Buscar por cliente, vendedor ou número..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ flex: 1, minWidth: "200px" }}
        />

        <div style={{ position: "relative" }}>
          <button
            className={"chip" + (somenteAguardando || !!vendedorFiltro ? " chip-active" : "")}
            onClick={() => setFiltrosOpen((v) => !v)}
            title="Filtros"
          >
            🎛️ Filtros
          </button>

          {filtrosOpen && (
            <>
              <div onClick={() => setFiltrosOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 9998, background: "transparent" }} />
              <div
                className="dropdown"
                style={{
                  position: "absolute",
                  left: 0,
                  zIndex: 9999,
                  minWidth: 280,
                  padding: 8,
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.12)",
                  boxShadow: "0 18px 60px rgba(0,0,0,0.20)",
                  background: "rgba(255,255,255,0.98)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button className="dropdown-item" onClick={() => setSomenteAguardando((s) => !s)}>
                  {somenteAguardando ? "✅ Só aguardando (AC)" : "☐ Só aguardando (AC)"}
                </button>

                <div style={{ height: 1, background: "rgba(0,0,0,0.08)", margin: "8px 0" }} />

                <div style={{ fontWeight: 900, padding: "6px 10px", opacity: 0.85 }}>Vendedor</div>

                <button className="dropdown-item" onClick={() => setVendedorFiltro(null)}>
                  {vendedorFiltro ? "☐ (Todos)" : "✅ (Todos)"}
                </button>

                {VENDEDORES.map((v) => (
                  <button key={v} className="dropdown-item" onClick={() => setVendedorFiltro(v)}>
                    {vendedorFiltro?.toLowerCase() === v.toLowerCase() ? "✅ " : ""}
                    {v}
                  </button>
                ))}

                <div style={{ height: 1, background: "rgba(0,0,0,0.08)", margin: "8px 0" }} />

                <button
                  className="dropdown-item"
                  onClick={() => {
                    setSomenteAguardando(false);
                    setVendedorFiltro(null);
                  }}
                >
                  🧹 Limpar filtros
                </button>

                <button className="dropdown-item" onClick={() => setFiltrosOpen(false)}>
                  ✖️ Fechar
                </button>
              </div>
            </>
          )}
        </div>

        <button className="chip" onClick={sincronizarConferentes} style={{ backgroundColor: "#2196F3", color: "white" }}>
          🔄 Sync cache
        </button>

        <button
          className={`chip ${somAlertaDesativado ? "chip-inactive" : "chip-active"}`}
          onClick={toggleSomAlerta}
          title={`${somAlertaDesativado ? "Ativar" : "Desativar"} som de alerta para pedidos com +5min`}
        >
          {somAlertaDesativado ? "🔇 Som desativado" : "🔊 Som ativado"}
        </button>

        <button className="chip" onClick={() => tocarSomAlerta()} style={{ marginLeft: "10px" }}>
          Testar Som
        </button>
      </div>

      {/* Tabela */}
      <div className="table-wrap">
        <table className="pedido-table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Vendedor</th>
              <th>Status</th>
              <th>Tempo</th>
              <th>Conferente</th>
              <th style={{ width: 130, textAlign: "right" }}>Ações</th>
            </tr>
          </thead>

          <tbody>
            {paginaPedidos.map((p) => {
              const isExpanded = expandedNunota === p.nunota;

              const statusCode = normalizeStatus((p as any).statusConferencia);
              const podeFinalizarAgora = podeFinalizar(statusCode);

              const visual = getVisualStatus(p);
              const colors = visual.colors;
              const statusLabel = visual.label;
              const isFinalizadaOk = visual.isFinalOk;

              const timer = timerByNunota[p.nunota] ?? { startAt: null, elapsedMs: 0, running: false };
              const now = Date.now();
              const liveElapsedMs = timer.running && timer.startAt ? timer.elapsedMs + (now - timer.startAt) : timer.elapsedMs;

              const elapsedMin = Math.floor(liveElapsedMs / 60000);
              const alerta5min = statusCode === "AC" && elapsedMin >= 5 && !isOptimisticFinal(p.nunota);

              const confExibicao = getConferenteExibicao(p);
              const nomeConferenteTexto =
                (p as any).conferenteNome ??
                (p as any).nomeConferente ??
                conferenteByNunota[p.nunota]?.nome ??
                confExibicao?.nome ??
                "(não definido)";

              const isLoadingThis = loadingConfirmacao === p.nunota;

              const checklist = pedidoChecklistOk(p);
              const bloqueioChecklist = !checklist.ok;

              const disabledFinalizar = !podeFinalizarAgora || isFinalizadaOk || isLoadingThis || bloqueioChecklist;

              return (
                <>
                  <tr
                    key={p.nunota}
                    className={`row ${isExpanded ? "row-expanded" : ""} ${alerta5min ? "row-pulse" : ""}`}
                    onClick={() => {
                      onSelect(p);
                      setExpandedNunota((cur) => (cur === p.nunota ? null : p.nunota));
                    }}
                    title={bloqueioChecklist ? "Checklist incompleto: marque todos e digite a quantidade em cada item." : undefined}
                  >
                    <td>
                      <div style={{ fontWeight: 900 }}>
                        #{p.nunota}
                        {p.numNota != null && p.numNota !== 0 && (
                          <span style={{ marginLeft: 8, opacity: 0.8, fontWeight: 700 }}>NF {p.numNota}</span>
                        )}
                      </div>
                      <div style={{ opacity: 0.75, fontSize: 12 }}>{p.itens.length} itens</div>
                    </td>

                    <td>{p.nomeParc ?? "-"}</td>
                    <td>{p.nomeVendedor ?? "-"}</td>

                    <td>
                      <span
                        className="status-pill"
                        style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                        title={statusLabel}
                      >
                        <span className="status-dot" style={{ backgroundColor: colors.text }} />
                        {statusLabel}
                        {visual.isOptimistic && <span className="tag-5min">atualizando…</span>}
                        {alerta5min && <span className="tag-5min">+5min</span>}
                      </span>
                    </td>

                    <td>
                      <span className="timer-cell-time" style={{ fontWeight: 900 }}>
                        {formatElapsed(liveElapsedMs)}
                      </span>
                    </td>

                    <td>{nomeConferenteTexto}</td>

                    <td style={{ textAlign: "right" }}>
                      <button
                        className={`btn-finalizar ${disabledFinalizar ? "btn-finalizar-inactive" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (disabledFinalizar) {
                            if (bloqueioChecklist)
                              alert("Checklist incompleto: marque TODOS os itens e digite a quantidade conferida em cada item.");
                            return;
                          }

                          setFinalizarNunotaOpen(p.nunota);
                          const presetId = confExibicao?.codUsuario ?? "";
                          setFinalizarConferenteId(presetId as any);
                        }}
                        title={
                          disabledFinalizar
                            ? bloqueioChecklist
                              ? "Bloqueado: checklist incompleto (checks + quantidade digitada)."
                              : "Finalizar disponível apenas em AC (Aguardando) ou A (Em andamento)"
                            : "Finalizar (selecionar conferente)"
                        }
                        disabled={disabledFinalizar}
                      >
                        Finalizar
                      </button>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="row-detail">
                      <td colSpan={7}>
                        <div className="detail-box">
                          <div className="detail-box-title" style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <div>Itens do pedido #{p.nunota}</div>

                            {(() => {
                              const map = checkedByNunota[p.nunota] ?? {};
                              const total = p.itens.length;
                              const done = p.itens.reduce((acc, it, idx) => acc + (map[itemKey(it, idx)] ? 1 : 0), 0);

                              const mapQtd = qtdByNunota[p.nunota] ?? {};
                              const okQty = p.itens.reduce((acc, it, idx) => {
                                const qtd = it.qtdConferida ?? it.qtdAtual ?? it.qtdOriginal ?? it.qtdEsperada ?? 0;
                                const k = itemKey(it, idx);
                                return acc + (isQtdMatch(Number(qtd) || 0, mapQtd[k] ?? "") ? 1 : 0);
                              }, 0);

                              return (
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                  <span style={{ fontWeight: 900, opacity: 0.85 }}>
                                    Conferidos: {done}/{total} · Qtd OK: {okQty}/{total}
                                  </span>
                                  <button
                                    className="chip"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      marcarTodos(p.nunota, p.itens, true);
                                    }}
                                    title="Marcar todos (preenche qtd automaticamente)"
                                  >
                                    ✅ Tudo
                                  </button>
                                  <button
                                    className="chip"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      marcarTodos(p.nunota, p.itens, false);
                                    }}
                                    title="Desmarcar todos (limpa qtd)"
                                  >
                                    ↩️ Limpar
                                  </button>
                                </div>
                              );
                            })()}
                          </div>

                          <div className="detail-items">
                            {p.itens.map((item, idx) => {
                              const qtdEsperada = item.qtdConferida ?? item.qtdAtual ?? item.qtdOriginal ?? item.qtdEsperada ?? 0;

                              const key = itemKey(item, idx);
                              const checked = !!checkedByNunota[p.nunota]?.[key];

                              const digitadaRaw = qtdByNunota[p.nunota]?.[key] ?? "";
                              const match = isQtdMatch(Number(qtdEsperada) || 0, digitadaRaw);

                              const showMismatch = checked && !match;

                              return (
                                <div
                                  key={`${item.codProd}-${idx}`}
                                  className={`detail-item ${checked ? "detail-item-checked" : ""} ${showMismatch ? "detail-item-mismatch" : ""}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="item-row">
                                    <div className="item-info">
                                      <div className="item-title">
                                        {item.codProd} · {item.descricao}
                                      </div>
                                      <div className="item-sub">Unidade: {item.unidade}</div>

                                      <div style={{ marginTop: 6, fontSize: 13 }}>
                                        Quantidade: <b>{qtdEsperada}</b>
                                      </div>

                                      {checked && digitadaRaw === "" && (
                                        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 900, color: "#b91c1c" }}>
                                          ⚠️ Digite a quantidade conferida
                                        </div>
                                      )}

                                      {checked && digitadaRaw !== "" && !match && (
                                        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 900, color: "#b91c1c" }}>
                                          ⚠️ Qtd digitada não confere
                                        </div>
                                      )}
                                    </div>

                                    <div className="qtd-box" onClick={(e) => e.stopPropagation()}>
                                      <div className="qtd-label">Qtd conf.</div>
                                      <input
                                        className={`qtd-input ${showMismatch ? "qtd-input-error" : ""}`}
                                        inputMode="numeric"
                                        type="number"
                                        min={0}
                                        step={1}
                                        value={digitadaRaw === "" ? "" : Number(digitadaRaw)}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          if (v === "") return setQtdConferida(p.nunota, key, "");
                                          const n = Number(v);
                                          if (!Number.isFinite(n)) return setQtdConferida(p.nunota, key, "");
                                          setQtdConferida(p.nunota, key, Math.max(0, Math.floor(n)));
                                        }}
                                        placeholder="digite"
                                        title="Digite a quantidade conferida"
                                      />
                                      <div className={`qtd-hint ${match ? "qtd-hint-ok" : "qtd-hint-bad"}`}>
                                        {digitadaRaw === "" ? "—" : match ? "OK" : `≠ ${Number(qtdEsperada) || 0}`}
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      className={`circle-check ${checked ? "circle-check-on" : ""}`}
                                      onClick={() => toggleItemChecked(p.nunota, key)}
                                      title={checked ? "Desmarcar" : "Marcar como conferido"}
                                      aria-pressed={checked}
                                    >
                                      {checked ? <span className="circle-check-v">V</span> : null}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div style={{ opacity: 0.75, marginTop: 10, fontSize: 12 }}>Checklist local (fica salvo neste PC)</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
        <div style={{ opacity: 0.8 }}>
          Mostrando {inicio + 1} - {Math.min(inicio + ITENS_POR_PAGINA, filtrados.length)} de {filtrados.length} pedidos
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="chip" disabled={pagina <= 1} onClick={() => setPagina((p) => Math.max(1, p - 1))}>
            ←
          </button>
          <div className="chip">
            {pagina}/{totalPaginas}
          </div>
          <button className="chip" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}>
            →
          </button>
        </div>
      </div>

      <style>{`
        .chip-inactive { background-color: #f0f0f0; color: #666; border: 1px solid #ddd; }
        .chip-inactive:hover { background-color: #e5e5e5; }
        .dropdown-item {
          width: 100%;
          text-align: left;
          padding: 10px 12px;
          border-radius: 10px;
          border: 0;
          background: transparent;
          cursor: pointer;
          font-weight: 700;
        }
        .dropdown-item:hover { background: rgba(0,0,0,0.06); }

        .table-wrap { overflow: auto; border-radius: 14px; border: 1px solid rgba(0,0,0,0.10); }
        .pedido-table { width: 100%; border-collapse: collapse; min-width: 980px; background: rgba(255,255,255,0.96); }

        .pedido-table th {
          text-align: left;
          font-size: 12px;
          letter-spacing: .02em;
          opacity: .8;
          padding: 8px 10px;
          background: rgba(0,0,0,0.03);
          border-bottom: 1px solid rgba(0,0,0,0.08);
          position: sticky;
          top: 0;
        }
        .pedido-table td {
          padding: 8px 10px;
          border-bottom: 1px solid rgba(0,0,0,0.06);
          vertical-align: top;
        }

        .row { cursor: pointer; }
        .row:hover { background: rgba(0,0,0,0.02); }

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 5px 9px;
          border-radius: 999px;
          border: 2px solid;
          font-weight: 900;
          font-size: 12.5px;
        }
        .status-dot { width: 9px; height: 9px; border-radius: 999px; display: inline-block; }
        .tag-5min { margin-left: 6px; font-size: 11px; opacity: .9; font-weight: 900; }

        .timer-cell-time { font-weight: 900; }

        .btn-finalizar {
          border: 0;
          border-radius: 10px;
          padding: 8px 10px;
          cursor: pointer;
          font-weight: 900;
          background: #16a34a;
          color: #fff;
          transition: transform .06s ease, filter .12s ease, background .12s ease;
        }
        .btn-finalizar:hover { filter: brightness(0.96); transform: translateY(-1px); }
        .btn-finalizar:active { transform: translateY(0px); }
        .btn-finalizar-inactive {
          opacity: 0.55;
          cursor: not-allowed;
          background: #9ca3af;
        }
        .btn-finalizar-inactive:hover { transform: none; filter: none; }

        .row-detail td { background: rgba(0,0,0,0.02); }
        .detail-box { padding: 12px; border-radius: 14px; border: 1px solid rgba(0,0,0,0.08); background: rgba(255,255,255,0.9); }
        .detail-box-title { font-weight: 900; margin-bottom: 10px; }
        .detail-items { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        @media (max-width: 1200px) { .detail-items { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 820px) { .detail-items { grid-template-columns: 1fr; } }

        .detail-item { border: 1px solid rgba(0,0,0,0.10); border-radius: 12px; padding: 12px; background: #fff; }
        .detail-item-checked {
          border-color: rgba(22, 163, 74, 0.55);
          background: rgba(22, 163, 74, 0.06);
        }
        .detail-item-mismatch{
          border-color: rgba(185, 28, 28, 0.55);
          background: rgba(185, 28, 28, 0.04);
        }

        .item-row{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
        }
        .item-info{ flex: 1; min-width: 0; }
        .item-title{ font-weight: 900; }
        .item-sub{ opacity: .8; font-size: 12px; }

        .qtd-box{
          flex: 0 0 auto;
          display:flex;
          flex-direction:column;
          align-items:flex-end;
          gap: 4px;
          min-width: 92px;
        }
        .qtd-label{
          font-size: 10.5px;
          font-weight: 1000;
          opacity: .75;
          letter-spacing: .02em;
        }
        .qtd-input{
          width: 92px;
          height: 38px;
          border-radius: 10px;
          border: 2px solid rgba(0,0,0,0.14);
          background: #fff;
          font-weight: 1000;
          text-align: center;
          outline: none;
        }
        .qtd-input:focus{
          border-color: rgba(59,130,246,0.7);
          box-shadow: 0 0 0 4px rgba(59,130,246,0.12);
        }
        .qtd-input-error{
          border-color: rgba(185, 28, 28, 0.75) !important;
          box-shadow: 0 0 0 4px rgba(185, 28, 28, 0.10);
        }
        .qtd-hint{
          font-size: 11px;
          font-weight: 1000;
          opacity: .9;
        }
        .qtd-hint-ok{ color: #16a34a; }
        .qtd-hint-bad{ color: #b91c1c; }

        .circle-check{
          flex: 0 0 auto;
          width: 52px;
          height: 52px;
          border-radius: 999px;
          border: 2px solid rgba(0,0,0,0.16);
          background: #fff;
          cursor: pointer;
          display:flex;
          align-items:center;
          justify-content:center;
          transition: transform .06s ease, filter .12s ease, background .12s ease, border-color .12s ease;
          user-select: none;
        }
        .circle-check:hover{ filter: brightness(0.98); transform: translateY(-1px); }
        .circle-check:active{ transform: translateY(0px); }
        .circle-check-on{
          border-color: #16a34a;
          background: #16a34a;
        }
        .circle-check-on:hover{ filter: brightness(0.96); }
        .circle-check-v{
          color: #fff;
          font-weight: 1000;
          font-size: 26px;
          line-height: 1;
          transform: translateY(-1px);
        }

        .row-pulse { animation: pulse 1.2s ease-in-out infinite; }
        @keyframes pulse {
          0% { box-shadow: inset 0 0 0 rgba(255,0,0,0); }
          50% { box-shadow: inset 0 0 0 999px rgba(255, 0, 0, 0.04); }
          100% { box-shadow: inset 0 0 0 rgba(255,0,0,0); }
        }

        .modal-overlay{
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.35);
          backdrop-filter: blur(3px);
          z-index: 99999;
        }
        .modal-card{
          position: fixed;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: min(520px, calc(100vw - 24px));
          background: rgba(255,255,255,0.98);
          border: 1px solid rgba(0,0,0,0.12);
          border-radius: 18px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.25);
          padding: 16px 16px 14px 16px;
          z-index: 100000;
        }
        .modal-icon{
          width: 54px;
          height: 54px;
          border-radius: 999px;
          display:flex;
          align-items:center;
          justify-content:center;
          background: rgba(22, 163, 74, 0.12);
          border: 1px solid rgba(22, 163, 74, 0.35);
          font-size: 26px;
          margin-bottom: 10px;
        }
        .modal-title{
          font-weight: 1000;
          font-size: 18px;
          margin-bottom: 6px;
        }
        .modal-sub{
          opacity: 0.9;
          margin-bottom: 10px;
        }
        .modal-meta{
          border-radius: 14px;
          border: 1px solid rgba(0,0,0,0.08);
          background: rgba(0,0,0,0.02);
          padding: 10px 12px;
        }
        .modal-badge{
          display:inline-block;
          font-size: 11px;
          font-weight: 900;
          opacity: .75;
          margin-right: 8px;
        }
        .modal-actions{
          display:flex;
          justify-content:flex-end;
          margin-top: 12px;
        }

        @keyframes spin{
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default PedidoTable;
