// src/components/PedidoList.tsx
import type { DetalhePedido } from "../types/conferencia";
import { statusColors, statusMap } from "../config/status";

interface PedidoListProps {
  pedidos: DetalhePedido[];
  loadingInicial: boolean;
  erro: string | null;
  selecionado: DetalhePedido | null;
  onSelect: (pedido: DetalhePedido) => void;
}

export function PedidoList({
  pedidos,
  loadingInicial,
  erro,
  selecionado,
  onSelect,
}: PedidoListProps) {
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
        const emConferencia = p.statusConferencia === "A" && !!p.nomeConferente;

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
            onClick={() => onSelect(p)}
          >
            <div className="card-header">
              <div className="header-left">
                <span className="box-icon">📦</span>
                <div className="card-content">
                  <div className="pedido-label">Pedido</div>
                  <div className="numero-duplo">
                    <div className="numero-primario">
                      <span className="num-label">Nro. Único:</span>
                      <span className="num-value">#{p.nunota}</span>
                    </div>
                    {p.numNota != null && p.numNota !== 0 && (
                      <div className="numero-secundario">
                        <span className="num-label">Nro. Nota:</span>
                        <span className="num-value">{p.numNota}</span>
                      </div>
                    )}
                  </div>

                  <div className="info-row-names">
                    {p.nomeParc && (
                      <div className="cliente-info">
                        <div className="info-tag cliente-tag">
                          <span className="info-icon">🏢</span>
                          <span className="info-text">{p.nomeParc}</span>
                        </div>
                      </div>
                    )}

                    {p.nomeVendedor && (
                      <div className="vendedor-info">
                        <div className="info-tag vendedor-tag">
                          <span className="info-icon">👤</span>
                          <span className="info-text">{p.nomeVendedor}</span>
                        </div>
                      </div>
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
                    <span
                      className="status-text"
                      style={{ color: colors.text }}
                    >
                      {statusDesc}
                    </span>
                  </div>

                  <div className="card-footer">
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

            {emConferencia && (
              <div className="conferente-box">
                <span>{p.nomeConferente} está conferindo este pedido</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default PedidoList;
