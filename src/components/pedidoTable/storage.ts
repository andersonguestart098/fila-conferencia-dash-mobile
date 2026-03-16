export type TimerState = { startAt: number | null; elapsedMs: number; running: boolean };
export type TimerMap = Record<number, TimerState>;

export type Conferente = { codUsuario: number; nome: string };
export type ConferenteByNunota = Record<number, Conferente>;

export type CheckedItemsByNunota = Record<number, Record<string, boolean>>;
export type QtdByNunota = Record<number, Record<string, number | "">>;
export type NuconfByNunota = Record<number, number>;
export type OptimisticFinalizedByNunota = Record<number, number>;

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return (JSON.parse(raw) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function loadTimers(): TimerMap {
  return safeRead<TimerMap>("timerByNunota", {});
}
export function saveTimers(next: TimerMap) {
  safeWrite("timerByNunota", next);
}

export function loadConferenteByNunota(): ConferenteByNunota {
  return safeRead<ConferenteByNunota>("conferenteByNunota", {});
}
export function saveConferenteByNunota(next: ConferenteByNunota) {
  safeWrite("conferenteByNunota", next);
}

export function loadCheckedItems(): CheckedItemsByNunota {
  return safeRead<CheckedItemsByNunota>("checkedItemsByNunota", {});
}
export function saveCheckedItems(next: CheckedItemsByNunota) {
  safeWrite("checkedItemsByNunota", next);
}

export function loadQtdByNunota(): QtdByNunota {
  return safeRead<QtdByNunota>("qtdConferidaByNunota", {});
}
export function saveQtdByNunota(next: QtdByNunota) {
  safeWrite("qtdConferidaByNunota", next);
}

export function loadNuconfByNunota(): NuconfByNunota {
  return safeRead<NuconfByNunota>("nuconfByNunota", {});
}
export function saveNuconfByNunota(next: NuconfByNunota) {
  safeWrite("nuconfByNunota", next);
}

export function loadOptimisticFinalized(): OptimisticFinalizedByNunota {
  return safeRead<OptimisticFinalizedByNunota>("optimisticFinalizedByNunota", {});
}
export function saveOptimisticFinalized(next: OptimisticFinalizedByNunota) {
  safeWrite("optimisticFinalizedByNunota", next);
}