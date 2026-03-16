import type { DetalhePedido } from "../../types/conferencia";
import { formatElapsed } from "./helpers";

interface PedidoRowProps {
  pedido: DetalhePedido;
  isExpanded: boolean;
  statusLabel: string;
  colors: { bg: string; border: string; text: string };
  isOptimistic: boolean;
  alerta5min: boolean;
  liveElapsedMs: number;
  nomeConferenteTexto: string;
  disabledFinalizar: boolean;
  bloqueioChecklist: boolean;
  onToggleExpand: () => void;
  onFinalizar: () => void;
}

export function PedidoRow({
  pedido,
  isExpanded,
  statusLabel,
  colors,
  isOptimistic,
  alerta5min,
  liveElapsedMs,
  nomeConferenteTexto,
  disabledFinalizar,
  bloqueioChecklist,
  onToggleExpand,
  onFinalizar,
}: PedidoRowProps) {
  return (
    <tr
      className={`row ${isExpanded ? "row-expanded" : ""} ${alerta5min ? "row-pulse" : ""}`}
      onClick={onToggleExpand}
    >
      <td>
        <div style={{ fontWeight: 900 }}>
          #{pedido.nunota}
          {pedido.numNota != null && pedido.numNota !== 0 && (
            <span style={{ marginLeft: 8, opacity: 0.8, fontWeight: 700 }}>NF {pedido.numNota}</span>
          )}
        </div>
        <div style={{ opacity: 0.75, fontSize: 12 }}>{pedido.itens.length} itens</div>
      </td>

      <td>{pedido.nomeParc ?? "-"}</td>
      <td>{pedido.nomeVendedor ?? "-"}</td>

      <td>
        <span
          className="status-pill"
          style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
          title={statusLabel}
        >
          <span className="status-dot" style={{ backgroundColor: colors.text }} />
          {statusLabel}
          {isOptimistic && <span className="tag-5min">atualizando…</span>}
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
              if (bloqueioChecklist) {
                alert(
                  "Checklist incompleto: marque TODOS os itens, digite a quantidade conferida e valide o estoque dos itens fora do grupo 10."
                );
              }
              return;
            }

            onFinalizar();
          }}
          disabled={disabledFinalizar}
        >
          Finalizar
        </button>
      </td>
    </tr>
  );
}