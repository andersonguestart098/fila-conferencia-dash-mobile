// src/components/DetalhePedidoPanel.tsx
import { useEffect } from "react";
import type { DetalhePedido } from "../types/conferencia";
import { statusColors, statusMap } from "../config/status";
import Lottie from "lottie-react";

import atencaoAnim from "../assets/lotties/atencao.json";

function normalizeStatus(status: any): string {
  return String(status ?? "").trim().toUpperCase();
}

function formatElapsed(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

interface DetalhePedidoPanelProps {
  pedido: DetalhePedido;

  /** true quando o pedido está em AC e passou de 5 min e ainda não foi confirmado */
  attentionActive?: boolean;

  /** tempo corrido (ms) que você já calcula no PedidoList */
  attentionElapsedMs?: number;

  /** clique no OK para “dispensar” o alerta */
  onAttentionOk?: () => void;
}

export function DetalhePedidoPanel({
  pedido,
  attentionActive = false,
  attentionElapsedMs = 0,
  onAttentionOk,
}: DetalhePedidoPanelProps) {
  const divergente = pedido.statusConferencia === "D";

  const statusDesc = divergente
    ? "Finalizada divergente"
    : statusMap[pedido.statusConferencia] || pedido.statusConferencia;

  const colors = divergente
    ? { bg: "#FFE0E0", border: "#FF9999", text: "#B00000" }
    : statusColors[pedido.statusConferencia] || statusColors.AL;

  const statusCode = normalizeStatus((pedido as any).statusConferencia);

  // ✅ Logs pra debug (se não aparecer, você vai ver no console o motivo)
  useEffect(() => {
    console.log("🧠 [DETAIL PANEL] props", {
      nunota: pedido.nunota,
      statusRaw: (pedido as any).statusConferencia,
      statusCode,
      attentionActive,
      attentionElapsedMs,
      attentionElapsedMin: Math.floor(attentionElapsedMs / 60000),
    });
  }, [pedido.nunota, statusCode, attentionActive, attentionElapsedMs, pedido]);

  return (
    <div className="detail-card" style={{ position: "relative" }}>
      {/* ✅ Overlay FULL SCREEN sempre que attentionActive=true */}
      {attentionActive && (
        <div
          className="attention-overlay"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
          }}
        >
          <div className="attention-overlay-content">
            <div className="attention-overlay-lottie">
              <Lottie animationData={atencaoAnim} loop autoplay />
            </div>

            <div className="attention-overlay-title">Atenção</div>
            <div className="attention-overlay-sub">
              Pedido #{pedido.nunota} aguardando conferência há mais de 5 minutos.
            </div>

            <div className="attention-overlay-sub" style={{ fontWeight: 900 }}>
              Tempo: {formatElapsed(attentionElapsedMs)}
            </div>

            <button
              className="attention-overlay-ok"
              onClick={(e) => {
                e.stopPropagation();
                onAttentionOk?.();
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}

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
          <span className="detail-status-text">{statusDesc}</span>
        </div>
      </div>

      <div className="detail-section">
        <div className="detail-section-title">Itens</div>

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
                  {corte > 0 && <div className="item-corte">Corte: {corte}</div>}
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
