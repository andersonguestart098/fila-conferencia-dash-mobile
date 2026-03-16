import type { CSSProperties } from "react";
import type { DetalhePedido } from "../../types/conferencia";
import type { Conferente } from "./storage";
import { CONFERENTES } from "./constants";
import { Portal } from "../Portal";

interface FinalizarModalProps {
  pedido: DetalhePedido | null;
  open: boolean;
  loading: boolean;
  checklist: {
    ok: boolean;
    done: number;
    okQty: number;
    estoqueOk: number;
  } | null;
  conferenteId: number | "";
  setConferenteId: (v: number | "") => void;
  onClose: () => void;
  onConfirm: (conferente: Conferente) => void;
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  zIndex: 200000,
};

const modalStyle: CSSProperties = {
  position: "fixed",
  left: "50%",
  top: "50%",
  transform: "translate(-50%, -50%)",
  width: "min(860px, calc(100vw - 28px))",
  background: "rgba(255,255,255,0.98)",
  border: "1px solid rgba(0,0,0,0.14)",
  borderRadius: 18,
  boxShadow: "0 30px 90px rgba(0,0,0,0.28)",
  zIndex: 200001,
  overflow: "hidden",
};

const spinnerWhite: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 999,
  border: "2px solid rgba(255,255,255,0.45)",
  borderTopColor: "rgba(255,255,255,1)",
  animation: "spin 0.9s linear infinite",
};

export function FinalizarModal({
  pedido,
  open,
  loading,
  checklist,
  conferenteId,
  setConferenteId,
  onClose,
  onConfirm,
}: FinalizarModalProps) {
  if (!open || !pedido || !checklist) return null;

  const canConfirm = checklist.ok;

  return (
    <Portal>
      <>
        <div
          style={overlayStyle}
          onClick={() => {
            if (loading) return;
            onClose();
          }}
        />

        <div style={modalStyle} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              padding: "18px 18px 12px 18px",
              borderBottom: "1px solid rgba(0,0,0,0.08)",
            }}
          >
            <div>
              <div style={{ fontWeight: 1000, fontSize: 20 }}>Finalizar conferência</div>
              <div style={{ marginTop: 4, fontSize: 13, opacity: 0.8, fontWeight: 700 }}>
                Pedido <b>#{pedido.nunota}</b>
                {pedido.numNota ? (
                  <>
                    {" "}
                    · NF <b>{pedido.numNota}</b>
                  </>
                ) : null}
              </div>

              {!canConfirm && (
                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 900, color: "#b91c1c" }}>
                  ⚠️ Para finalizar: marque TODOS os itens, DIGITE a quantidade conferida e valide o estoque dos itens fora do grupo 10.
                </div>
              )}

              <div style={{ marginTop: 8, fontSize: 12, fontWeight: 1000, color: "#b91c1c" }}>
                REALIZAR CORTE PELO SANKHYA!
              </div>
            </div>

            <button
              onClick={() => {
                if (loading) return;
                onClose();
              }}
              disabled={loading}
              title="Fechar"
              style={{
                border: 0,
                background: "rgba(0,0,0,0.05)",
                width: 40,
                height: 40,
                borderRadius: 12,
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 900,
                opacity: loading ? 0.6 : 1,
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ padding: "16px 18px 18px 18px" }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Selecionar conferente</div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 14 }}>
              <div
                style={{
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 14,
                  padding: 14,
                  background: "rgba(0,0,0,0.015)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75, marginBottom: 8 }}>Conferente</div>

                <select
                  className="select"
                  value={conferenteId}
                  onChange={(e) => {
                    const cod = Number(e.target.value || 0);
                    const found = CONFERENTES.find((c) => c.codUsuario === cod) || null;
                    setConferenteId(found?.codUsuario ?? "");
                  }}
                  style={{ width: "100%" }}
                  disabled={loading}
                >
                  <option value="">Escolha…</option>
                  {CONFERENTES.map((c) => (
                    <option key={c.codUsuario} value={c.codUsuario}>
                      {c.nome}
                    </option>
                  ))}
                </select>

                <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12 }}>
                  Ao confirmar, vamos definir o conferente e finalizar a conferência.
                </div>
              </div>

              <div
                style={{
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 14,
                  padding: 14,
                  background: "rgba(0,0,0,0.015)",
                }}
              >
                <div style={{ fontWeight: 1000, marginBottom: 10 }}>Resumo</div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0" }}>
                  <span style={{ opacity: 0.8 }}>Cliente</span>
                  <b>{pedido.nomeParc ?? "-"}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0" }}>
                  <span style={{ opacity: 0.8 }}>Vendedor</span>
                  <b>{pedido.nomeVendedor ?? "-"}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0" }}>
                  <span style={{ opacity: 0.8 }}>Itens</span>
                  <b>{pedido.itens?.length ?? 0}</b>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0" }}>
                  <span style={{ opacity: 0.8 }}>Checklist</span>
                  <b style={{ color: checklist.ok ? "#16a34a" : "#c97f2a" }}>
                    {checklist.done}/{pedido.itens.length} checks · {checklist.okQty}/{pedido.itens.length} qtd ok · {checklist.estoqueOk}/{pedido.itens.length} estoque
                  </b>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              padding: "12px 18px 18px 18px",
              borderTop: "1px solid rgba(0,0,0,0.08)",
            }}
          >
            <button className="chip" onClick={onClose} disabled={loading}>
              Cancelar
            </button>

            <button
              className="chip chip-active"
              onClick={() => {
                const cod = Number(conferenteId || 0);
                const found = CONFERENTES.find((c) => c.codUsuario === cod) || null;

                if (!found) return alert("Selecione o conferente.");
                if (!canConfirm) {
                  return alert(
                    "Checklist incompleto: marque todos os itens, digite a quantidade conferida e valide o estoque dos itens fora do grupo 10."
                  );
                }

                onConfirm(found);
              }}
              disabled={loading || !canConfirm || !(Number(conferenteId || 0) > 0)}
              style={{
                minWidth: 260,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                opacity: loading ? 0.92 : 1,
              }}
            >
              {loading ? (
                <>
                  <span style={spinnerWhite} />
                  Finalizando...
                </>
              ) : (
                "Confirmar e finalizar"
              )}
            </button>
          </div>
        </div>
      </>
    </Portal>
  );
}