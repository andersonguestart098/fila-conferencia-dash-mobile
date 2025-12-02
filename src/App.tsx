// src/App.tsx
import "./App.css";
import { useFilaConferencia } from "./hooks/useFilaConferencia";
import { PedidoList } from "./components/PedidoList";
import { DetalhePedidoPanel } from "./components/DetalhePedidoPanel";
import {
  AUDIO_INSTANCE_ID,
  limparTudoAudio,
  verificarEstadoFila,
} from "../public/audio/audioManager";

function App() {
  const { pedidos, loadingInicial, erro, selecionado, setSelecionado } =
    useFilaConferencia();

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="topbar-left">
          <span className="topbar-logo">📦</span>
          <div>
            <div className="topbar-title">Fila de Conferência</div>
            <div className="topbar-subtitle">
              Painel de Acompanhamento · Instância {AUDIO_INSTANCE_ID}
            </div>
          </div>
        </div>

        <div className="topbar-right">
          <span className="topbar-badge">Cards: {pedidos.length}</span>

          {erro && (
            <span className="topbar-warning">
              ⚠ {erro} (mantendo últimos dados)
            </span>
          )}

          <button
            className="topbar-log-btn"
            onClick={verificarEstadoFila}
            title="Verificar fila e estado atual"
          >
            📋 Estado Fila
          </button>

          <button
            className="topbar-log-btn danger"
            onClick={limparTudoAudio}
            title="Limpar fila e estado de áudio"
          >
            🗑️ Limpar Fila/Estado
          </button>
        </div>
      </header>

      <main className="main-content">
        <section className="list-pane">
          <PedidoList
            pedidos={pedidos}
            loadingInicial={loadingInicial}
            erro={erro}
            selecionado={selecionado}
            onSelect={setSelecionado}
          />
        </section>

        <aside className="detail-pane">
          {selecionado ? (
            <DetalhePedidoPanel pedido={selecionado} />
          ) : (
            <div className="detail-empty">
              <span>👈</span>
              <span>Selecione um pedido na lista</span>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

export default App;
