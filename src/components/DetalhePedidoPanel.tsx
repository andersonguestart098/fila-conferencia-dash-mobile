// src/components/DetalhePedidoPanel.tsx
import type { DetalhePedido } from "../types/conferencia";
import { statusColors, statusMap } from "../config/status";

interface DetalhePedidoPanelProps {
  pedido: DetalhePedido;
}

export function DetalhePedidoPanel({ pedido }: DetalhePedidoPanelProps) {
  const divergente = pedido.statusConferencia === "D";

  // 🔎 Status: se estiver divergente, força texto "Finalizada divergente"
  const statusDesc = divergente
    ? "Finalizada divergente"
    : statusMap[pedido.statusConferencia] || pedido.statusConferencia;

  // 🎨 Cores: se divergente, usa paleta de alerta; senão, cores padrão do status
  const colors = divergente
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
              <span className="detail-number-sec"> · NF {pedido.numNota}</span>
            )}
          </div>

          {pedido.nomeParc && (
            <div className="detail-vendedor">Cliente: {pedido.nomeParc}</div>
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
            {statusDesc}
          </span>
        </div>
      </div>

      <div className="detail-section">
        <div className="detail-section-title">Itens</div>

        {/* 👇 Container com scroll apenas para a lista de itens */}
        <div className="detail-items-scroll">
          {pedido.itens.map((item, idx) => {
            const original =
              item.qtdOriginal ?? item.qtdEsperada ?? item.qtdAtual ?? 0;
            const conferido = item.qtdConferida ?? item.qtdAtual ?? original;
            const atualNaNota = item.qtdAtual ?? conferido;
            const corte = Math.max(0, original - atualNaNota);

            return (
              <div
                key={`${item.codProd}-${idx}`}
                className={
                  "detail-item-row" + (corte > 0 ? " item-com-corte" : "")
                }
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
                  <div>Quantidade esperada: {original}</div>
                  <div>Quantidade conferida: {conferido}</div>
                  {corte > 0 && (
                    <div className="item-corte">Corte: {corte}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button className="detail-button detail-button-disabled" disabled>
        Conferência feita no app
      </button>
    </div>
  );
}

export default DetalhePedidoPanel;
