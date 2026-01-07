// src/components/PedidoTable.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { DetalhePedido } from "../types/conferencia";
import { statusColors, statusMap } from "../config/status";
import { dispararAlertasVoz } from "../../public/audio/audioManager";
import { api } from "../api/client";

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
const OPTIMISTIC_FINAL_TTL_MS = 45_000;

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

export function PedidoTable({
  pedidos,
  loadingInicial,
  erro,
  onSelect,
  onRefresh,
}: PedidoTableProps) {
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);

  const [somenteAguardando, setSomenteAguardando] = useState(false);
  const [vendedorFiltro, setVendedorFiltro] = useState<string | null>(null);

  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [somAlertaDesativado, setSomAlertaDesativado] = useState(false);

  const [conferentesBackend] = useState<Conferente[]>(CONFERENTES);

  const [timerByNunota, setTimerByNunota] = useState<TimerMap>(() => loadTimers());
  const [conferenteByNunota, setConferenteByNunota] = useState<ConferenteByNunota>(() =>
    loadConferenteByNunota()
  );
  const [nuconfByNunota, setNuconfByNunota] = useState<NuconfByNunota>(() => loadNuconfByNunota());

  const [optimisticFinalizedByNunota, setOptimisticFinalizedByNunota] =
    useState<OptimisticFinalizedByNunota>(() => loadOptimisticFinalized());

  const [expandedNunota, setExpandedNunota] = useState<number | null>(null);

  // popover de finalizar
  const [finalizarNunotaOpen, setFinalizarNunotaOpen] = useState<number | null>(null);
  const [finalizarConferenteId, setFinalizarConferenteId] = useState<number | "">("");

  const [loadingConfirmacao, setLoadingConfirmacao] = useState<number | null>(null);

  const ultimoAlertaSomRef = useRef<number>(0);
  const somIntervalRef = useRef<number | null>(null);
  const [ultimosStatus, setUltimosStatus] = useState<Record<number, string>>({});

  // ✅ checklist state
  const [checkedByNunota, setCheckedByNunota] = useState<CheckedItemsByNunota>(() => loadCheckedItems());

  // ✅ modal de sucesso
  const [successModal, setSuccessModal] = useState<{
    open: boolean;
    nunota: number | null;
    nuconf: number | null;
    conferenteNome: string | null;
  }>({ open: false, nunota: null, nuconf: null, conferenteNome: null });

  // ⏱ re-render 1x/segundo
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => forceTick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // 🧹 limpa optimistic vencido (1x/seg)
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
      if (e.key === "Escape") setFiltrosOpen(false);
      if (e.key === "Escape" && successModal.open) setSuccessModal({ open: false, nunota: null, nuconf: null, conferenteNome: null });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [successModal.open]);

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

  // Atualiza timers conforme status (considera optimistic como final ok)
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

        // ✅ se backend já veio final ok, tira optimistic (se existir)
        if (isFinalizadaOk && !visual.isOptimistic) removerOptimisticFinal(nunota);

        const current = next[nunota] ?? { startAt: null, elapsedMs: 0, running: false };

        // ✅ começa contar em AC
        if (statusCode === "AC" && !isFinalizadaOk) {
          if (!current.running) next[nunota] = { startAt: now, elapsedMs: current.elapsedMs, running: true };
          else next[nunota] = current;
          continue;
        }

        // ✅ para de contar em "Finalizada OK" (ou optimistic final)
        if (isFinalizadaOk) {
          if (current.running && current.startAt) {
            const elapsed = current.elapsedMs + (now - current.startAt);
            next[nunota] = { startAt: null, elapsedMs: elapsed, running: false };
          } else next[nunota] = { startAt: null, elapsedMs: current.elapsedMs, running: false };
          continue;
        }

        // ✅ qualquer outro status pausa o timer
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

  // Detecta mudança pra AC e toca som (entrada em AC)
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

  // Som periódico +5min (SEM modal fullscreen)
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
      const elapsedMs =
        timer.running && timer.startAt ? timer.elapsedMs + (now - timer.startAt) : timer.elapsedMs;

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
    if (vendedorFiltro)
      base = base.filter((p) => (p.nomeVendedor ?? "").toLowerCase() === vendedorFiltro.toLowerCase());
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

  // ✅ backend espera: { nunota, nome, codUsuario }
  async function definirConferenteNoBackend(nunota: number, conf: Conferente) {
    const res = await api.post(ROTA_DEFINIR_CONFERENTE, {
      nunota,
      nome: conf.nome,
      codUsuario: conf.codUsuario,
    });
    return res.data;
  }

  // ✅ backend espera: { nunotaOrig, codUsuario } e devolve { nuconf, nunotaOrig }
  async function iniciarEObterNuconf(nunotaOrig: number, codUsuario: number): Promise<number> {
    const res = await api.post(ROTA_INICIAR, { nunotaOrig, codUsuario });
    const nuconf = Number(res?.data?.nuconf ?? 0);
    if (!nuconf) throw new Error(`Não consegui ler nuconf do /iniciar para o pedido #${nunotaOrig}`);
    return nuconf;
  }

  // ✅ backend espera: { nuconf, codUsuario }
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

      // 1) define conferente por NUNOTA
      await definirConferenteNoBackend(p.nunota, conf);

      // 2) garante NUCONF
      const nuconf = await garantirNuconf(p, conf.codUsuario);

      // 3) finaliza
      await finalizarConferenciaViaBackend(nuconf, conf.codUsuario);

      // ✅ visual instantâneo + modal
      marcarOptimisticFinal(p.nunota);

      setSuccessModal({
        open: true,
        nunota: p.nunota,
        nuconf,
        conferenteNome: conf.nome,
      });

      setFinalizarNunotaOpen(null);
      setFinalizarConferenteId("");

      // chama refresh pra puxar backend; se demorar, optimistic segura a UI
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("❌ erro ao finalizar:", err);
      alert("Não consegui finalizar a conferência. Verifique o backend/logs.");
    } finally {
      setLoadingConfirmacao(null);
    }
  }

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

  function marcarTodos(nunota: number, itens: any[], value: boolean) {
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
  }

  if (loadingInicial && pedidos.length === 0) return <div className="center">Carregando…</div>;
  if (erro && pedidos.length === 0) return <div className="center">{erro}</div>;

  return (
    <div>
      {/* ✅ Modal sucesso */}
      {successModal.open && (
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
      )}

      {/* Toolbar */}
      <div
        className="cards-toolbar"
        style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}
      >
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
              <div
                onClick={() => setFiltrosOpen(false)}
                style={{ position: "fixed", inset: 0, zIndex: 9998, background: "transparent" }}
              />
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
              const liveElapsedMs =
                timer.running && timer.startAt ? timer.elapsedMs + (now - timer.startAt) : timer.elapsedMs;

              const elapsedMin = Math.floor(liveElapsedMs / 60000);
              const alerta5min = statusCode === "AC" && elapsedMin >= 5 && !isOptimisticFinal(p.nunota);

              const confExibicao = getConferenteExibicao(p);
              const nomeConferenteTexto =
                (p as any).conferenteNome ??
                (p as any).nomeConferente ??
                conferenteByNunota[p.nunota]?.nome ??
                confExibicao?.nome ??
                "(não definido)";

              const popoverOpenThis = finalizarNunotaOpen === p.nunota;
              const isLoadingThis = loadingConfirmacao === p.nunota;

              const disabledFinalizar = !podeFinalizarAgora || isFinalizadaOk || isLoadingThis;

              return (
                <>
                  <tr
                    key={p.nunota}
                    className={`row ${isExpanded ? "row-expanded" : ""} ${alerta5min ? "row-pulse" : ""}`}
                    onClick={() => {
                      onSelect(p);
                      setExpandedNunota((cur) => (cur === p.nunota ? null : p.nunota));
                    }}
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

                    <td style={{ textAlign: "right", position: "relative" }}>
                      <button
                        className={`btn-finalizar ${disabledFinalizar ? "btn-finalizar-inactive" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (disabledFinalizar) return;

                          setFinalizarNunotaOpen(p.nunota);
                          const presetId = confExibicao?.codUsuario ?? "";
                          setFinalizarConferenteId(presetId as any);
                        }}
                        title={
                          disabledFinalizar
                            ? "Finalizar disponível apenas em AC (Aguardando) ou A (Em andamento)"
                            : "Finalizar (selecionar conferente)"
                        }
                        disabled={disabledFinalizar}
                      >
                        Finalizar
                      </button>

                      {podeFinalizarAgora && !isFinalizadaOk && popoverOpenThis && (
                        <div className="finalizar-popover" onClick={(e) => e.stopPropagation()}>
                          <div style={{ fontWeight: 900, marginBottom: 8 }}>Selecionar conferente</div>

                          <select
                            className="select"
                            value={finalizarConferenteId}
                            onChange={(e) => {
                              const cod = Number(e.target.value || 0);
                              const found = conferentesBackend.find((c) => c.codUsuario === cod) || null;
                              setFinalizarConferenteId(found?.codUsuario ?? "");
                            }}
                            style={{ width: "100%", marginBottom: 10 }}
                            disabled={isLoadingThis}
                          >
                            <option value="">Escolha…</option>
                            {conferentesBackend.map((c) => (
                              <option key={c.codUsuario} value={c.codUsuario}>
                                {c.nome}
                              </option>
                            ))}
                          </select>

                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button
                              className="chip"
                              onClick={() => {
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
                                confirmarConferenteEFinalizar(p, found);
                              }}
                              disabled={isLoadingThis}
                              style={{ minWidth: 140 }}
                            >
                              {isLoadingThis ? "Processando..." : "Confirmar"}
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="row-detail">
                      <td colSpan={7}>
                        <div className="detail-box">
                          <div
                            className="detail-box-title"
                            style={{ display: "flex", justifyContent: "space-between", gap: 10 }}
                          >
                            <div>Itens do pedido #{p.nunota}</div>

                            {(() => {
                              const map = checkedByNunota[p.nunota] ?? {};
                              const total = p.itens.length;
                              const done = p.itens.reduce((acc, it, idx) => acc + (map[itemKey(it, idx)] ? 1 : 0), 0);
                              return (
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontWeight: 900, opacity: 0.85 }}>
                                    Conferidos: {done}/{total}
                                  </span>
                                  <button
                                    className="chip"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      marcarTodos(p.nunota, p.itens, true);
                                    }}
                                    title="Marcar todos"
                                  >
                                    ✅ Tudo
                                  </button>
                                  <button
                                    className="chip"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      marcarTodos(p.nunota, p.itens, false);
                                    }}
                                    title="Desmarcar todos"
                                  >
                                    ↩️ Limpar
                                  </button>
                                </div>
                              );
                            })()}
                          </div>

                          <div className="detail-items">
                            {p.itens.map((item, idx) => {
                              const qtd =
                                item.qtdConferida ??
                                item.qtdAtual ??
                                item.qtdOriginal ??
                                item.qtdEsperada ??
                                0;

                              const key = itemKey(item, idx);
                              const checked = !!checkedByNunota[p.nunota]?.[key];

                              return (
                                <div
                                  key={`${item.codProd}-${idx}`}
                                  className={`detail-item ${checked ? "detail-item-checked" : ""}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="item-row">
                                    <div className="item-info">
                                      <div className="item-title">
                                        {item.codProd} · {item.descricao}
                                      </div>
                                      <div className="item-sub">Unidade: {item.unidade}</div>

                                      <div style={{ marginTop: 6, fontSize: 13 }}>
                                        Quantidade: <b>{qtd}</b>
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

                          <div style={{ opacity: 0.75, marginTop: 10, fontSize: 12 }}>
                            Checklist local (fica salvo neste PC)
                          </div>
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
          <button
            className="chip"
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
          >
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

        .finalizar-popover {
          position: absolute;
          right: 0;
          top: 42px;
          width: 260px;
          background: rgba(255,255,255,0.98);
          border: 1px solid rgba(0,0,0,0.12);
          border-radius: 14px;
          box-shadow: 0 18px 60px rgba(0,0,0,0.20);
          padding: 10px;
          z-index: 50;
        }

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

        .item-row{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
        }
        .item-info{ flex: 1; min-width: 0; }
        .item-title{ font-weight: 900; }
        .item-sub{ opacity: .8; font-size: 12px; }

        /* ✅ checkbox circular grande */
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

        /* ✅ modal bonito */
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
      `}</style>
    </div>
  );
}

export default PedidoTable;
