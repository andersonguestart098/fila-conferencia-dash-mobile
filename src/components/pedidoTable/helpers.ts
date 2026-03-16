import type { DetalhePedido, ItemConferencia } from "../../types/conferencia";

export function normalizeStatus(status: any): string {
  return String(status ?? "").trim().toUpperCase();
}

export function formatElapsed(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function itemKey(item: any, idx: number) {
  const cod = item?.codProd ?? item?.codigo ?? "X";
  return `${cod}-${idx}`;
}

export function podeFinalizar(statusCode: string) {
  return statusCode === "AC" || statusCode === "A";
}

export function isQtdMatch(qtdEsperada: number, digitada: number | ""): boolean {
  if (digitada === "") return false;

  const a = Number(qtdEsperada ?? 0);
  const b = Number(digitada);

  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;

  const EPS = 1e-6;
  return Math.abs(a - b) < EPS;
}

export function aceitaDecimalPorProduto(codProd: number | null | undefined): boolean {
  return [15, 16].includes(Number(codProd));
}

export function isGrupoConstrucaoSeco(codGrupoProd: number | string | null | undefined): boolean {
  if (codGrupoProd === null || codGrupoProd === undefined) return false;
  return String(codGrupoProd).startsWith("10");
}

export function getQtdEsperadaItem(item: ItemConferencia): number {
  return Number(item.qtdConferida ?? item.qtdAtual ?? item.qtdOriginal ?? item.qtdEsperada ?? 0) || 0;
}

export function getQtdPedidoItem(item: ItemConferencia): number {
  return Number(item.qtdNeg ?? getQtdEsperadaItem(item)) || 0;
}

/**
 * Nova regra:
 * - grupo começando com 10 => ignora validação de estoque
 * - demais grupos => exige estoque suficiente
 */
export function verificarEstoqueSuficiente(item: ItemConferencia): boolean {
  if (isGrupoConstrucaoSeco(item.codGrupoProd)) {
    return true;
  }

  const estoqueDisponivel = Number(item.estoqueDisponivel ?? 0);
  const qtdNecessaria = getQtdPedidoItem(item);

  return estoqueDisponivel > 0 && estoqueDisponivel >= qtdNecessaria;
}

export type CheckedItemsByNunota = Record<number, Record<string, boolean>>;
export type QtdByNunota = Record<number, Record<string, number | "">>;

export function pedidoChecklistOk(
  p: DetalhePedido,
  checkedByNunota: CheckedItemsByNunota,
  qtdByNunota: QtdByNunota
): {
  allChecked: boolean;
  allQtyOk: boolean;
  allEstoqueOk: boolean;
  ok: boolean;
  done: number;
  okQty: number;
  estoqueOk: number;
} {
  const mapCheck = checkedByNunota[p.nunota] ?? {};
  const mapQtd = qtdByNunota[p.nunota] ?? {};
  const total = p.itens.length;

  let done = 0;
  let okQty = 0;
  let estoqueOk = 0;

  for (let idx = 0; idx < p.itens.length; idx++) {
    const item = p.itens[idx];
    const k = itemKey(item, idx);

    const checked = !!mapCheck[k];
    if (checked) done++;

    const qtdEsperada = getQtdEsperadaItem(item);
    const digitada = mapQtd[k] ?? "";

    if (isQtdMatch(qtdEsperada, digitada)) {
      okQty++;
    }

    if (verificarEstoqueSuficiente(item)) {
      estoqueOk++;
    }
  }

  const allChecked = total > 0 ? done === total : false;
  const allQtyOk = total > 0 ? okQty === total : false;
  const allEstoqueOk = total > 0 ? estoqueOk === total : false;

  return {
    allChecked,
    allQtyOk,
    allEstoqueOk,
    ok: allChecked && allQtyOk && allEstoqueOk,
    done,
    okQty,
    estoqueOk,
  };
}