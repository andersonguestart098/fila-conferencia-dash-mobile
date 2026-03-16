import { Portal } from "../Portal";

interface SuccessModalProps {
  open: boolean;
  nunota: number | null;
  nuconf: number | null;
  conferenteNome: string | null;
  onClose: () => void;
}

export function SuccessModal({
  open,
  nunota,
  nuconf,
  conferenteNome,
  onClose,
}: SuccessModalProps) {
  if (!open) return null;

  return (
    <Portal>
      <>
        <div className="modal-overlay" onClick={onClose} />
        <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <div className="modal-icon">✅</div>
          <div className="modal-title">Conferência finalizada!</div>

          <div className="modal-sub">
            Pedido <b>#{nunota}</b> finalizado com sucesso.
          </div>

          <div className="modal-meta">
            {nuconf ? (
              <div>
                <span className="modal-badge">NUCONF</span> <b>{nuconf}</b>
              </div>
            ) : null}

            {conferenteNome ? (
              <div style={{ marginTop: 6 }}>
                <span className="modal-badge">Conferente</span> <b>{conferenteNome}</b>
              </div>
            ) : null}

            <div style={{ marginTop: 10, opacity: 0.8, fontSize: 12 }}>
              Atualizando status do backend… (pode levar alguns segundos)
            </div>
          </div>

          <div className="modal-actions">
            <button className="chip chip-active" onClick={onClose} style={{ minWidth: 140 }}>
              OK
            </button>
          </div>
        </div>
      </>
    </Portal>
  );
}