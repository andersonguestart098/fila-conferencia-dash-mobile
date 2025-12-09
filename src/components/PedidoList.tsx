// src/components/PedidoList.tsx
import { useEffect, useMemo, useState } from "react";
import type { DetalhePedido } from "../types/conferencia";
import { statusColors, statusMap } from "../config/status";
// 🔊 importa o audio manager
import { dispararAlertasVoz } from "../../public/audio/audioManager";

interface PedidoListProps {
  pedidos: DetalhePedido[];
  loadingInicial: boolean;
  erro: string | null;
  selecionado: DetalhePedido | null;
  onSelect: (pedido: DetalhePedido) => void;
}

const ITENS_POR_PAGINA = 50;

// 🧑‍💼 Lista fixa de vendedores para filtro
const VENDEDORES: string[] = [
  "LUIS TIZONI",
  "MARCIA MELLER",
  "JONATHAS RODRIGUES",
  "PAULO FAGUNDES",
  "RAFAEL AZEVEDO",
  "GB",
  "GILIARD CAMPOS",
  "SABINO BRESOLIN",
  "GUILHERME FRANCA",
  "LEONARDO MACHADO",
  "EDUARDO SANTOS",
  "RICARDO MULLER",
  "GABRIEL AIRES",
  "GASPAR TARTARI",
  "FERNANDO SERAFIM",
  "DAIANE CAMPOS",
  "FELIPE TARTARI",
  "BETO TARTARI",
  "DANIEL MACCARI",
];

// 🔎 mesma regra de corte usada no DetalhePedidoPanel
function temCorteNoPedido(pedido: DetalhePedido): boolean {
  return pedido.itens.some((i) => {
    const original = i.qtdOriginal ?? i.qtdEsperada ?? i.qtdAtual ?? 0;
    const atualNaNota = i.qtdAtual ?? original;
    return atualNaNota < original;
  });
}

export function PedidoList({
  pedidos,
  loadingInicial,
  erro,
  selecionado,
  onSelect,
}: PedidoListProps) {
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [somenteAguardando, setSomenteAguardando] = useState(false);

  // 🎯 novo: filtro por vendedor
  const [vendedorFiltro, setVendedorFiltro] = useState<string | null>(null);
  const [mostrarListaVendedores, setMostrarListaVendedores] = useState(false);

  // 🔁 Resetar página quando usuário muda busca, filtro de status ou vendedor
  useEffect(() => {
    setPagina(1);
  }, [busca, somenteAguardando, vendedorFiltro]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    let base = pedidos;

    if (somenteAguardando) {
      base = base.filter((p) => p.statusConferencia === "AC");
    }

    if (vendedorFiltro) {
      base = base.filter(
        (p) =>
          (p.nomeVendedor ?? "").toLowerCase() ===
          vendedorFiltro.toLowerCase()
      );
    }

    if (!termo) return base;

    return base.filter((p) => {
      const nunotaStr = p.nunota?.toString() ?? "";
      const numNotaStr = p.numNota ? p.numNota.toString() : "";
      const cliente = p.nomeParc?.toLowerCase() ?? "";
      const vendedor = p.nomeVendedor?.toLowerCase() ?? "";

      return (
        nunotaStr.includes(termo) ||
        numNotaStr.includes(termo) ||
        cliente.includes(termo) ||
        vendedor.includes(termo)
      );
    });
  }, [busca, pedidos, somenteAguardando, vendedorFiltro]);

  const totalBase = pedidos.length;
  const totalFiltrados = filtrados.length;
  const totalPaginas = Math.max(
    1,
    Math.ceil(totalFiltrados / ITENS_POR_PAGINA)
  );

  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const fim = inicio + ITENS_POR_PAGINA;
  const paginaPedidos = filtrados.slice(inicio, fim);

  useEffect(() => {
    if (pagina > totalPaginas) {
      setPagina(totalPaginas);
    }
  }, [totalPaginas, pagina]);

  // 🔊 DISPARO DO ÁUDIO VIA audioManager
  // Aqui a gente passa a lista completa de pedidos,
  // e o audioManager decide se tem status "C" novo pra tocar.
  useEffect(() => {
    if (!pedidos || pedidos.length === 0) return;
    dispararAlertasVoz(pedidos);
  }, [pedidos]);

  if (loadingInicial && pedidos.length === 0) {
    return (
      <div className="center">
        <div className="spinner" />
        <p className="loading-text">Carregando...</p>
      </div>
    );
  }

  if (erro && pedidos.length === 0) {
    return (
      <div className="center">
        <p className="error-text">{erro}</p>
      </div>
    );
  }

  if (pedidos.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-emoji">📦</div>
        <div className="empty-text">Nenhum pedido pendente</div>
        <div className="empty-subtext">Tudo limpo por aqui ✨</div>
      </div>
    );
  }

  return (
    <div>
      {/* Barra de ferramentas da lista */}
      <div className="list-toolbar">
        <input
          type="text"
          className="search-input"
          placeholder="Buscar por cliente, vendedor ou número..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />

        {/* Chip de filtro AC */}
        <button
          type="button"
          className={
            "filter-chip" + (somenteAguardando ? " filter-chip-active" : "")
          }
          onClick={() => setSomenteAguardando((prev) => !prev)}
        >
          <span className="filter-dot" />
          {somenteAguardando ? "Ver todos" : "Só aguardando conferência"}
        </button>

        {/* 🎯 Filtro por vendedor */}
        <div className="vendor-filter-wrapper">
          <button
            type="button"
            className={
              "filter-chip" + (vendedorFiltro ? " filter-chip-active" : "")
            }
            onClick={() => setMostrarListaVendedores((prev) => !prev)}
          >
            <span className="filter-dot" />
            {vendedorFiltro
              ? `Vendedor: ${vendedorFiltro}`
              : "Filtrar por vendedor"}
            <span style={{ marginLeft: 6 }}>▾</span>
          </button>

          {mostrarListaVendedores && (
            <div className="vendor-dropdown">
              <button
                type="button"
                className={"vendor-item" + (!vendedorFiltro ? " active" : "")}
                onClick={() => {
                  setVendedorFiltro(null);
                  setMostrarListaVendedores(false);
                }}
              >
                Todos os vendedores
              </button>

              {VENDEDORES.map((nome) => (
                <button
                  key={nome}
                  type="button"
                  className={
                    "vendor-item" + (vendedorFiltro === nome ? " active" : "")
                  }
                  onClick={() => {
                    setVendedorFiltro(nome);
                    setMostrarListaVendedores(false);
                  }}
                >
                  {nome}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pagination-info">
          <span>
            Mostrando{" "}
            <strong>
              {totalFiltrados === 0 ? 0 : inicio + 1} -{" "}
              {Math.min(fim, totalFiltrados)}
            </strong>{" "}
            de <strong>{totalFiltrados}</strong> pedidos
            {totalFiltrados !== totalBase && (
              <>
                {" "}
                (de <strong>{totalBase}</strong> no total)
              </>
            )}
          </span>
        </div>
      </div>

      {totalFiltrados === 0 ? (
        <div className="empty-state">
          <div className="empty-emoji">🔎</div>
          <div className="empty-text">Nenhum resultado encontrado</div>
          <div className="empty-subtext">
            Ajuste o termo de pesquisa para encontrar outros pedidos.
          </div>
        </div>
      ) : (
        <>
          <div className="cards-grid">
            {paginaPedidos.map((p) => {
              const isSelected = selecionado?.nunota === p.nunota;
              const emConferencia =
                p.statusConferencia === "A" && !!p.nomeConferente;

              const colors =
                statusColors[p.statusConferencia] || statusColors.AL;
              const statusBase = statusMap[p.statusConferencia] || "-";

              const temCorte = temCorteNoPedido(p);
              const divergente = p.statusConferencia === "D";

              return (
                <div
                  key={p.nunota}
                  className={
                    "card" +
                    (emConferencia ? " card-em-conferencia" : "") +
                    (isSelected ? " card-selected" : "")
                  }
                  onClick={() => onSelect(p)}
                  data-status-conferencia={p.statusConferencia}
                  data-divergente={divergente ? "true" : "false"}
                >
                  <div className="card-header">
                    <div className="header-left">
                      <span className="box-icon">📦</span>
                      <div className="card-content">
                        <div className="pedido-label">Pedido</div>
                        <div className="numero-duplo">
                          <div className="numero-primario">
                            <span className="num-label">Nro. Único:</span>
                            <span className="num-value">#{p.nunota}</span>
                          </div>
                          {p.numNota != null && p.numNota !== 0 && (
                            <div className="numero-secundario">
                              <span className="num-label">Nro. Nota:</span>
                              <span className="num-value">{p.numNota}</span>
                            </div>
                          )}
                        </div>

                        <div className="info-row-names">
                          {p.nomeParc && (
                            <div className="cliente-info">
                              <div className="info-tag cliente-tag">
                                <span className="info-icon">🏢</span>
                                <span className="info-text">{p.nomeParc}</span>
                              </div>
                            </div>
                          )}

                          {p.nomeVendedor && (
                            <div className="vendedor-info">
                              <div className="info-tag vendedor-tag">
                                <span className="info-icon">👤</span>
                                <span className="info-text">
                                  {p.nomeVendedor}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div
                          className="status-pill"
                          style={{
                            backgroundColor: colors.bg,
                            borderColor: colors.border,
                          }}
                        >
                          <div
                            className="status-dot"
                            style={{ backgroundColor: colors.text }}
                          />
                          <span
                            className="status-text"
                            style={{ color: colors.text }}
                          >
                            {/* 🔊 Preferência agora é pelo status divergente */}
                            {divergente && (
                              <span className="corte-icon">
                                ⚠️ Status divergente{" "}
                              </span>
                            )}

                            {/* Se não for divergente, mas tiver corte, mantém info de corte */}
                            {!divergente && temCorte && (
                              <span className="corte-icon">
                                ✂️ Corte no pedido{" "}
                              </span>
                            )}

                            <span className="status-base">
                              {statusBase}
                            </span>
                          </span>
                        </div>

                        <div className="card-footer">
                          <div className="info-item">
                            <div className="info-label">Itens</div>
                            <div className="info-value">
                              {p.itens.length}
                            </div>
                          </div>

                          {emConferencia && (
                            <div className="info-item">
                              <div className="info-label">Conferente</div>
                              <div className="info-value-small">
                                {p.nomeConferente}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {emConferencia && p.avatarUrlConferente && (
                      <img
                        className="avatar"
                        src={p.avatarUrlConferente}
                        alt={p.nomeConferente ?? "Conferente"}
                      />
                    )}
                  </div>

                  {emConferencia && (
                    <div className="conferente-box">
                      <span>
                        {p.nomeConferente} está conferindo este pedido
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pagination-bar">
            <button
              className="pagination-btn"
              disabled={paginaAtual === 1}
              onClick={() => setPagina((prev) => Math.max(1, prev - 1))}
            >
              ◀ Anterior
            </button>

            <span className="pagination-status">
              Página <strong>{paginaAtual}</strong> de{" "}
              <strong>{totalPaginas}</strong>
            </span>

            <button
              className="pagination-btn"
              disabled={paginaAtual === totalPaginas}
              onClick={() =>
                setPagina((prev) => Math.min(totalPaginas, prev + 1))
              }
            >
              Próxima ▶
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default PedidoList;
