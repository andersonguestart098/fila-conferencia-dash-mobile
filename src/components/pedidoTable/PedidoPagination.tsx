interface PedidoPaginationProps {
  pagina: number;
  totalPaginas: number;
  inicio: number;
  fim: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

export function PedidoPagination({
  pagina,
  totalPaginas,
  inicio,
  fim,
  total,
  onPrev,
  onNext,
}: PedidoPaginationProps) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
      <div style={{ opacity: 0.8 }}>
        Mostrando {inicio} - {fim} de {total} pedidos
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button className="chip" disabled={pagina <= 1} onClick={onPrev}>
          ←
        </button>
        <div className="chip">
          {pagina}/{totalPaginas}
        </div>
        <button className="chip" disabled={pagina >= totalPaginas} onClick={onNext}>
          →
        </button>
      </div>
    </div>
  );
}