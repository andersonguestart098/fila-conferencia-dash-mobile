import { useEffect, useState } from "react";
import "./App.css";
import type { DetalhePedido } from "./types/conferencia";
import { buscarPedidosPendentes } from "./api/conferencia";

// Mapa de código → descrição legível
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

// Cores usadas no "badge" de status
const statusColors: Record<string, { bg: string; border: string; text: string }> = {
  A: { bg: "#E5F0FF", border: "#BFDBFE", text: "#1D4ED8" },
  AC: { bg: "#FEF3C7", border: "#FDE68A", text: "#92400E" },
  AL: { bg: "#F3F4F6", border: "#E5E7EB", text: "#4B5563" },
  C: { bg: "#F3F4F6", border: "#E5E7EB", text: "#4B5563" },
  D: { bg: "#FEE2E2", border: "#FCA5A5", text: "#B91C1C" },
  F: { bg: "#E8FDEB", border: "#66CC66", text: "#166534" }, // verde principal
  R: { bg: "#FFEDD5", border: "#FED7AA", text: "#9A3412" },
  RA: { bg: "#E5F0FF", border: "#BFDBFE", text: "#1D4ED8" },
  RD: { bg: "#FEE2E2", border: "#FCA5A5", text: "#B91C1C" },
  RF: { bg: "#E8FDEB", border: "#66CC66", text: "#166534" },
  Z: { bg: "#F3F4F6", border: "#E5E7EB", text: "#4B5563" },
};

function App() {
  const [pedidos, setPedidos] = useState<DetalhePedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<DetalhePedido | null>(null);

  // carrega + polling
  useEffect(() => {
    let ativo = true;

    const carregar = async () => {
      try {
        setLoading(true);
        setErro(null);
        const atualizados = await buscarPedidosPendentes();
        if (!ativo) return;
        setPedidos(atualizados);

        // se nada selecionado ainda, pega o primeiro
        if (!selecionado && atualizados.length > 0) {
          setSelecionado(atualizados[0]);
        }
      } catch (e) {
        console.error("Erro ao carregar pedidos:", e);
        if (ativo) setErro("Erro ao carregar pedidos.");
      } finally {
        if (ativo) setLoading(false);
      }
    };

    carregar();

    const interval = setInterval(async () => {
      try {
        const atualizados = await buscarPedidosPendentes();
        if (!ativo) return;
        setPedidos(atualizados);

        // se o selecionado sumir da lista, limpa seleção
        if (
          selecionado &&
          !atualizados.some((p) => p.nunota === selecionado.nunota)
        ) {
          setSelecionado(atualizados[0] ?? null);
        }
      } catch (e) {
        console.error("Erro ao atualizar pedidos:", e);
      }
    }, 5000);

    return () => {
      ativo = false;
      clearInterval(interval);
    };
  }, [selecionado]);

  const renderLista = () => {
    if (loading && pedidos.length === 0) {
      return (
        <div className="center">
          <div className="spinner" />
          <p className="loading-text">Carregando...</p>
        </div>
      );
    }

    if (erro) {
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
        {pedidos.map((item) => {
          const emConferencia =
            item.statusConferencia === "A" && !!item.nomeConferente;

          const statusDescricao = statusMap[item.statusConferencia] || "-";
          const colors =
            statusColors[item.statusConferencia] || statusColors.AL;

          const isSelected = selecionado?.nunota === item.nunota;

          return (
            <div
              key={item.nunota}
              className={
                "card" +
                (emConferencia ? " card-em-conferencia" : "") +
                (isSelected ? " card-selected" : "")
              }
              onClick={() => setSelecionado(item)}
              role="button"
              tabIndex={0}
            >
              {/* Header */}
              <div className="card-header">
                <div className="header-left">
                  <span className="box-icon">📦</span>
                  <div>
                    <div className="pedido-label">Pedido</div>
                    <div className="pedido-number">#{item.nunota}</div>
                  </div>
                </div>

                {emConferencia && item.avatarUrlConferente && (
                  <img
                    src={item.avatarUrlConferente}
                    alt={item.nomeConferente ?? "Conferente"}
                    className="avatar"
                  />
                )}
              </div>

              {/* Status pill */}
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
                <span
                  className="status-text"
                  style={{ color: colors.text }}
                >
                  {statusDescricao}
                </span>
              </div>

              {/* Info row */}
              <div className="info-row">
                <div className="info-item">
                  <div className="info-label">Itens</div>
                  <div className="info-value">{item.itens.length}</div>
                </div>

                {emConferencia && (
                  <div className="info-item">
                    <div className="info-label">Conferente</div>
                    <div className="info-value-small">
                      {item.nomeConferente}
                    </div>
                  </div>
                )}
              </div>

              {/* Aviso conferente */}
              {emConferencia && (
                <div className="conferente-box">
                  <span className="conferente-text">
                    {item.nomeConferente} está conferindo este pedido
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="app-root">
      {/* Topbar */}
      <header className="topbar">
        <div className="topbar-left">
          <span className="topbar-logo">📦</span>
          <div className="topbar-title-group">
            <div className="topbar-title">Fila de Conferência</div>
            <div className="topbar-subtitle">Painel de Acompanhamento</div>
          </div>
        </div>

        <div className="topbar-right">
          <span className="topbar-badge">Pendentes: {pedidos.length}</span>
        </div>
      </header>

      {/* Conteúdo principal: lista + detalhe */}
      <main className="main-content">
        <section className="list-pane">{renderLista()}</section>

        <aside className="detail-pane">
          {selecionado ? (
            <DetalhePedidoPanel pedido={selecionado} />
          ) : (
            <div className="detail-empty">
              <span className="detail-empty-emoji">👈</span>
              <span className="detail-empty-text">
                Selecione um pedido na lista
              </span>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

type DetalheProps = {
  pedido: DetalhePedido;
};

function DetalhePedidoPanel({ pedido }: DetalheProps) {
  const totalItens = pedido.itens.length;
  const totalQuantidade = pedido.itens.reduce((acc: number, item: any) => {
    const qtd =
      (item.qtdNeg as number | undefined) ??
      (item.qtdEsperada as number | undefined) ??
      0;
    return acc + qtd;
  }, 0);

  const itensResumo = pedido.itens.slice(0, 10);
  const itensRestantes = totalItens - itensResumo.length;

  const statusDescricao =
    statusMap[pedido.statusConferencia] ||
    pedido.statusConferencia ||
    "-";

  const colors =
    statusColors[pedido.statusConferencia] || statusColors.AL;

  return (
    <div className="detail-card">
      <div className="detail-header">
        <div>
          <div className="detail-label">Pedido</div>
          <div className="detail-number">#{pedido.nunota}</div>
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
          <span className="detail-status-text">{statusDescricao}</span>
        </div>
      </div>

      <div className="detail-meta">
        <div className="detail-meta-item">
          <span className="detail-meta-label">Status</span>
          <span className="detail-meta-value">{statusDescricao}</span>
        </div>
        <div className="detail-meta-item">
          <span className="detail-meta-label">Total de itens</span>
          <span className="detail-meta-value">{totalItens}</span>
        </div>
        <div className="detail-meta-item">
          <span className="detail-meta-label">Quantidade total</span>
          <span className="detail-meta-value">{totalQuantidade}</span>
        </div>
      </div>

      <div className="detail-section">
        <div className="detail-section-title">Resumo dos produtos</div>

        <div className="detail-items-list">
          {itensResumo.map((item: any, idx: number) => (
            <div
              key={`${item.sequencia ?? idx}-${item.codProd}`}
              className="detail-item-row"
            >
              <div className="detail-item-main">
                <div className="detail-item-title">
                  {item.codProd} · {item.descricao}
                </div>
                <div className="detail-item-sub">
                  Unidade: {item.unidade ?? "-"}
                </div>
              </div>
              <div className="detail-item-qty">
                Qtd:{" "}
                {(item.qtdNeg ?? item.qtdEsperada ?? "-") as
                  | number
                  | string}
              </div>
            </div>
          ))}
        </div>

        {itensRestantes > 0 && (
          <div className="detail-more">
            + {itensRestantes} itens não exibidos
          </div>
        )}
      </div>

      {/* 🔒 Botão sempre desabilitado no dashboard */}
      <button
        className="detail-button detail-button-disabled"
        disabled
      >
        Conferência feita no app
      </button>
    </div>
  );
}


export default App;
