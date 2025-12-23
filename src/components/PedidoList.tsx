// src/components/PedidoList.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { DetalhePedido } from "../types/conferencia";
import { statusColors, statusMap } from "../config/status";
import { dispararAlertasVoz } from "../../public/audio/audioManager";
import { api } from "../api/client"; // ✅ usa o axios com baseURL do Heroku

import Lottie from "lottie-react";

import caixaOkAnim from "../assets/lotties/caixaEmbaladaCheck.json";
import caixaAnim from "../assets/lotties/caixaAbrindoFechando.json";
import temporizadorAnim from "../assets/lotties/temporizador.json";
import atencaoAnim from "../assets/lotties/atencao.json";

interface PedidoListProps {
  pedidos: DetalhePedido[];
  loadingInicial: boolean;
  erro: string | null;
  selecionado: DetalhePedido | null;
  onSelect: (pedido: DetalhePedido) => void;
  onRefresh?: () => void; // ✅ para recarregar lista depois do /iniciar
}

const ITENS_POR_PAGINA = 50;

// 🧑‍💼 Lista fixa de vendedores para filtro
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

// ✅ conferentes (por enquanto fixo)
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

// =======================
// Helpers
// =======================
function normalizeStatus(status: any): string {
  return String(status ?? "").trim().toUpperCase();
}

function formatElapsed(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function pickQtdParaExpedicao(item: any): number {
  const original = item.qtdOriginal ?? item.qtdEsperada ?? item.qtdAtual ?? 0;
  return Number(original ?? 0);
}

function escapeHtml(s: any) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ✅ Função para tocar som de alerta
function tocarSomAlerta() {
  try {
    const audio = new Audio("/audio/efeitoSonoro.wav");
    audio.volume = 0.7;
    audio.play().catch((e) => console.log("Erro ao tocar som:", e));
    console.log("🔊 Som de alerta disparado");
  } catch (error) {
    console.error("Erro ao criar áudio:", error);
  }
}

// ✅ impressão simples: abre uma janela HTML e chama print
function imprimirExpedicao(p: DetalhePedido, conferente?: Conferente | null) {
  const itens = (p.itens ?? []).map((it: any, idx: number) => {
    const cod = it.codProd ?? it.codigo ?? "";
    const desc = it.descricao ?? it.descProd ?? "";
    const qtd = pickQtdParaExpedicao(it);
    return { idx: idx + 1, cod, desc, qtd };
  });

  const dt = new Date();
  const dtStr = dt.toLocaleString("pt-BR");

  const html = `
  <html>
    <head>
      <meta charset="utf-8"/>
      <title>Expedição - Pedido ${escapeHtml(p.nunota)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 18px; color: #111; max-width: 800px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
        .logo { height: 45px; margin-bottom: 10px; }
        .title { font-size: 24px; font-weight: 800; margin: 5px 0; color: #333; }
        .top { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin: 20px 0; }
        .h1 { font-size: 20px; font-weight: 800; margin: 0 0 4px 0; color: #333; }
        .sub { font-size: 12px; margin: 4px 0; color:#555; }
        .box { border:1px solid #ddd; border-radius:12px; padding:16px; margin-top: 10px; background: #fff; }
        table { width:100%; border-collapse:collapse; margin-top:12px; font-size: 12px; }
        th, td { border:1px solid #ddd; padding:8px; text-align: left; }
        th { background:#f5f5f5; font-weight: bold; color: #333; }
        .muted { color:#666; font-size:11px; margin-top: 10px; font-style: italic; }
        .sign { margin-top: 22px; display:flex; gap:18px; }
        .line { flex:1; border-top:1px solid #111; padding-top:6px; font-size:12px; text-align: center; }
        .right { text-align:right; }
        .total-info { font-weight: bold; margin: 15px 0; padding: 10px; background: #f9f9f9; border-radius: 8px; text-align: center; }
        .qtd-conferida { border: 1px solid #ccc; width: 70px; text-align: center; background: #fff; }
        @media print { body { padding: 10px; } .box { border: 1px solid #000; } }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="logo.png" class="logo" alt="Cemear Logo">
        <div class="title">DOCUMENTO DE CONFERÊNCIA</div>
      </div>

      <div class="box">
        <div class="top">
          <div>
            <p class="h1">Documento de Expedição</p>
            <p class="sub"><b>Pedido:</b> #${escapeHtml(p.nunota)} ${
    p.numNota ? `&nbsp;&nbsp; <b>NF:</b> ${escapeHtml(p.numNota)}` : ""
  }</p>
            <p class="sub"><b>Cliente:</b> ${escapeHtml(p.nomeParc ?? "-")}</p>
            <p class="sub"><b>Vendedor:</b> ${escapeHtml(p.nomeVendedor ?? "-")}</p>
          </div>
          <div class="right">
            <p class="sub"><b>Emitido em:</b> ${escapeHtml(dtStr)}</p>
            <p class="sub"><b>Responsável pela emissão:</b> ${escapeHtml(conferente?.nome ?? "-")}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:40px;">#</th>
              <th style="width:90px;">Cód.</th>
              <th>Descrição</th>
              <th style="width:110px;">Quantidade</th>
              <th style="width:130px;">Quantidade Conferida</th>
            </tr>
          </thead>
          <tbody>
            ${itens
              .map(
                (r) => `
              <tr>
                <td>${r.idx}</td>
                <td>${escapeHtml(r.cod)}</td>
                <td>${escapeHtml(r.desc)}</td>
                <td>${escapeHtml(r.qtd)}</td>
                <td><div class="qtd-conferida">&nbsp;</div></td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>

        <div class="total-info">
          TOTAL DE ITENS: ${itens.length} | TOTAL DE UNIDADES: ${itens.reduce((sum, item) => sum + item.qtd, 0)}
        </div>

        <p class="muted">Obs: conferir quantidades e integridade dos itens antes da expedição.</p>

        <div class="sign">
          <div class="line"><b>Assinatura do conferente</b>: ${escapeHtml(conferente?.nome ?? "")}</div>
          <div class="line"><b>Carimbo</b></div>
        </div>

        <div style="margin-top: 20px; font-size: 10px; color: #999; text-align: center;">
          Cemear Distribuidora Ltda. | Documento emitido eletronicamente
        </div>
      </div>

      <script>
        window.onload = () => {
          window.focus();
          setTimeout(() => { window.print(); }, 500);
        };
      </script>
    </body>
  </html>
`;

  const w = window.open("", `pedido${p.nunota}`, "width=900,height=800");
  if (!w) {
    alert("Pop-up bloqueado. Libere o pop-up para imprimir.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

type TimerState = {
  startAt: number | null;
  elapsedMs: number;
  running: boolean;
};
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
  } catch {
    // ignore
  }
}

function loadAckMap(): Record<number, boolean> {
  try {
    return JSON.parse(localStorage.getItem("attentionAckByNunota") || "{}");
  } catch {
    return {};
  }
}

function saveAckMap(next: Record<number, boolean>) {
  try {
    localStorage.setItem("attentionAckByNunota", JSON.stringify(next));
  } catch {
    // ignore
  }
}

// ✅ salva conferente por pedido (local), só pra imprimir / lembrar ultimo
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
  } catch {
    // ignore
  }
}

// =======================
// Main
// =======================
export function PedidoList({
  pedidos,
  loadingInicial,
  erro,
  selecionado,
  onSelect,
  onRefresh,
}: PedidoListProps) {
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

  const [printNunotaOpen, setPrintNunotaOpen] = useState<number | null>(null);
  const [printConferenteId, setPrintConferenteId] = useState<number | "">("");

  const [pedidoEmAtencao, setPedidoEmAtencao] = useState<DetalhePedido | null>(null);
  const [loadingConfirmacao, setLoadingConfirmacao] = useState<number | null>(null);

  const ultimoAlertaSomRef = useRef<number>(0);
  const somIntervalRef = useRef<number | null>(null);

  const [ultimosStatus, setUltimosStatus] = useState<Record<number, string>>({});

  // ⏱ força re-render 1x/segundo
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => forceTick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // fecha dropdown filtros no ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFiltrosOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // (opcional) carregar conferentes do backend (se vc criar endpoint)
  useEffect(() => {
    async function carregarConferentes() {
      try {
        // const res = await api.get("/api/conferentes");
        // setConferentesBackend(res.data);
      } catch (error) {
        console.error("Erro ao carregar conferentes:", error);
      }
    }
    carregarConferentes();
  }, []);

  // Atualiza timers conforme status
  useEffect(() => {
    if (!pedidos?.length) return;

    setTimerByNunota((prev) => {
      const next: TimerMap = { ...prev };
      const now = Date.now();

      for (const p of pedidos) {
        const nunota = p.nunota;
        const statusCode = normalizeStatus((p as any).statusConferencia);
        const statusBase = statusMap[(p as any).statusConferencia] || "-";
        const isFinalizadaOk = statusBase === "Finalizada OK";

        const current = next[nunota] ?? { startAt: null, elapsedMs: 0, running: false };

        if (statusCode === "AC") {
          if (!current.running) {
            next[nunota] = { startAt: now, elapsedMs: current.elapsedMs, running: true };
          } else {
            next[nunota] = current;
          }
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
  }, [pedidos]);

  // Detecta mudança pra AC e toca som
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

  // Som periódico +5min
  useEffect(() => {
    if (!pedidos?.length || somAlertaDesativado) {
      if (somIntervalRef.current) {
        window.clearInterval(somIntervalRef.current);
        somIntervalRef.current = null;
      }
      return;
    }

    const pedidosComMaisDe5Min = pedidos.filter((p) => {
      const statusCode = normalizeStatus((p as any).statusConferencia);
      if (statusCode !== "AC") return false;

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
  }, [pedidos, timerByNunota, somAlertaDesativado]);

  // Modal atenção (AC >= 5 min e sem ACK)
  useEffect(() => {
    if (!pedidos?.length) {
      setPedidoEmAtencao(null);
      return;
    }

    const now = Date.now();
    const ack = loadAckMap();

    const candidatos = pedidos
      .filter((p) => normalizeStatus((p as any).statusConferencia) === "AC")
      .filter((p) => !ack[p.nunota])
      .map((p) => {
        const t = timerByNunota[p.nunota];
        if (!t) return { p, ms: 0 };
        const ms = t.running && t.startAt ? t.elapsedMs + (now - t.startAt) : t.elapsedMs;
        return { p, ms };
      })
      .filter((x) => x.ms >= 5 * 60 * 1000)
      .sort((a, b) => b.ms - a.ms);

    setPedidoEmAtencao(candidatos[0]?.p ?? null);
  }, [pedidos, timerByNunota]);

  // Auto-select 35s
  const lastAutoRef = useRef<number>(0);
  const filtradosRef = useRef<DetalhePedido[]>([]);
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      if (now - lastAutoRef.current < 35_000) return;

      let alvo: DetalhePedido | null = null;

      if (pedidoEmAtencao) {
        alvo = pedidoEmAtencao;
      } else {
        alvo = (filtradosRef.current?.[0] as DetalhePedido | undefined) ?? null;
      }

      if (alvo && selecionado?.nunota !== alvo.nunota) {
        onSelect(alvo);
      }

      lastAutoRef.current = now;
    }, 1000);

    return () => window.clearInterval(id);
  }, [pedidoEmAtencao, selecionado?.nunota, onSelect]);

  const handleAckModal = (nunota: number) => {
    if (somIntervalRef.current) {
      window.clearInterval(somIntervalRef.current);
      somIntervalRef.current = null;
    }
    const ack = loadAckMap();
    ack[nunota] = true;
    saveAckMap(ack);
    setPedidoEmAtencao(null);
  };

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
      if (onRefresh) onRefresh();
      alert("Conferentes sincronizados. Os dados serão atualizados.");
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error("Erro ao sincronizar conferentes:", error);
      alert("Erro ao sincronizar conferentes.");
    }
  };

  // ✅ CHAMA /api/conferencia/iniciar PELO AXIOS (HEROKU)
  async function iniciarConferenciaViaBackend(nunota: number, codUsuario: number) {
    // ✅ rota correta
    // ✅ body correto: nunotaOrig
    const res = await api.post("/api/conferencia/iniciar", {
      nunotaOrig: nunota,
      codUsuario,
    });
    return res.data;
  }

  useEffect(() => {
    setPagina(1);
  }, [busca, somenteAguardando, vendedorFiltro]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    let base = pedidos;

    if (somenteAguardando) {
      base = base.filter((p) => normalizeStatus((p as any).statusConferencia) === "AC");
    }

    if (vendedorFiltro) {
      base = base.filter(
        (p) => (p.nomeVendedor ?? "").toLowerCase() === vendedorFiltro.toLowerCase()
      );
    }

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

  useEffect(() => {
    filtradosRef.current = filtrados;
  }, [filtrados]);

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
      (nomeBackend && nomeBackend !== "null" && nomeBackend !== "-" && nomeBackend !== ""
        ? nomeBackend
        : null) ??
      (nomeConferenteOld && nomeConferenteOld !== "null" && nomeConferenteOld !== "-" && nomeConferenteOld !== ""
        ? nomeConferenteOld
        : null);

    if (nomeApenas) {
      const encontrado = conferentesBackend.find(
        (c) => c.nome.toLowerCase() === nomeApenas.toLowerCase()
      );
      if (encontrado) return encontrado;

      const local = conferenteByNunota[p.nunota];
      if (local && local.nome.toLowerCase() === nomeApenas.toLowerCase()) return local;

      return { codUsuario: 0, nome: nomeApenas };
    }

    return conferenteByNunota[p.nunota] ?? null;
  }

  // ✅ Confirmar: chama /iniciar e depois imprime (sem setar conferente no mongo)
  async function confirmarConferenteEImprimir(p: DetalhePedido, conf: Conferente) {
    setLoadingConfirmacao(p.nunota);

    try {
      // guarda localmente só pra lembrar quem imprimiu
      setConferenteByNunota((prev) => {
        const next = { ...prev, [p.nunota]: conf };
        saveConferenteByNunota(next);
        return next;
      });

      // ✅ chamar backend /iniciar (somente isso)
      try {
        await iniciarConferenciaViaBackend(p.nunota, conf.codUsuario);
        if (onRefresh) onRefresh();
      } catch (err) {
        console.error("❌ erro ao chamar /iniciar:", err);
        alert("Imprimiu, mas não consegui iniciar a conferência no backend.");
      }

      // imprime
      imprimirExpedicao(p, conf);

      setPrintNunotaOpen(null);
      setPrintConferenteId("");
    } catch (e: any) {
      console.error("❌ erro ao imprimir:", e);
      alert("Erro ao imprimir.");
    } finally {
      setLoadingConfirmacao(null);
    }
  }

  if (loadingInicial && pedidos.length === 0) {
    return <div className="center">Carregando…</div>;
  }

  if (erro && pedidos.length === 0) {
    return <div className="center">{erro}</div>;
  }

  const attentionInfo = pedidoEmAtencao
    ? (() => {
        const now = Date.now();
        const t = timerByNunota[pedidoEmAtencao.nunota];
        if (!t) return { ms: 0, mmss: "00:00" };
        const ms = t.running && t.startAt ? t.elapsedMs + (now - t.startAt) : t.elapsedMs;
        return { ms, mmss: formatElapsed(ms) };
      })()
    : null;

  return (
    <div>
      <div
        className="cards-toolbar"
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <input
          className="input"
          placeholder="Buscar por cliente, vendedor ou número..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ flex: 1, minWidth: "200px" }}
        />

        {/* ✅ UM ÚNICO BOTÃO DE FILTROS */}
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
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 9998,
                  background: "transparent",
                }}
              />

              <div
                className="dropdown"
                style={{
                  position: "absolute",
                  left: 0,
                  top: "110%",
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

        <button
          className="chip"
          onClick={sincronizarConferentes}
          title="Sincronizar conferentes"
          style={{ backgroundColor: "#2196F3", color: "white" }}
        >
          🔄 Sinc. Conferentes
        </button>

        <button
          className={`chip ${somAlertaDesativado ? "chip-inactive" : "chip-active"}`}
          onClick={toggleSomAlerta}
          title={`${somAlertaDesativado ? "Ativar" : "Desativar"} som de alerta para pedidos com +5min`}
        >
          {somAlertaDesativado ? "🔇 Som desativado" : "🔊 Som ativado"}
        </button>

        <button
          className="chip"
          onClick={() => tocarSomAlerta()}
          style={{ marginLeft: "10px" }}
        >
          Testar Som
        </button>
      </div>

      <div className="cards-grid">
        {paginaPedidos.map((p) => {
          const isSelected = selecionado?.nunota === p.nunota;

          const statusCode = normalizeStatus((p as any).statusConferencia);
          const aguardando = statusCode === "AC";

          const colors = statusColors[(p as any).statusConferencia] || statusColors.AL;

          const statusBase = statusMap[(p as any).statusConferencia] || "-";
          const isFinalizadaOk = statusBase === "Finalizada OK";

          const timer = timerByNunota[p.nunota] ?? { startAt: null, elapsedMs: 0, running: false };

          const now = Date.now();
          const liveElapsedMs =
            timer.running && timer.startAt ? timer.elapsedMs + (now - timer.startAt) : timer.elapsedMs;

          const elapsedMin = Math.floor(liveElapsedMs / 60000);

          // ✅ PULSO A PARTIR DE 5+ min
          const alerta5min = aguardando && elapsedMin >= 5;

          const confExibicao = getConferenteExibicao(p);

          const nomeConferenteTexto =
            (p as any).conferenteNome ??
            (p as any).nomeConferente ??
            conferenteByNunota[p.nunota]?.nome ??
            confExibicao?.nome ??
            "(não definido)";

          const printOpenThis = printNunotaOpen === p.nunota;
          const isLoadingThis = loadingConfirmacao === p.nunota;

          return (
            <div
              key={p.nunota}
              className={"card" + (isSelected ? " card-selected" : "") + (alerta5min ? " card-pulse" : "")}
              onClick={() => onSelect(p)}
            >
              <div className="card-header compact">
                <div className="header-left compact">
                  {isFinalizadaOk ? (
                    <div className="box-lottie box-lottie-ok">
                      <Lottie animationData={caixaOkAnim} loop={false} autoplay />
                    </div>
                  ) : (
                    <div className="box-lottie box-lottie-default">
                      <Lottie animationData={caixaAnim} loop autoplay />
                    </div>
                  )}

                  <div className="card-body-2col">
                    <div className="card-left">
                      <div className="line-top">
                        <span className="pedido-label compact">Pedido</span>
                        <span className="num-value compact">#{p.nunota}</span>

                        {p.numNota != null && p.numNota !== 0 && (
                          <span className="nf-inline">• NF {p.numNota}</span>
                        )}
                      </div>

                      {p.nomeParc && <div className="line">🏢 {p.nomeParc}</div>}
                      {p.nomeVendedor && <div className="line">👤 {p.nomeVendedor}</div>}
                      <div className="line">📦 {p.itens.length} itens</div>

                      <div className="line" style={{ opacity: 0.9 }}>
                        🧑‍💼 Conferente: {nomeConferenteTexto}
                      </div>
                    </div>

                    <div className="card-right" style={{ position: "relative" }}>
                      <div
                        className="status-pill"
                        style={{
                          backgroundColor: colors.bg,
                          borderColor: colors.border,
                          padding: "8px 10px",
                          borderWidth: 2,
                        }}
                        title={statusBase}
                      >
                        <div
                          className="status-dot"
                          style={{ backgroundColor: colors.text, width: 10, height: 10 }}
                        />
                        <span
                          className="status-text"
                          style={{
                            color: colors.text,
                            fontSize: 13.5,
                            fontWeight: 900,
                            lineHeight: "16px",
                          }}
                        >
                          {statusBase}
                        </span>
                      </div>

                      <div className={"timer-box" + (alerta5min ? " timer-box-hot" : "")}>
                        <div className="timer-top">
                          <div className="timer-lottie">
                            <Lottie animationData={temporizadorAnim} loop={timer.running} autoplay />
                          </div>
                          <div className="timer-time">{formatElapsed(liveElapsedMs)}</div>
                        </div>

                        <div className="timer-sub">
                          {aguardando
                            ? "tempo acumulado até iniciar conferência"
                            : isFinalizadaOk
                            ? "tempo total"
                            : "tempo acumulado"}
                        </div>

                        {alerta5min && (
                          <div className="attention-inline">
                            <div className="attention-lottie">
                              <Lottie animationData={atencaoAnim} loop autoplay />
                            </div>
                            <span>+5 min</span>
                          </div>
                        )}
                      </div>

                      <button
                        className={`btn-start ${!aguardando ? "btn-start-inactive" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();

                          if (!aguardando) {
                            imprimirExpedicao(p, confExibicao);
                            return;
                          }

                          setPrintNunotaOpen(p.nunota);
                          const presetId = confExibicao?.codUsuario ?? "";
                          setPrintConferenteId(presetId as any);
                        }}
                        title={aguardando ? "Imprimir (com responsável)" : "Imprimir documento"}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        disabled={isLoadingThis}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center" }}>🖨️</span>
                      </button>

                      {aguardando && printOpenThis && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: "absolute",
                            right: 0,
                            bottom: 52,
                            width: 240,
                            background: "rgba(255,255,255,0.98)",
                            border: "1px solid rgba(0,0,0,0.12)",
                            borderRadius: 14,
                            boxShadow: "0 18px 60px rgba(0,0,0,0.20)",
                            padding: 10,
                            zIndex: 50,
                          }}
                        >
                          <div style={{ fontWeight: 900, marginBottom: 8 }}>Selecionar conferente</div>

                          <select
                            className="select"
                            value={printConferenteId}
                            onChange={(e) => {
                              const cod = Number(e.target.value || 0);
                              const found = conferentesBackend.find((c) => c.codUsuario === cod) || null;
                              setPrintConferenteId(found?.codUsuario ?? "");
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
                                setPrintNunotaOpen(null);
                                setPrintConferenteId("");
                              }}
                              disabled={isLoadingThis}
                            >
                              Cancelar
                            </button>

                            <button
                              className="chip chip-active"
                              onClick={() => {
                                const cod = Number(printConferenteId || 0);
                                const found = conferentesBackend.find((c) => c.codUsuario === cod) || null;

                                if (!found) {
                                  alert("Selecione o conferente.");
                                  return;
                                }

                                confirmarConferenteEImprimir(p, found);
                              }}
                              disabled={isLoadingThis}
                              style={{ position: "relative", minWidth: "120px" }}
                            >
                              {isLoadingThis ? (
                                <>
                                  <span
                                    style={{
                                      display: "inline-block",
                                      width: "16px",
                                      height: "16px",
                                      border: "2px solid rgba(255,255,255,0.3)",
                                      borderTop: "2px solid white",
                                      borderRadius: "50%",
                                      animation: "spin 1s linear infinite",
                                      marginRight: "8px",
                                    }}
                                  />
                                  Processando...
                                </>
                              ) : (
                                "Confirmar e imprimir"
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {pedidoEmAtencao && (
        <div className="attention-overlay" style={{ position: "fixed", inset: 0, zIndex: 999999 }}>
          <div className="attention-overlay-content" onClick={(e) => e.stopPropagation()}>
            <div className="attention-overlay-lottie">
              <Lottie animationData={atencaoAnim} loop autoplay />
            </div>

            <div className="attention-overlay-title">Atenção</div>
            <div className="attention-overlay-sub">
              Pedido #{pedidoEmAtencao.nunota} aguardando conferência há mais de 5 minutos.
            </div>

            <div className="attention-overlay-sub" style={{ fontWeight: 900 }}>
              Tempo: {attentionInfo?.mmss ?? "00:00"}
            </div>

            <button className="attention-overlay-ok" onClick={() => handleAckModal(pedidoEmAtencao.nunota)}>
              OK
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
        <div style={{ opacity: 0.8 }}>
          Mostrando {inicio + 1} - {Math.min(inicio + ITENS_POR_PAGINA, filtrados.length)} de{" "}
          {filtrados.length} pedidos
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
        .btn-start-inactive { opacity: 0.7; background-color: #e9ecef; color: #6c757d; border: 1px solid #dee2e6; }
        .btn-start-inactive:hover { background-color: #dee2e6; }

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

        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default PedidoList;
