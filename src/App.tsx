import { useEffect, useRef, useState } from "react";
import "./App.css";
import type { DetalhePedido } from "./types/conferencia";
import { buscarPedidosPendentes } from "./api/conferencia";

/* -----------------------------------------------------
   MAPA DE STATUS
----------------------------------------------------- */
const statusMap: Record<string, string> = {
  A: "Em andamento",
  AC: "Aguardando conferência",
  AL: "Aguardando liberação p/ conferência",
  C: "Aguardando liberação de corte",
  D: "Finalizada divergente",
  F: "Finalizada OK",
  R: "Aguardando recontagem",
  RA: "Recontagem em andamento",
  RD: "Recontagem finalizada divergente",
  RF: "Recontagem finalizada OK",
  Z: "Aguardando finalização",
};

/* -----------------------------------------------------
   CORES
----------------------------------------------------- */
const statusColors: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  A: { bg: "#E5F0FF", border: "#BFDBFE", text: "#1D4ED8" },
  AC: { bg: "#FEF3C7", border: "#FDE68A", text: "#92400E" },
  AL: { bg: "#F3F4F6", border: "#E5E7EB", text: "#4B5563" },
  C: { bg: "#FFF4E5", border: "#FFCC80", text: "#E65100" },
  D: { bg: "#FEE2E2", border: "#FCA5A5", text: "#B91C1C" },
  F: { bg: "#E8FDEB", border: "#66CC66", text: "#166534" },
  R: { bg: "#FFEDD5", border: "#FED7AA", text: "#9A3412" },
  RA: { bg: "#E5F0FF", border: "#BFDBFE", text: "#1D4ED8" },
  RD: { bg: "#FEE2E2", border: "#FCA5A5", text: "#B91C1C" },
  RF: { bg: "#E8FDEB", border: "#66CC66", text: "#166534" },
  Z: { bg: "#F3F4F6", border: "#E5E7EB", text: "#4B5563" },
};

/* -----------------------------------------------------
   ÁUDIO POR VENDEDOR (nome COMPLETO normalizado)
----------------------------------------------------- */
const audioVendedores: Record<string, string> = {
  "GUILHERME RODRIGUES": "/audio/guilherme.mp3",
  "LUIS TIZONI": "/audio/luis.mp3",
  "ALINE GOMES": "/audio/felipe.mp3",

  "MARCIA MELLER": "/audio/marcia.mp3",
  "JONATHAS RODRIGUES": "/audio/jonathas.mp3",
  "PAULO FAGUNDES": "/audio/fagundes.mp3",
  "RAFAEL AZEVEDO": "/audio/rafael.mp3",
  GB: "/audio/felipe.mp3",

  "GILIARD CAMPOS": "/audio/giliard.mp3",
  "SABINO BRESOLIN": "/audio/6+Sabino.mp3",
  "GUILHERME FRANCA": "/audio/guilherme.mp3",
  "LEONARDO MACHADO": "/audio/leonardo.mp3",
  "EDUARDO SANTOS": "/audio/eduardo.mp3",
  "RICARDO MULLER": "/audio/ricardo.mp3",

  "BRUNA SIQUEIRA": "/audio/felipe.mp3",
  "REBECA MOURA": "/audio/felipe.mp3",

  "GABRIEL AIRES": "/audio/gabriel.mp3",
  "GELSON MACHADO": "/audio/felipe.mp3",

  "GASPAR TARTARI": "/audio/gaspar.mp3",

  "FERNANDO SERAFIM": "/audio/fernando.mp3",

  TREVISANI: "/audio/felipe.mp3",

  "DAIANE CAMPOS": "/audio/daiane.mp3",
  "JULIA TARTARI": "/audio/felipe.mp3",

  "FELIPE TARTARI": "/audio/felipe.mp3",
  "BETO TARTARI": "/audio/beto.mp3",

  "DANIEL MACCARI": "/audio/felipe.mp3",
};

function normalizarNome(nome?: string | null): string {
  if (!nome) return "";
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function tocarAlertaCorte(
  nomeVendedor: string | null | undefined,
  nunota: number
) {
  const nomeNorm = normalizarNome(nomeVendedor);

  // fallback usando um MP3 que EXISTE (felipe.mp3).
  const src =
    (nomeNorm && audioVendedores[nomeNorm]) || "/audio/felipe.mp3";

  console.log("[AUDIO_CORTE] Pedido", nunota, {
    nomeVendedor,
    nomeNormalizado: nomeNorm,
    arquivo: src,
  });

  try {
    const audio = new Audio(src);
    audio
      .play()
      .catch((err) =>
        console.error("Falha ao tocar áudio de corte:", err, { src })
      );
  } catch (e) {
    console.error("Erro ao inicializar áudio:", e);
  }
}

/**
 * Verifica se o pedido tem pelo menos 1 item com corte
 * usando qtdOriginal (quando existir) como base.
 *
 * Corte = qtdOriginal > qtdAtual (nota já cortada).
 */
function temCorteNoPedido(pedido: DetalhePedido): boolean {
  return pedido.itens.some((i) => {
    const original = i.qtdOriginal ?? i.qtdEsperada ?? i.qtdAtual ?? 0;
    const atualNaNota = i.qtdAtual ?? original;
    return atualNaNota < original;
  });
}

/* -----------------------------------------------------
   APP
----------------------------------------------------- */
function App() {
  const [pedidos, setPedidos] = useState<DetalhePedido[]>([]);
  const [loadingInicial, setLoadingInicial] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<DetalhePedido | null>(null);
  const [somHabilitado, setSomHabilitado] = useState<boolean>(false);

  // guarda se o pedido tinha corte na última leitura
  const ultimoCorteRef = useRef<Record<number, boolean>>({});

  const dispararAlertasVoz = (lista: DetalhePedido[]) => {
    const ultimoCorte = ultimoCorteRef.current;

    lista.forEach((p) => {
      const temCorteAgora = temCorteNoPedido(p);
      const tinhaCorteAntes = ultimoCorte[p.nunota] ?? false;

      // dispara SOMENTE quando o pedido passa a ter corte
      if (temCorteAgora && !tinhaCorteAntes) {
        tocarAlertaCorte(p.nomeVendedor, p.nunota);
      }

      // atualiza snapshot
      ultimoCorte[p.nunota] = temCorteAgora;
    });

    // limpa notas que saíram da lista
    const nunotasAtuais = new Set(lista.map((p) => p.nunota));
    Object.keys(ultimoCorte).forEach((k) => {
      if (!nunotasAtuais.has(Number(k))) {
        delete ultimoCorte[Number(k)];
      }
    });
  };

  /* ---------------- HABILITAR / TESTAR ÁUDIO ---------------- */

  const handleHabilitarAudio = () => {
    try {
      // usa um arquivo que com certeza existe
      const audio = new Audio("/audio/felipe.mp3");
      audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          setSomHabilitado(true);
          console.log("[AUDIO] Habilitado com sucesso");
        })
        .catch((err) => {
          console.error("Erro ao habilitar áudio:", err);
          alert(
            "Não foi possível reproduzir o som de teste. Verifique se o navegador permitiu áudio para este site."
          );
        });
    } catch (e) {
      console.error("Erro ao criar áudio de teste:", e);
    }
  };

  /* --------------------- LOAD + POLLING -------------------- */
  useEffect(() => {
    let ativo = true;

    const carregar = async () => {
      try {
        const lista = await buscarPedidosPendentes();
        if (!ativo) return;

        setErro(null);
        setLoadingInicial(false);

        dispararAlertasVoz(lista);
        setPedidos(lista);

        if (!selecionado && lista.length > 0) {
          setSelecionado(lista[0]);
        } else if (
          selecionado &&
          !lista.some((p) => p.nunota === selecionado.nunota)
        ) {
          setSelecionado(lista[0] ?? null);
        }
      } catch (e) {
        console.error("Falha ao buscar pedidos:", e);
        if (ativo) {
          setLoadingInicial(false);
          setErro("Erro ao carregar pedidos.");
        }
      }
    };

    carregar();
    const interval = setInterval(carregar, 5000);

    return () => {
      ativo = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------------
      LISTA ESQUERDA
  --------------------------------------------------------- */
  const renderLista = () => {
    if (loadingInicial && pedidos.length === 0) {
      return (
        <div className="center">
          <div className="spinner" />
          <p className="loading-text">Carregando...</p>
        </div>
      );
    }

    if (erro && pedidos.length === 0) {
      return (
        <div className="center">
          <p className="error-text">{erro}</p>
        </div>
      );
    }

    if (pedidos.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-emoji">📦</div>
          <div className="empty-text">Nenhum pedido pendente</div>
          <div className="empty-subtext">Tudo limpo por aqui ✨</div>
        </div>
      );
    }

    return (
      <div className="cards-grid">
        {pedidos.map((p) => {
          const isSelected = selecionado?.nunota === p.nunota;
          const emConferencia =
            p.statusConferencia === "A" && !!p.nomeConferente;

          const colors = statusColors[p.statusConferencia] || statusColors.AL;
          const statusDesc = statusMap[p.statusConferencia] || "-";

          return (
            <div
              key={p.nunota}
              className={
                "card" +
                (emConferencia ? " card-em-conferencia" : "") +
                (isSelected ? " card-selected" : "")
              }
              onClick={() => setSelecionado(p)}
            >
              <div className="card-header">
                <div className="header-left">
                  <span className="box-icon">📦</span>
                  <div>
                    <div className="pedido-label">Pedido</div>
                    <div className="pedido-number">
                      #{p.nunota}
                      {p.numNota != null && p.numNota !== 0 && (
                        <span className="pedido-number-sec">
                          {" "}
                          · Nro. Nota {p.numNota}
                        </span>
                      )}
                    </div>

                    {p.nomeParc && (
                      <div className="pedido-vendedor">
                        Cliente: {p.nomeParc}
                      </div>
                    )}

                    {p.nomeVendedor && (
                      <div className="pedido-vendedor">
                        Vendedor: {p.nomeVendedor}
                      </div>
                    )}
                  </div>
                </div>

                {emConferencia && p.avatarUrlConferente && (
                  <img
                    className="avatar"
                    src={p.avatarUrlConferente}
                    alt={p.nomeConferente ?? "Conferente"}
                  />
                )}
              </div>

              <div
                className="status-pill"
                style={{
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                }}
              >
                <div
                  className="status-dot"
                  style={{ backgroundColor: colors.text }}
                />
                <span className="status-text" style={{ color: colors.text }}>
                  {statusDesc}
                </span>
              </div>

              <div className="info-row">
                <div className="info-item">
                  <div className="info-label">Itens</div>
                  <div className="info-value">{p.itens.length}</div>
                </div>

                {emConferencia && (
                  <div className="info-item">
                    <div className="info-label">Conferente</div>
                    <div className="info-value-small">
                      {p.nomeConferente}
                    </div>
                  </div>
                )}
              </div>

              {emConferencia && (
                <div className="conferente-box">
                  <span>
                    {p.nomeConferente} está conferindo este pedido
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  /* ---------------------------------------------------------
      DETALHE DIREITO
  --------------------------------------------------------- */
  return (
    <div className="app-root">
      <header className="topbar">
        <div className="topbar-left">
          <span className="topbar-logo">📦</span>
          <div>
            <div className="topbar-title">Fila de Conferência</div>
            <div className="topbar-subtitle">Painel de Acompanhamento</div>
          </div>
        </div>

        <div className="topbar-right">
          <span className="topbar-badge">Pendentes: {pedidos.length}</span>
          {erro && pedidos.length > 0 && (
            <span className="topbar-warning">
              ⚠ {erro} (mantendo últimos dados)
            </span>
          )}

          <button className="topbar-sound-btn" onClick={handleHabilitarAudio}>
            {somHabilitado ? "🔊 Som habilitado" : "🔇 Testar som"}
          </button>
        </div>
      </header>

      <main className="main-content">
        <section className="list-pane">{renderLista()}</section>

        <aside className="detail-pane">
          {selecionado ? (
            <DetalhePedidoPanel pedido={selecionado} />
          ) : (
            <div className="detail-empty">
              <span>👈</span>
              <span>Selecione um pedido na lista</span>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

/* ---------------------------------------------------------
     DETALHE + CORTES
--------------------------------------------------------- */

function DetalhePedidoPanel({ pedido }: { pedido: DetalhePedido }) {
  const itensComCorte = pedido.itens.filter((i) => {
    const original = i.qtdOriginal ?? i.qtdEsperada ?? i.qtdAtual ?? 0;
    const atualNaNota = i.qtdAtual ?? original;
    return atualNaNota < original;
  });

  const temCorte = itensComCorte.length > 0;

  const statusDesc = temCorte
    ? "Finalizada com corte"
    : statusMap[pedido.statusConferencia] || pedido.statusConferencia;

  const colors = temCorte
    ? { bg: "#FFE0E0", border: "#FF9999", text: "#B00000" }
    : statusColors[pedido.statusConferencia] || statusColors.AL;

  return (
    <div className="detail-card">
      <div className="detail-header">
        <div>
          <div className="detail-label">Pedido</div>
          <div className="detail-number">
            #{pedido.nunota}
            {pedido.numNota != null && pedido.numNota !== 0 && (
              <span className="detail-number-sec">
                {" "}
                · NF {pedido.numNota}
              </span>
            )}
          </div>

          {pedido.nomeParc && (
            <div className="detail-vendedor">
              Cliente: {pedido.nomeParc}
            </div>
          )}

          {pedido.nomeVendedor && (
            <div className="detail-vendedor">
              Vendedor: {pedido.nomeVendedor}
            </div>
          )}
        </div>

        <div
          className="detail-status-pill"
          style={{
            backgroundColor: colors.bg,
            borderColor: colors.border,
            color: colors.text,
          }}
        >
          <span className="detail-status-dot" />
          <span className="detail-status-text">
            {temCorte ? "✂️ " : ""}
            {statusDesc}
          </span>
        </div>
      </div>

      <div className="detail-section">
        <div className="detail-section-title">Itens</div>

        {pedido.itens.map((item, idx) => {
          const original =
            item.qtdOriginal ?? item.qtdEsperada ?? item.qtdAtual ?? 0;

          const conferido = item.qtdConferida ?? item.qtdAtual ?? original;

          const atualNaNota = item.qtdAtual ?? conferido;

          const corte = Math.max(0, original - atualNaNota);

          return (
            <div
              key={`${item.codProd}-${idx}`}
              className="detail-item-row"
            >
              <div className="detail-item-main">
                <div className="detail-item-title">
                  {item.codProd} · {item.descricao}
                </div>
                <div className="detail-item-sub">
                  Unidade: {item.unidade}
                </div>
              </div>

              <div className="detail-item-qty">
                <div>Orig: {original}</div>
                <div>Nota: {atualNaNota}</div>
                <div>Conf: {conferido}</div>
                {corte > 0 && (
                  <div className="item-corte">✂️ Corte: {corte}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button className="detail-button detail-button-disabled" disabled>
        Conferência feita no app
      </button>
    </div>
  );
}

export default App;
