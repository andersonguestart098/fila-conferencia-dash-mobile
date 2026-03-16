// src/types/conferencia.ts

export interface ItemConferencia {
  sequencia: number;
  codProd: number;
  codGrupoProd?: number | null;
  descricao: string;
  unidade: string;

  // Quantidades (podem vir nulas do backend)
  qtdEsperada?: number | null;
  qtdConferida?: number | null;
  qtdOriginal?: number | null;
  qtdAtual?: number | null;
  
  // Campos adicionais que podem vir do backend
  qtdNeg?: number;
  vlrUnit?: number | null;
  vlrTot?: number | null;
  estoqueDisponivel?: number | null;
}

export interface DetalhePedido {
  nunota: number;
  numNota?: number | null;
  nuconf?: number | null;

  statusConferencia: string;

  nomeParc?: string | null;
  nomeVendedor?: string | null;
  
  conferenteId?: number | null;
  conferenteNome?: string | null;
  
  nomeConferente?: string | null;
  
  avatarUrlConferente?: string | null;

  itens: ItemConferencia[];
}

export type Conferente = {
  codUsuario: number;
  nome: string;
};

export interface ConferenciaCriada {
  nuconf: number;
  nunotaOrig: number;
}

export interface ItemConferenciaUI extends ItemConferencia {
  qtdConferida: number;
  conferido: boolean;
}

export type Pedido = DetalhePedido;