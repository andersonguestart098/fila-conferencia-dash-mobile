import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import logoCemear from "../assets/logo.png";
import { buscarHistoricoConferencias } from "../api/historico";
import type { ConferenciaHistorico } from "../types/historico";
import { statusMap, statusColors } from "../config/status";
import "../App.css";
import "../components/pedidoTable/styles.css";

const PAGE_SIZE = 20;

function formatElapsed(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "-";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}


export default function HistoricoConferencia() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ConferenciaHistorico[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pagina, setPagina] = useState(0); // 0-indexed para o backend
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [buscaInput, setBuscaInput] = useState("");
  const [busca, setBusca] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function carregar(page: number, termo: string) {
    try {
      setLoading(true);
      setErro(null);
      const resultado = await buscarHistoricoConferencias(page, PAGE_SIZE, termo);
      setItems(resultado.items);
      setTotal(resultado.total);
      setTotalPages(resultado.totalPages);
      setPagina(resultado.page);
    } catch (e: any) {
      setErro(
        e?.response?.data?.message ||
          e?.message ||
          "Erro ao carregar histórico."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar(0, "");
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setBusca(buscaInput);
      carregar(0, buscaInput);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [buscaInput]);

  function irParaPagina(p: number) {
    if (p < 0 || p >= totalPages || loading) return;
    carregar(p, busca);
  }

  const paginaDisplay = pagina + 1; // 1-indexed para o usuário
  const inicioItem = pagina * PAGE_SIZE + 1;
  const fimItem = Math.min(pagina * PAGE_SIZE + items.length, total);

  return (
    <div className="app-root">
      <header className="cemear-navbar">
        <div className="cemear-navbar-inner">
          <div className="cemear-navbar-top">
            <div className="cemear-navbar-left">
              <div className="cemear-title-wrap">
                <div className="cemear-title">Histórico de Conferências</div>
                <div className="cemear-subtitle">
                  Consulta de conferências realizadas
                </div>
              </div>
            </div>
            <div className="cemear-navbar-right">
              <div className="cemear-logo-wrap" title="Cemear">
                <img src={logoCemear} alt="Cemear" className="cemear-logo" />
              </div>
            </div>
          </div>

          <div className="cemear-navbar-bottom">
            <div className="cemear-actions-left">
              <span className="cemear-pill">
                {loading
                  ? "Carregando..."
                  : `Total: ${total.toLocaleString("pt-BR")}`}
              </span>
              {erro && (
                <span className="cemear-pill cemear-pill-warn">⚠ {erro}</span>
              )}
            </div>
            <div className="cemear-actions-right">
              <button
                className="cemear-btn"
                onClick={() => carregar(pagina, busca)}
                disabled={loading}
              >
                🔄 Atualizar histórico
              </button>
              <button className="cemear-btn" onClick={() => navigate("/")}>
                ← Voltar
              </button>
            </div>
          </div>
        </div>
      </header>

      <main
        className="main-content"
        style={{ overflowY: "auto", flexDirection: "column" }}
      >
        {loading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              flexDirection: "column",
              gap: 18,
              minHeight: 300,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                border: "5px solid rgba(193,201,214,0.18)",
                borderTop: "5px solid #C1C9D6",
                borderRadius: "50%",
                animation: "spin 0.9s linear infinite",
              }}
            />
            <div style={{ color: "#C1C9D6", fontWeight: 700, fontSize: 15 }}>
              Carregando histórico...
            </div>
          </div>
        ) : erro && items.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              color: "#C1C9D6",
              fontWeight: 700,
              fontSize: 15,
              minHeight: 300,
            }}
          >
            {erro}
          </div>
        ) : (
          <>
            <div style={{ padding: "14px 20px 4px" }}>
              <input
                className="input"
                type="text"
                placeholder="Buscar por cliente, vendedor ou nº único..."
                value={buscaInput}
                onChange={(e) => setBuscaInput(e.target.value)}
                style={{ width: "100%", maxWidth: 480 }}
              />
            </div>

            <div
              className="table-wrap"
              style={{ margin: "14px 20px 0", background: "rgba(255,255,255,0.96)" }}
            >
              <table className="pedido-table">
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Vendedor</th>
                    <th>Status</th>
                    <th>Conferente</th>
                    <th>Tempo</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          textAlign: "center",
                          padding: 40,
                          color: "#94a3b8",
                          fontWeight: 700,
                        }}
                      >
                        Nenhum registro encontrado.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const sc = item.statusConferencia ?? "";
                      const label = statusMap[sc] ?? sc;
                      const colors = statusColors[sc] ?? {
                        bg: "#F3F4F6",
                        border: "#E5E7EB",
                        text: "#4B5563",
                      };

                      return (
                        <tr key={`${item.nunota}-${item.nuconf}`}>
                          <td>
                            <div style={{ fontWeight: 900 }}>
                              #{item.nunota}
                              {item.numNota != null && item.numNota !== 0 && (
                                <span
                                  style={{
                                    marginLeft: 8,
                                    opacity: 0.8,
                                    fontWeight: 700,
                                  }}
                                >
                                  NF {item.numNota}
                                </span>
                              )}
                            </div>
                            {item.nuconf != null && (
                              <div style={{ opacity: 0.6, fontSize: 11 }}>
                                NUCONF {item.nuconf}
                              </div>
                            )}
                            {item.totalItens != null && (
                              <div style={{ opacity: 0.6, fontSize: 11 }}>
                                {item.totalItens} itens
                              </div>
                            )}
                          </td>

                          <td>{item.nomeParc ?? "-"}</td>
                          <td>{item.nomeVendedor ?? "-"}</td>

                          <td>
                            <span
                              className="status-pill"
                              style={{
                                backgroundColor: colors.bg,
                                borderColor: colors.border,
                                color: colors.text,
                              }}
                              title={label}
                            >
                              <span
                                className="status-dot"
                                style={{ backgroundColor: colors.text }}
                              />
                              {label}
                            </span>
                          </td>

                          <td>{item.conferenteNome ?? item.nomeConferente ?? "-"}</td>

                          <td>
                            <span className="timer-cell-time">
                              {formatElapsed(item.tempoConferenciaMs)}
                            </span>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 20px 16px",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 700 }}>
                {total > 0
                  ? `${inicioItem}–${fimItem} de ${total.toLocaleString("pt-BR")}`
                  : "0 registros"}
              </span>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  className="pagination-btn"
                  onClick={() => irParaPagina(0)}
                  disabled={pagina === 0 || loading}
                  style={{ background: "#fff" }}
                  title="Primeira página"
                >
                  «
                </button>
                <button
                  className="pagination-btn"
                  onClick={() => irParaPagina(pagina - 1)}
                  disabled={pagina === 0 || loading}
                  style={{ background: "#fff" }}
                >
                  ‹ Anterior
                </button>
                <span style={{ fontWeight: 800, fontSize: 13, color: "#C1C9D6", whiteSpace: "nowrap" }}>
                  Pág. {paginaDisplay} / {totalPages.toLocaleString("pt-BR")}
                </span>
                <button
                  className="pagination-btn"
                  onClick={() => irParaPagina(pagina + 1)}
                  disabled={pagina >= totalPages - 1 || loading}
                  style={{ background: "#fff" }}
                >
                  Próxima ›
                </button>
                <button
                  className="pagination-btn"
                  onClick={() => irParaPagina(totalPages - 1)}
                  disabled={pagina >= totalPages - 1 || loading}
                  style={{ background: "#fff" }}
                  title="Última página"
                >
                  »
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      <style>{`
        .cemear-navbar{
          position: sticky; top: 0; z-index: 1000;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .cemear-navbar-inner{ padding: 14px 16px; display:flex; flex-direction:column; gap:10px; }
        .cemear-navbar-top{ display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; }
        .cemear-navbar-left{ display:flex; align-items:center; gap:12px; min-width:260px; flex:1; }
        .cemear-title-wrap{ display:flex; flex-direction:column; gap:2px; min-width:0; }
        .cemear-title{
          font-weight:900; font-size:20px; letter-spacing:-0.4px;
          background: linear-gradient(135deg,#ffffff 0%,#94a3b8 100%);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .cemear-subtitle{ color:rgba(255,255,255,0.72); font-size:12.5px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .cemear-navbar-right{ display:flex; align-items:center; justify-content:flex-end; gap:10px; }
        .cemear-logo-wrap{ height:40px; display:flex; align-items:center; justify-content:center; border-radius:12px; background:transparent; transition:transform .18s ease,filter .18s ease; }
        .cemear-logo-wrap:hover{ transform:scale(1.04); filter:drop-shadow(0 10px 22px rgba(14,165,233,.22)); }
        .cemear-logo{ height:40px; width:auto; object-fit:contain; display:block; }
        .cemear-navbar-bottom{ display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .cemear-actions-left{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; min-width:260px; flex:1; }
        .cemear-actions-right{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
        .cemear-pill{ display:inline-flex; align-items:center; gap:8px; padding:8px 10px; border-radius:999px; font-weight:800; font-size:12.5px; color:#fff; background:rgba(255,255,255,0.10); border:1px solid rgba(255,255,255,0.12); backdrop-filter:blur(10px); }
        .cemear-pill-warn{ background:rgba(239,68,68,0.16); border-color:rgba(239,68,68,0.22); color:rgba(255,255,255,0.92); }
        .cemear-btn{ height:36px; padding:0 12px; border-radius:12px; border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06); color:#fff; font-weight:900; cursor:pointer; transition:transform .08s ease,background .12s ease,border-color .12s ease; }
        .cemear-btn:hover{ background:rgba(255,255,255,0.10); border-color:rgba(255,255,255,0.30); transform:translateY(-1px); }
        .cemear-btn:active{ transform:translateY(0px); }
        .cemear-btn:disabled{ opacity:0.5; cursor:not-allowed; transform:none; }
      `}</style>
    </div>
  );
}
