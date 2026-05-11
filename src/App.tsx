import { useEffect } from "react";
import "./App.css";
import { useFilaConferencia } from "./hooks/useFilaConferencia";
import { conectarConferenciaStream } from "./api/conferenciaStream";
import { PedidoTable } from "./components/PedidoTable";
import {
  AUDIO_INSTANCE_ID,
  limparTudoAudio,
  verificarEstadoFila,
} from "../public/audio/audioManager";

import logoCemear from "./assets/logo.png";

function App() {
  const {
    pedidos,
    loadingInicial,
    erro,
    selecionado,
    setSelecionado,
    refresh,
  } = useFilaConferencia();

  useEffect(() => {
    console.log("🚀 [APP] iniciando conexão SSE");

    const disconnect = conectarConferenciaStream({
      onConnected: () => {
        console.log("✅ [APP] SSE conectado");
      },

      onPedidoStatusChanged: (event) => {
        console.log("📩 [APP] pedido_status_changed recebido", event);
        refresh();
      },

      onPedidoFinalizado: (event) => {
        console.log("📩 [APP] pedido_finalizado recebido", event);
        refresh();
      },

      onError: (error) => {
        console.warn("⚠️ [APP] erro SSE", error);
      },
    });

    return () => {
      console.log("🔌 [APP] encerrando SSE");
      disconnect();
    };
  }, [refresh]);

  return (
    <div className="app-root">
      <header className="cemear-navbar">
        <div className="cemear-navbar-inner">
          <div className="cemear-navbar-top">
            <div className="cemear-navbar-left">
              <div className="cemear-title-wrap">
                <div className="cemear-title">Fila de Conferência</div>
                <div className="cemear-subtitle">
                  Painel de Acompanhamento · Instância {AUDIO_INSTANCE_ID}
                </div>
              </div>
            </div>

            <div className="cemear-navbar-right">
              <div className="cemear-logo-wrap" title="Cemear">
                <img src={logoCemear} alt="Cemear" className="cemear-logo" />
              </div>
            </div>
          </div>

          <div className="cemear-navbar-bottom">
            <div className="cemear-actions-left">
              <span className="cemear-pill">Pedidos: {pedidos.length}</span>

              {erro ? (
                <span className="cemear-pill cemear-pill-warn">
                  ⚠ {erro} (mantendo últimos dados)
                </span>
              ) : null}
            </div>

            <div className="cemear-actions-right">
              <button
                className="cemear-btn"
                onClick={verificarEstadoFila}
                title="Verificar fila e estado atual"
              >
                📋 Estado Fila
              </button>

              <button
                className="cemear-btn cemear-btn-danger"
                onClick={limparTudoAudio}
                title="Limpar fila e estado de áudio"
              >
                🗑️ Limpar Fila/Estado
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className="list-pane" style={{ width: "100%" }}>
          <PedidoTable
            pedidos={pedidos}
            loadingInicial={loadingInicial}
            erro={erro}
            selecionado={selecionado}
            onSelect={setSelecionado}
            onRefresh={refresh}
          />
        </section>
      </main>

      <style>{`
        .cemear-navbar{
          position: sticky;
          top: 0;
          z-index: 1000;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        .cemear-navbar-inner{
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .cemear-navbar-top{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 14px;
          flex-wrap: wrap;
        }

        .cemear-navbar-left{
          display:flex;
          align-items:center;
          gap: 12px;
          min-width: 260px;
          flex: 1;
        }

        .cemear-title-wrap{
          display:flex;
          flex-direction:column;
          gap: 2px;
          min-width: 0;
        }

        .cemear-title{
          font-weight: 900;
          font-size: 20px;
          letter-spacing: -0.4px;
          background: linear-gradient(135deg, #ffffff 0%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cemear-subtitle{
          color: rgba(255,255,255,0.72);
          font-size: 12.5px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cemear-navbar-right{
          display:flex;
          align-items:center;
          justify-content:flex-end;
          gap: 10px;
        }

        .cemear-logo-wrap{
          height: 40px;
          display:flex;
          align-items:center;
          justify-content:center;
          padding: 0;
          border-radius: 12px;
          background: transparent;
          transition: transform .18s ease, filter .18s ease;
        }

        .cemear-logo-wrap:hover{
          transform: scale(1.04);
          filter: drop-shadow(0 10px 22px rgba(14,165,233,.22)) drop-shadow(0 2px 8px rgba(255,255,255,.10));
        }

        .cemear-logo{
          height: 40px;
          width: auto;
          object-fit: contain;
          display:block;
        }

        .cemear-navbar-bottom{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .cemear-actions-left{
          display:flex;
          align-items:center;
          gap: 10px;
          flex-wrap: wrap;
          min-width: 260px;
          flex: 1;
        }

        .cemear-actions-right{
          display:flex;
          align-items:center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .cemear-pill{
          display:inline-flex;
          align-items:center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 999px;
          font-weight: 800;
          font-size: 12.5px;
          color: #fff;
          background: rgba(255,255,255,0.10);
          border: 1px solid rgba(255,255,255,0.12);
          backdrop-filter: blur(10px);
        }

        .cemear-pill-warn{
          background: rgba(239, 68, 68, 0.16);
          border-color: rgba(239, 68, 68, 0.22);
          color: rgba(255,255,255,0.92);
        }

        .cemear-btn{
          height: 36px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.18);
          background: rgba(255,255,255,0.06);
          color: #fff;
          font-weight: 900;
          cursor: pointer;
          transition: transform .08s ease, background .12s ease, border-color .12s ease, filter .12s ease;
        }

        .cemear-btn:hover{
          background: rgba(255,255,255,0.10);
          border-color: rgba(255,255,255,0.30);
          transform: translateY(-1px);
          filter: brightness(1.02);
        }

        .cemear-btn:active{
          transform: translateY(0px);
        }

        .cemear-btn-danger{
          border-color: rgba(239,68,68,0.28);
          background: rgba(239,68,68,0.12);
        }

        .cemear-btn-danger:hover{
          background: rgba(239,68,68,0.18);
          border-color: rgba(239,68,68,0.40);
        }
      `}</style>
    </div>
  );
}

export default App;