// src/types/conferencia.ts

export interface ItemConferencia {
  codProd: number;
  descricao: string;
  unidade: string;

  // Quantidades (podem vir nulas do backend)
  qtdEsperada?: number | null;
  qtdConferida?: number | null;
  qtdOriginal?: number | null;
  qtdAtual?: number | null;
}

export interface DetalhePedido {
  nunota: number;
  numNota?: number | null;

  statusConferencia: string; // "AC", "A", "R", etc.

  nomeParc?: string | null;
  nomeVendedor?: string | null;
  nomeConferente?: string | null;
  avatarUrlConferente?: string | null;

  itens: ItemConferencia[];
}
