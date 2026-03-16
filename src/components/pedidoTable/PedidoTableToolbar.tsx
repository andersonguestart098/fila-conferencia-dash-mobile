import { VENDEDORES } from "./constants";

interface Props {
  busca: string;
  setBusca: (v: string) => void;
  filtrosOpen: boolean;
  setFiltrosOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  somenteAguardando: boolean;
  setSomenteAguardando: (v: boolean | ((prev: boolean) => boolean)) => void;
  vendedorFiltro: string | null;
  setVendedorFiltro: (v: string | null) => void;
  sincronizarConferentes: () => void;
  somAlertaDesativado: boolean;
  toggleSomAlerta: () => void;
  tocarSomAlerta: () => void;
}

export function PedidoTableToolbar({
  busca,
  setBusca,
  filtrosOpen,
  setFiltrosOpen,
  somenteAguardando,
  setSomenteAguardando,
  vendedorFiltro,
  setVendedorFiltro,
  sincronizarConferentes,
  somAlertaDesativado,
  toggleSomAlerta,
  tocarSomAlerta,
}: Props) {
  return (
    <div className="cards-toolbar" style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
      <input
        className="input"
        placeholder="Buscar por cliente, vendedor ou número..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        style={{ flex: 1, minWidth: "200px" }}
      />

      <div style={{ position: "relative" }}>
        <button
          className={"chip" + (somenteAguardando || !!vendedorFiltro ? " chip-active" : "")}
          onClick={() => setFiltrosOpen((v: boolean) => !v)}
          title="Filtros"
        >
          🎛️ Filtros
        </button>

        {filtrosOpen && (
          <>
            <div onClick={() => setFiltrosOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 9998, background: "transparent" }} />

            <div
              className="dropdown"
              style={{
                position: "absolute",
                left: 0,
                zIndex: 9999,
                minWidth: 280,
                padding: 8,
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.12)",
                boxShadow: "0 18px 60px rgba(0,0,0,0.20)",
                background: "rgba(255,255,255,0.98)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button className="dropdown-item" onClick={() => setSomenteAguardando((s: boolean) => !s)}>
                {somenteAguardando ? "✅ Só aguardando (AC)" : "☐ Só aguardando (AC)"}
              </button>

              <div style={{ height: 1, background: "rgba(0,0,0,0.08)", margin: "8px 0" }} />

              <div style={{ fontWeight: 900, padding: "6px 10px", opacity: 0.85 }}>Vendedor</div>

              <button className="dropdown-item" onClick={() => setVendedorFiltro(null)}>
                {vendedorFiltro ? "☐ (Todos)" : "✅ (Todos)"}
              </button>

              {VENDEDORES.map((v) => (
                <button key={v} className="dropdown-item" onClick={() => setVendedorFiltro(v)}>
                  {vendedorFiltro?.toLowerCase() === v.toLowerCase() ? "✅ " : ""}
                  {v}
                </button>
              ))}

              <div style={{ height: 1, background: "rgba(0,0,0,0.08)", margin: "8px 0" }} />

              <button
                className="dropdown-item"
                onClick={() => {
                  setSomenteAguardando(false);
                  setVendedorFiltro(null);
                }}
              >
                🧹 Limpar filtros
              </button>

              <button className="dropdown-item" onClick={() => setFiltrosOpen(false)}>
                ✖️ Fechar
              </button>
            </div>
          </>
        )}
      </div>

      <button className="chip" onClick={sincronizarConferentes} style={{ backgroundColor: "#2196F3", color: "white" }}>
        🔄 Sync cache
      </button>

      <button
        className={`chip ${somAlertaDesativado ? "chip-inactive" : "chip-active"}`}
        onClick={toggleSomAlerta}
        title={`${somAlertaDesativado ? "Ativar" : "Desativar"} som de alerta para pedidos com +5min`}
      >
        {somAlertaDesativado ? "🔇 Som desativado" : "🔊 Som ativado"}
      </button>

      <button className="chip" onClick={tocarSomAlerta} style={{ marginLeft: "10px" }}>
        Testar Som
      </button>
    </div>
  );
}