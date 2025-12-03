// src/components/PedidoList.tsx
import { useEffect, useMemo, useState } from "react";
import type { DetalhePedido } from "../types/conferencia";
import { statusColors, statusMap } from "../config/status";

interface PedidoListProps {
  pedidos: DetalhePedido[];
  loadingInicial: boolean;
  erro: string | null;
  selecionado: DetalhePedido | null;
  onSelect: (pedido: DetalhePedido) => void;
}

const ITENS_POR_PAGINA = 10;

export function PedidoList({
  pedidos,
  loadingInicial,
  erro,
  selecionado,
  onSelect,
}: PedidoListProps) {
  // 🔎 estado de busca e página
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);

  // sempre que mudar lista ou filtro, volta pra página 1
  useEffect(() => {
    setPagina(1);
  }, [busca, pedidos]);

  // 🔍 filtra pelos campos principais (nunota, numNota, cliente, vendedor)
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return pedidos;

    return pedidos.filter((p) => {
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
  }, [busca, pedidos]);

  const totalFiltrados = filtrados.length;
  const totalPaginas = Math.max(
    1,
    Math.ceil(totalFiltrados / ITENS_POR_PAGINA)
  );
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const fim = inicio + ITENS_POR_PAGINA;
  const paginaPedidos = filtrados.slice(inicio, fim);

  // 🔽 A partir daqui só JSX/returns, sem mais hooks

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

        <div className="pagination-info">
          <span>
            Mostrando{" "}
            <strong>
              {totalFiltrados === 0 ? 0 : inicio + 1} -{" "}
              {Math.min(fim, totalFiltrados)}
            </strong>{" "}
            de <strong>{totalFiltrados}</strong> pedidos
          </span>
        </div>
      </div>

      {/* Se não houver resultados para o filtro atual */}
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
              const statusDesc = statusMap[p.statusConferencia] || "-";

              return (
                <div
                  key={p.nunota}
                  className={
                    "card" +
                    (emConferencia ? " card-em-conferencia" : "") +
                    (isSelected ? " card-selected" : "")
                  }
                  onClick={() => onSelect(p)}
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
                                <span className="info-text">
                                  {p.nomeParc}
                                </span>
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
                            {statusDesc}
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
                              <div className="info-label">
                                Conferente
                              </div>
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

          {/* Controles de paginação */}
          <div className="pagination-bar">
            <button
              className="pagination-btn"
              disabled={paginaAtual === 1}
              onClick={() =>
                setPagina((prev) => Math.max(1, prev - 1))
              }
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
                setPagina((prev) =>
                  Math.min(totalPaginas, prev + 1)
                )
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
