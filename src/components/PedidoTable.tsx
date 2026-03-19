import React, { useEffect, useMemo } from "react";
import type { DetalhePedido } from "../types/conferencia";
import "./pedidoTable/styles.css";

import { CONFERENTES, OPTIMISTIC_FINAL_TTL_MS } from "./pedidoTable/constants";
import { normalizeStatus, pedidoChecklistOk, podeFinalizar } from "./pedidoTable/helpers";
import { PedidoExpandido } from "./pedidoTable/PedidoExpandido";
import { PedidoPagination } from "./pedidoTable/PedidoPagination";
import { PedidoRow } from "./pedidoTable/PedidoRow";
import { PedidoTableToolbar } from "./pedidoTable/PedidoTableToolbar";
import { FinalizarModal } from "./pedidoTable/FinalizarModal";
import { SuccessModal } from "./pedidoTable/SuccessModal";
import { usePedidoActions } from "./pedidoTable/usePedidoActions";
import { usePedidoAlerts } from "./pedidoTable/usePedidoAlerts";
import { usePedidoTableState } from "./pedidoTable/usePedidoTableState";
import { usePedidoTimers } from "./pedidoTable/usePedidoTimers";

interface PedidoTableProps {
  pedidos: DetalhePedido[];
  loadingInicial: boolean;
  erro: string | null;
  selecionado: DetalhePedido | null;
  onSelect: (pedido: DetalhePedido) => void;
  onRefresh?: () => void;
}

export function PedidoTable({
  pedidos,
  loadingInicial,
  erro,
  onSelect,
  onRefresh,
}: PedidoTableProps) {
  const state = usePedidoTableState(pedidos);

  const {
    busca,
    setBusca,
    pagina,
    setPagina,
    somenteAguardando,
    setSomenteAguardando,
    vendedorFiltro,
    setVendedorFiltro,
    filtrosOpen,
    setFiltrosOpen,
    somAlertaDesativado,
    setSomAlertaDesativado,

    conferenteByNunota,
    setConferenteByNunota,
    nuconfByNunota,
    setNuconfByNunota,
    optimisticFinalizedByNunota,
    setOptimisticFinalizedByNunota,

    expandedNunota,
    setExpandedNunota,
    finalizarNunotaOpen,
    setFinalizarNunotaOpen,
    finalizarConferenteId,
    setFinalizarConferenteId,

    checkedByNunota,
    qtdByNunota,
    toggleItemChecked,
    marcarTodos,
    setQtdConferida,

    filtrados,
    paginaPedidos,
    totalPaginas,
    inicioIndex,
  } = state;

  const {
    timerByNunota,
    isOptimisticFinal,
    marcarOptimisticFinal,
    getVisualStatus,
  } = usePedidoTimers({
    pedidos,
    optimisticFinalizedByNunota,
    setOptimisticFinalizedByNunota,
  });

  const {
    tocarSomAlerta,
  } = usePedidoAlerts({
    pedidos,
    somAlertaDesativado,
    timerByNunota,
    isOptimisticFinal,
  });

  const {
    loadingConfirmacao,
    successModal,
    setSuccessModal,
    confirmarConferenteEFinalizar,
  } = usePedidoActions({
    nuconfByNunota,
    setNuconfByNunota,
    setConferenteByNunota,
    marcarOptimisticFinal: (nunota) => marcarOptimisticFinal(nunota, OPTIMISTIC_FINAL_TTL_MS),
    onRefresh,
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;

      setFiltrosOpen(false);

      if (successModal.open) {
        setSuccessModal({ open: false, nunota: null, nuconf: null, conferenteNome: null });
      }

      if (finalizarNunotaOpen !== null && loadingConfirmacao === null) {
        setFinalizarNunotaOpen(null);
        setFinalizarConferenteId("");
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [successModal.open, finalizarNunotaOpen, loadingConfirmacao, setFiltrosOpen, setSuccessModal, setFinalizarNunotaOpen, setFinalizarConferenteId]);

  useEffect(() => {
    const anyOpen = successModal.open || finalizarNunotaOpen !== null;
    if (!anyOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
    };
  }, [successModal.open, finalizarNunotaOpen]);

  const toggleSomAlerta = () => {
    setSomAlertaDesativado((prev) => !prev);
  };

  const sincronizarConferentes = () => {
    try {
      localStorage.removeItem("conferenteByNunota");
      localStorage.removeItem("nuconfByNunota");
      localStorage.removeItem("optimisticFinalizedByNunota");

      if (onRefresh) onRefresh();
      alert("Cache sincronizado. Os dados serão atualizados.");
      setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      console.error("Erro ao sincronizar:", error);
      alert("Erro ao sincronizar.");
    }
  };

  const pedidoModal = useMemo(
    () => pedidos.find((x) => x.nunota === finalizarNunotaOpen) ?? null,
    [pedidos, finalizarNunotaOpen]
  );

  const checklistModal = useMemo(() => {
    if (!pedidoModal) return null;
    return pedidoChecklistOk(pedidoModal, checkedByNunota, qtdByNunota);
  }, [pedidoModal, checkedByNunota, qtdByNunota]);

  function getConferenteExibicao(p: DetalhePedido) {
    const idBackend = (p as any).conferenteId as number | null | undefined;
    const nomeBackend = (p as any).conferenteNome as string | null | undefined;
    const nomeConferenteOld = (p as any).nomeConferente as string | null | undefined;

    if (idBackend && nomeBackend && nomeBackend !== "null" && nomeBackend !== "-" && nomeBackend !== "") {
      return { codUsuario: idBackend, nome: nomeBackend };
    }

    const nomeApenas =
      (nomeBackend && nomeBackend !== "null" && nomeBackend !== "-" && nomeBackend !== "" ? nomeBackend : null) ??
      (nomeConferenteOld && nomeConferenteOld !== "null" && nomeConferenteOld !== "-" && nomeConferenteOld !== ""
        ? nomeConferenteOld
        : null);

    if (nomeApenas) {
      const encontrado = CONFERENTES.find((c) => c.nome.toLowerCase() === nomeApenas.toLowerCase());
      if (encontrado) return encontrado;

      const local = conferenteByNunota[p.nunota];
      if (local && local.nome.toLowerCase() === nomeApenas.toLowerCase()) return local;

      return { codUsuario: 0, nome: nomeApenas };
    }

    return conferenteByNunota[p.nunota] ?? null;
  }

  if (loadingInicial && pedidos.length === 0) return <div className="center">Carregando…</div>;
  if (erro && pedidos.length === 0) return <div className="center">{erro}</div>;

  return (
    <div>
      <SuccessModal
        open={successModal.open}
        nunota={successModal.nunota}
        nuconf={successModal.nuconf}
        conferenteNome={successModal.conferenteNome}
        onClose={() => setSuccessModal({ open: false, nunota: null, nuconf: null, conferenteNome: null })}
      />

      <FinalizarModal
        open={finalizarNunotaOpen !== null}
        pedido={pedidoModal}
        loading={loadingConfirmacao === pedidoModal?.nunota}
        checklist={checklistModal}
        conferenteId={finalizarConferenteId}
        setConferenteId={setFinalizarConferenteId}
        onClose={() => {
          setFinalizarNunotaOpen(null);
          setFinalizarConferenteId("");
        }}
        onConfirm={async (conf) => {
          if (!pedidoModal) return;

          if (!conf || !conf.codUsuario || conf.codUsuario <= 0) {
            alert("Selecione um conferente antes de finalizar.");
            return;
          }

          try {
            await confirmarConferenteEFinalizar(pedidoModal, conf);
            setFinalizarNunotaOpen(null);
            setFinalizarConferenteId("");
          } catch (error: any) {
            console.error("Erro ao confirmar/finalizar conferência:", error);

            const status = error?.response?.status;
            const mensagem =
              error?.response?.data?.message ||
              error?.response?.data?.mensagem ||
              error?.response?.data?.error ||
              error?.message ||
              "Não foi possível finalizar a conferência.";

            if (status === 409) {
              alert(mensagem || "Este pedido já foi finalizado por outro usuário.");
              if (onRefresh) onRefresh();
              return;
            }

            alert(mensagem);
          }
        }}
      />

      <PedidoTableToolbar
        busca={busca}
        setBusca={setBusca}
        filtrosOpen={filtrosOpen}
        setFiltrosOpen={setFiltrosOpen}
        somenteAguardando={somenteAguardando}
        setSomenteAguardando={setSomenteAguardando}
        vendedorFiltro={vendedorFiltro}
        setVendedorFiltro={setVendedorFiltro}
        sincronizarConferentes={sincronizarConferentes}
        somAlertaDesativado={somAlertaDesativado}
        toggleSomAlerta={toggleSomAlerta}
        tocarSomAlerta={tocarSomAlerta}
      />

      <div className="table-wrap">
        <table className="pedido-table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Vendedor</th>
              <th>Status</th>
              <th>Tempo</th>
              <th>Conferente</th>
              <th style={{ width: 130, textAlign: "right" }}>Ações</th>
            </tr>
          </thead>

          <tbody>
            {paginaPedidos.map((p) => {
              const isExpanded = expandedNunota === p.nunota;
              const statusCode = normalizeStatus((p as any).statusConferencia);
              const podeFinalizarAgora = podeFinalizar(statusCode);

              const visual = getVisualStatus(p);
              const timer = timerByNunota[p.nunota] ?? { startAt: null, elapsedMs: 0, running: false };

              const now = Date.now();
              const tempoBackendMs = Number((p as any).tempoConferenciaMs ?? 0);

              const liveElapsedMs =
                visual.isFinalOk && tempoBackendMs > 0
                  ? tempoBackendMs
                  : timer.running && timer.startAt
                    ? timer.elapsedMs + (now - timer.startAt)
                    : timer.elapsedMs;

              const elapsedMin = Math.floor(liveElapsedMs / 60000);
              const alerta5min =
                statusCode === "AC" && elapsedMin >= 5 && !isOptimisticFinal(p.nunota);
                
              const confExibicao = getConferenteExibicao(p);

              const nomeConferenteTexto =
                (p as any).conferenteNome ??
                (p as any).nomeConferente ??
                conferenteByNunota[p.nunota]?.nome ??
                confExibicao?.nome ??
                "(não definido)";

              const isLoadingThis = loadingConfirmacao === p.nunota;
              const checklist = pedidoChecklistOk(p, checkedByNunota, qtdByNunota);
              const bloqueioChecklist = !checklist.ok;

              const disabledFinalizar =
              !podeFinalizarAgora ||
              visual.isFinalOk ||
              isLoadingThis ||
              bloqueioChecklist;

              return (
                <React.Fragment key={p.nunota}>
                  <PedidoRow
                    pedido={p}
                    isExpanded={isExpanded}
                    statusLabel={visual.label}
                    colors={visual.colors}
                    isOptimistic={visual.isOptimistic}
                    alerta5min={alerta5min}
                    liveElapsedMs={liveElapsedMs}
                    nomeConferenteTexto={nomeConferenteTexto}
                    disabledFinalizar={disabledFinalizar}
                    bloqueioChecklist={bloqueioChecklist}
                    onToggleExpand={() => {
                      onSelect(p);
                      setExpandedNunota((cur) => (cur === p.nunota ? null : p.nunota));
                    }}
                    onFinalizar={() => {
                      setFinalizarNunotaOpen(p.nunota);
                      setFinalizarConferenteId((confExibicao?.codUsuario ?? "") as any);
                    }}
                  />

                  {isExpanded && (
                    <PedidoExpandido
                      pedido={p}
                      checkedByNunota={checkedByNunota}
                      qtdByNunota={qtdByNunota}
                      toggleItemChecked={toggleItemChecked}
                      marcarTodos={marcarTodos}
                      setQtdConferida={setQtdConferida}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <PedidoPagination
        pagina={pagina}
        totalPaginas={totalPaginas}
        inicio={inicioIndex + 1}
        fim={Math.min(inicioIndex + 50, filtrados.length)}
        total={filtrados.length}
        onPrev={() => setPagina((p) => Math.max(1, p - 1))}
        onNext={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
      />
    </div>
  );
}

export default PedidoTable;