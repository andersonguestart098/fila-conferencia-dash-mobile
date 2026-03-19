import type { DetalhePedido } from "../../types/conferencia";
import {
  aceitaDecimalPorProduto,
  getEstoqueDisponivelAjustado,
  getQtdEsperadaItem,
  getQtdPedidoItem,
  isGrupoConstrucaoSeco,
  isQtdMatch,
  itemKey,
  verificarEstoqueSuficiente,
} from "./helpers";
import type { CheckedItemsByNunota, QtdByNunota } from "./storage";

interface PedidoExpandidoProps {
  pedido: DetalhePedido;
  checkedByNunota: CheckedItemsByNunota;
  qtdByNunota: QtdByNunota;
  toggleItemChecked: (nunota: number, key: string) => void;
  marcarTodos: (nunota: number, itens: any[], value: boolean) => void;
  setQtdConferida: (nunota: number, key: string, value: number | "") => void;
}

function formatQuantidadeVisual(valor: number, aceitaDecimal: boolean): string {
  const n = Number(valor ?? 0);

  if (!Number.isFinite(n)) return "0";

  if (!aceitaDecimal) {
    return String(Math.round(n));
  }

  const arredondado = Math.round(n * 1000) / 1000;

  if (Number.isInteger(arredondado)) {
    return String(arredondado);
  }

  return arredondado.toFixed(3).replace(/\.?0+$/, "");
}

export function PedidoExpandido({
  pedido,
  checkedByNunota,
  qtdByNunota,
  toggleItemChecked,
  marcarTodos,
  setQtdConferida,
}: PedidoExpandidoProps) {
  const map = checkedByNunota[pedido.nunota] ?? {};
  const mapQtd = qtdByNunota[pedido.nunota] ?? {};

  const total = pedido.itens.length;
  const done = pedido.itens.reduce((acc, it, idx) => acc + (map[itemKey(it, idx)] ? 1 : 0), 0);

  const okQty = pedido.itens.reduce((acc, it, idx) => {
    const qtd = getQtdEsperadaItem(it);
    const k = itemKey(it, idx);
    return acc + (isQtdMatch(qtd, mapQtd[k] ?? "") ? 1 : 0);
  }, 0);

  const estoqueOk = pedido.itens.reduce((acc, it) => {
    const grupoLiberado = isGrupoConstrucaoSeco((it as any).codGrupoProd);
    if (grupoLiberado) return acc + 1;
    return acc + (verificarEstoqueSuficiente(it) ? 1 : 0);
  }, 0);

  return (
    <tr className="row-detail">
      <td colSpan={7}>
        <div className="detail-box">
          <div className="detail-box-title" style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div>Itens do pedido #{pedido.nunota}</div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 900, opacity: 0.85 }}>
                Conferidos: {done}/{total} · Qtd OK: {okQty}/{total} · Estoque: {estoqueOk}/{total}
              </span>

              <button
                className="chip"
                onClick={(e) => {
                  e.stopPropagation();
                  marcarTodos(pedido.nunota, pedido.itens, true);
                }}
                title="Marcar todos (preenche qtd automaticamente)"
              >
                ✅ Tudo
              </button>

              <button
                className="chip"
                onClick={(e) => {
                  e.stopPropagation();
                  marcarTodos(pedido.nunota, pedido.itens, false);
                }}
                title="Desmarcar todos (limpa qtd)"
              >
                ↩️ Limpar
              </button>
            </div>
          </div>

          <div className="detail-items">
            {pedido.itens.map((item, idx) => {
              const qtdEsperada = getQtdEsperadaItem(item);
              const qtdNeg = getQtdPedidoItem(item);

              const grupoLiberado = isGrupoConstrucaoSeco((item as any).codGrupoProd);
              const aceitaDecimal = aceitaDecimalPorProduto((item as any).codProd);

              const estoqueBrutoRaw = Number(
                (item as any).estoqueBruto ??
                (item as any).estoqueTotal ??
                0
              );

              const estoqueDisponivelAjustado = getEstoqueDisponivelAjustado(item);

              const estoqueBrutoVisual = formatQuantidadeVisual(estoqueBrutoRaw, aceitaDecimal);
              const estoqueDisponivelVisual = formatQuantidadeVisual(estoqueDisponivelAjustado, aceitaDecimal);
              const qtdNegVisual = formatQuantidadeVisual(qtdNeg, aceitaDecimal);
              const qtdEsperadaVisual = formatQuantidadeVisual(qtdEsperada, aceitaDecimal);

              const key = itemKey(item, idx);
              const checked = !!checkedByNunota[pedido.nunota]?.[key];

              const digitadaRaw = qtdByNunota[pedido.nunota]?.[key] ?? "";
              const match = isQtdMatch(qtdEsperada, digitadaRaw);

              const estoqueInsuficiente = !verificarEstoqueSuficiente(item);

              const corEstoqueDisponivel =
                grupoLiberado || (estoqueDisponivelAjustado >= qtdNeg && estoqueDisponivelAjustado >= 0)
                  ? "#16a34a"
                  : "#b91c1c";

              const showMismatch = checked && !match;
              const showEstoqueError = estoqueInsuficiente && !grupoLiberado;

              return (
                <div
                  key={`${(item as any).codProd}-${idx}`}
                  className={`detail-item ${checked ? "detail-item-checked" : ""} ${showMismatch ? "detail-item-mismatch" : ""} ${showEstoqueError ? "detail-item-estoque-error" : ""}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="item-row">
                    <div className="item-info">
                      <div className="item-title">
                        {(item as any).codProd} · {(item as any).descricao}
                      </div>

                      <div className="item-sub">
                        Unidade: {(item as any).unidade} · Grupo: <b>{(item as any).codGrupoProd ?? "-"}</b>
                        {grupoLiberado && (
                          <span style={{ marginLeft: 8, color: "#16a34a", fontWeight: 900 }}>
                            Regra grupo 10
                          </span>
                        )}
                      </div>

                      <div style={{ marginTop: 6, fontSize: 13 }}>
                        Qtd Pedido: <b>{qtdNegVisual}</b>
                      </div>

                      <div style={{ marginTop: 2, fontSize: 13 }}>
                        Estoque Bruto:{" "}
                        <b className={showEstoqueError ? "estoque-insuficiente" : "estoque-suficiente"}>
                          {estoqueBrutoVisual}
                        </b>
                      </div>

                      <div style={{ marginTop: 2, fontSize: 13 }}>
                        Estoque Disponível:{" "}
                        <b
                          style={{
                            color: corEstoqueDisponivel,
                            fontWeight: 900,
                          }}
                        >
                          {estoqueDisponivelVisual}
                        </b>
                      </div>

                      {showEstoqueError && (
                        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 900, color: "#b91c1c" }}>
                          ⚠️ Estoque disponível insuficiente! ({estoqueDisponivelVisual} disponível, {qtdNegVisual} necessário)
                        </div>
                      )}

                      {grupoLiberado && estoqueDisponivelAjustado < qtdNeg && (
                        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 900, color: "#16a34a" }}>
                          ✅ Grupo de giro: permitido finalizar mesmo com estoque insuficiente
                        </div>
                      )}

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
                        className={`qtd-input ${showMismatch ? "qtd-input-error" : ""} ${showEstoqueError ? "qtd-input-estoque-error" : ""}`}
                        inputMode={aceitaDecimal ? "decimal" : "numeric"}
                        type="number"
                        min={0}
                        step={aceitaDecimal ? 0.001 : 1}
                        value={digitadaRaw === "" ? "" : Number(digitadaRaw)}
                        onChange={(e) => {
                          const v = e.target.value;

                          if (v === "") return setQtdConferida(pedido.nunota, key, "");

                          const n = Number(v);
                          if (!Number.isFinite(n)) return setQtdConferida(pedido.nunota, key, "");

                          const cleaned = Math.max(0, n);

                          if (aceitaDecimal) {
                            const rounded = Math.round(cleaned * 1000) / 1000;
                            return setQtdConferida(pedido.nunota, key, rounded);
                          }

                          setQtdConferida(pedido.nunota, key, Math.max(0, Math.floor(cleaned)));
                        }}
                        placeholder="digite"
                        title="Digite a quantidade conferida"
                      />

                      <div className={`qtd-hint ${match ? "qtd-hint-ok" : "qtd-hint-bad"}`}>
                        {digitadaRaw === "" ? "—" : match ? "OK" : `≠ ${qtdEsperadaVisual}`}
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`circle-check ${checked ? "circle-check-on" : ""}`}
                      onClick={() => toggleItemChecked(pedido.nunota, key)}
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
  );
}