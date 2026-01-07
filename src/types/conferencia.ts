// src/types/conferencia.ts

export interface ItemConferencia {
  sequencia: number;
  codProd: number;
  descricao: string;
  unidade: string;

  // Quantidades (podem vir nulas do backend)
  qtdEsperada?: number | null;
  qtdConferida?: number | null;
  qtdOriginal?: number | null;
  qtdAtual?: number | null;
  
  // Campos adicionais que podem vir do backend
  qtdNeg?: number; // ✅ Adicionado para compatibilidade
  vlrUnit?: number;
  vlrTot?: number;
}

export interface DetalhePedido {
  nunota: number;
  numNota?: number | null;
  nuconf?: number | null;

  statusConferencia: string; // "AC", "A", "R", etc.

  nomeParc?: string | null;
  nomeVendedor?: string | null;
  
  
  // ✅ Campos para o conferente
  conferenteId?: number | null;       // Código do conferente (salvo pelo app mobile)
  conferenteNome?: string | null;     // Nome do conferente (salvo pelo app mobile)
  
  // ✅ Campo antigo para compatibilidade (mantido)
  nomeConferente?: string | null;
  
  avatarUrlConferente?: string | null;

  itens: ItemConferencia[];
}

// ✅ Tipo para Conferente (usado no componente)
export type Conferente = {
  codUsuario: number;
  nome: string;
};

// ✅ Interface para resposta da criação de conferência
export interface ConferenciaCriada {
  nuconf: number;
  nunotaOrig: number;
}

// ✅ Interface para itens de conferência na UI
export interface ItemConferenciaUI extends ItemConferencia {
  qtdConferida: number;
  conferido: boolean;
}

// ✅ Tipo para Pedido (alias para compatibilidade)
export type Pedido = DetalhePedido;