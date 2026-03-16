import { useEffect, useMemo, useState } from "react";
import type { DetalhePedido } from "../../types/conferencia";
import {
  loadCheckedItems,
  loadConferenteByNunota,
  loadNuconfByNunota,
  loadOptimisticFinalized,
  loadQtdByNunota,
  saveCheckedItems,
  saveQtdByNunota,
  type CheckedItemsByNunota,
  type ConferenteByNunota,
  type NuconfByNunota,
  type OptimisticFinalizedByNunota,
  type QtdByNunota,
} from "./storage";
import { getQtdEsperadaItem, itemKey, normalizeStatus } from "./helpers";
import { ITENS_POR_PAGINA } from "./constants";

export function usePedidoTableState(pedidos: DetalhePedido[]) {
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [somenteAguardando, setSomenteAguardando] = useState(false);
  const [vendedorFiltro, setVendedorFiltro] = useState<string | null>(null);
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [somAlertaDesativado, setSomAlertaDesativado] = useState(false);

  const [conferenteByNunota, setConferenteByNunota] = useState<ConferenteByNunota>(() => loadConferenteByNunota());
  const [nuconfByNunota, setNuconfByNunota] = useState<NuconfByNunota>(() => loadNuconfByNunota());
  const [optimisticFinalizedByNunota, setOptimisticFinalizedByNunota] =
    useState<OptimisticFinalizedByNunota>(() => loadOptimisticFinalized());

  const [expandedNunota, setExpandedNunota] = useState<number | null>(null);
  const [finalizarNunotaOpen, setFinalizarNunotaOpen] = useState<number | null>(null);
  const [finalizarConferenteId, setFinalizarConferenteId] = useState<number | "">("");

  const [checkedByNunota, setCheckedByNunota] = useState<CheckedItemsByNunota>(() => loadCheckedItems());
  const [qtdByNunota, setQtdByNunota] = useState<QtdByNunota>(() => loadQtdByNunota());

  useEffect(() => {
    setPagina(1);
  }, [busca, somenteAguardando, vendedorFiltro]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    let base = pedidos;

    if (somenteAguardando) {
      base = base.filter((p) => normalizeStatus((p as any).statusConferencia) === "AC");
    }

    if (vendedorFiltro) {
      base = base.filter((p) => (p.nomeVendedor ?? "").toLowerCase() === vendedorFiltro.toLowerCase());
    }

    if (!termo) return base;

    return base.filter((p) => {
      return (
        p.nunota.toString().includes(termo) ||
        p.numNota?.toString().includes(termo) ||
        p.nomeParc?.toLowerCase().includes(termo) ||
        p.nomeVendedor?.toLowerCase().includes(termo)
      );
    });
  }, [busca, pedidos, somenteAguardando, vendedorFiltro]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / ITENS_POR_PAGINA));
  const inicioIndex = (pagina - 1) * ITENS_POR_PAGINA;
  const paginaPedidos = filtrados.slice(inicioIndex, inicioIndex + ITENS_POR_PAGINA);

  function toggleItemChecked(nunota: number, key: string) {
    setCheckedByNunota((prev) => {
      const next: CheckedItemsByNunota = { ...prev };
      const map = { ...(next[nunota] ?? {}) };
      map[key] = !map[key];
      next[nunota] = map;
      saveCheckedItems(next);
      return next;
    });
  }

  function marcarTodos(nunota: number, itens: any[], value: boolean) {
    setCheckedByNunota((prev) => {
      const next: CheckedItemsByNunota = { ...prev };
      const map: Record<string, boolean> = { ...(next[nunota] ?? {}) };

      itens.forEach((it, idx) => {
        map[itemKey(it, idx)] = value;
      });

      next[nunota] = map;
      saveCheckedItems(next);
      return next;
    });

    setQtdByNunota((prev) => {
      const next: QtdByNunota = { ...prev };
      const map = { ...(next[nunota] ?? {}) };

      if (value) {
        itens.forEach((it, idx) => {
          const k = itemKey(it, idx);
          const qtdEsperada = getQtdEsperadaItem(it);
          const raw = Number(qtdEsperada) || 0;
          const cleaned = Math.max(0, raw);

          if ([15, 16].includes(Number(it.codProd))) {
            map[k] = Math.round(cleaned * 1000) / 1000;
          } else {
            map[k] = Math.max(0, Math.floor(cleaned));
          }
        });
      } else {
        itens.forEach((it, idx) => {
          const k = itemKey(it, idx);
          map[k] = "";
        });
      }

      next[nunota] = map;
      saveQtdByNunota(next);
      return next;
    });
  }

  function setQtdConferida(nunota: number, key: string, value: number | "") {
    setQtdByNunota((prev) => {
      const next: QtdByNunota = { ...prev };
      const map = { ...(next[nunota] ?? {}) };
      map[key] = value;
      next[nunota] = map;
      saveQtdByNunota(next);
      return next;
    });
  }

  return {
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
  };
}