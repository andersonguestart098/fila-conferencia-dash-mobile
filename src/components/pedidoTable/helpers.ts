import type { DetalhePedido, ItemConferencia } from "../../types/conferencia";

const EPS = 0.001;

const PRODUTOS_BLOQUEADOS = new Set([
  14048, 13931, 14057, 14373, 15056, 14372, 14052, 15069, 14053, 14370,
  14669, 14051, 14369, 14524, 106283, 106279, 106278, 106282, 106276,
  106280, 106281, 106284, 106277, 106290, 10270, 106313, 13716, 15970,
  15975, 15273, 11516, 12707, 12734, 13066, 13153, 13154, 14686, 15221,
  15271, 15301, 10998, 12377, 106317, 9, 11, 6545, 6726, 6654, 6655
]);

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
  return ["A", "AC", "AL"].includes(normalizeStatus(statusCode));
}

function toNumber(value: any): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function round3(value: any): number {
  const n = toNumber(value);
  return Math.round(n * 1000) / 1000;
}

export function aceitaDecimalPorProduto(codProd: number | null | undefined): boolean {
  return [15, 16, 13354].includes(Number(codProd));
}

function normalizeByProduto(value: any, codProd: number | null | undefined): number {
  const n = toNumber(value);

  if (aceitaDecimalPorProduto(codProd)) {
    return round3(n);
  }

  return Math.round(n);
}

export function isQtdMatch(itemOrQtdEsperada: ItemConferencia | number, digitada: number | ""): boolean {
  if (digitada === "") return false;

  if (typeof itemOrQtdEsperada === "number") {
    const a = round3(itemOrQtdEsperada);
    const b = round3(digitada);
    return Math.abs(a - b) <= EPS;
  }

  const item = itemOrQtdEsperada;
  const codProd = (item as any).codProd;

  const esperada = normalizeByProduto(getQtdEsperadaItem(item), codProd);
  const digitadaNorm = normalizeByProduto(digitada, codProd);

  return Math.abs(esperada - digitadaNorm) <= EPS;
}

export function isGrupoLiberadoComExcecao(
  codGrupoProd: number | string | null | undefined,
  codProd: number | string | null | undefined
): boolean {
  if (codGrupoProd == null) return false;

  const isGrupo10 = String(codGrupoProd).startsWith("10");

  if (!isGrupo10) return false;

  if (codProd != null && PRODUTOS_BLOQUEADOS.has(Number(codProd))) {
    return false;
  }

  return true;
}

export function isGrupoConstrucaoSeco(codGrupoProd: number | string | null | undefined): boolean {
  if (codGrupoProd === null || codGrupoProd === undefined) return false;
  return String(codGrupoProd).startsWith("10");
}

export function getQtdEsperadaItem(item: ItemConferencia): number {
  const codProd = (item as any).codProd;

  return normalizeByProduto(
    (item as any).qtdEsperada ??
      (item as any).qtdAtual ??
      (item as any).qtdOriginal ??
      (item as any).qtdConferida ??
      0,
    codProd
  );
}

export function getQtdPedidoItem(item: ItemConferencia): number {
  const codProd = (item as any).codProd;

  return normalizeByProduto(
    (item as any).qtdNeg ??
      (item as any).qtdAtual ??
      (item as any).qtdEsperada ??
      (item as any).qtdOriginal ??
      0,
    codProd
  );
}

export function getEstoqueDisponivelOriginal(item: ItemConferencia): number {
  return round3(
    (item as any).estoqueDisponivel ??
      (item as any).estoqueDisp ??
      0
  );
}

export function getEstoqueBrutoItem(item: ItemConferencia): number {
  const codProd = (item as any).codProd;

  return normalizeByProduto(
    (item as any).estoqueBruto ??
      (item as any).estoqueTotal ??
      0,
    codProd
  );
}

export function getEstoqueDisponivelAjustado(item: ItemConferencia): number {
  const codProd = (item as any).codProd;
  const qtdNeg = getQtdPedidoItem(item);
  const estoqueDisponivelOriginal = getEstoqueDisponivelOriginal(item);

  return normalizeByProduto(estoqueDisponivelOriginal + qtdNeg, codProd);
}

export function verificarEstoqueSuficiente(item: ItemConferencia): boolean {
  const codProd = (item as any).codProd;
  const qtdNeg = normalizeByProduto(getQtdPedidoItem(item), codProd);
  const estoqueDisponivelAjustado = normalizeByProduto(getEstoqueDisponivelAjustado(item), codProd);

  return estoqueDisponivelAjustado + EPS >= qtdNeg;
}

export type CheckedItemsByNunota = Record<number, Record<string, boolean>>;
export type QtdByNunota = Record<number, Record<string, number | "">>;

export function pedidoChecklistOk(
  p: DetalhePedido,
  checkedByNunota: CheckedItemsByNunota,
  qtdByNunota: QtdByNunota
) {
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

    const digitada = mapQtd[k] ?? "";

    if (isQtdMatch(item, digitada)) {
      okQty++;
    }

    const grupoLiberado = isGrupoConstrucaoSeco((item as any).codGrupoProd);

    if (grupoLiberado || verificarEstoqueSuficiente(item)) {
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