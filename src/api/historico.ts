import { api } from "./client";
import type { ConferenciaHistorico } from "../types/historico";

export interface HistoricoPage {
  items: ConferenciaHistorico[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function buscarHistoricoConferencias(
  page: number,
  pageSize: number,
  busca?: string
): Promise<HistoricoPage> {
  const res = await api.get("/api/conferencia/historico", {
    params: {
      page,
      pageSize,
      ...(busca && busca.trim() ? { busca: busca.trim() } : {}),
    },
  });
  const data = res.data;

  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      page: 0,
      pageSize: data.length,
      totalPages: 1,
    };
  }

  // Spring Boot Page format
  const items: ConferenciaHistorico[] = Array.isArray(data.content)
    ? data.content
    : [];
  const total: number = data.totalElements ?? data.total ?? items.length;
  const totalPages: number =
    data.totalPages ?? Math.max(1, Math.ceil(total / pageSize));

  return {
    items,
    total,
    page: data.number ?? page,
    pageSize: data.size ?? pageSize,
    totalPages,
  };
}
