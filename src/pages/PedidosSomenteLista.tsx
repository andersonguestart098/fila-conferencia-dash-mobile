import { useEffect } from "react";
import { useFilaConferencia } from "../hooks/useFilaConferencia";
import PedidoList from "../components/PedidoList";
import { conectarConferenciaStream } from "../api/conferenciaStream";

export default function PedidosSomenteLista() {
  const {
    pedidos,
    loadingInicial,
    erro,
    selecionado,
    setSelecionado,
    refresh,
  } = useFilaConferencia();

  useEffect(() => {
    console.log("🚀 [PEDIDOS_SOMENTE_LISTA] iniciando conexão SSE");

    const disconnect = conectarConferenciaStream({
      onConnected: () => {
        console.log("📡 [PEDIDOS_SOMENTE_LISTA] SSE conectado");
      },

      onPedidoStatusChanged: (event) => {
        console.log("📩 [PEDIDOS_SOMENTE_LISTA] pedido_status_changed recebido", event);
        refresh();
      },

      onPedidoFinalizado: (event) => {
        console.log("📩 [PEDIDOS_SOMENTE_LISTA] pedido_finalizado recebido", event);
        refresh();
      },

      onError: (error) => {
        console.warn("⚠️ [PEDIDOS_SOMENTE_LISTA] erro SSE", error);
      },
    });

    return () => {
      console.log("🔌 [PEDIDOS_SOMENTE_LISTA] encerrando SSE");
      disconnect();
    };
  }, [refresh]);

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="topbar-left">
          <span className="topbar-logo">📦</span>

          <div>
            <div className="topbar-title">Fila de Conferência</div>
            <div className="topbar-subtitle">Visão: Lista Simples</div>
          </div>
        </div>

        <div className="topbar-right">
          <span className="topbar-badge">Pendentes: {pedidos.length}</span>

          {erro && pedidos.length > 0 && (
            <span className="topbar-warning">
              ⚠ {erro} (mantendo últimos dados)
            </span>
          )}
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
            onRefresh={refresh}
          />
        </section>
      </main>
    </div>
  );
}