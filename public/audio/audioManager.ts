// src/audio/audioManager.ts
import type { DetalhePedido } from "../../src/types/conferencia";

const AUDIO_DEBUG = false;

const audioVendedores: Record<string, string> = {
  "GUILHERME RODRIGUES": "/audio/guilherme.mp3",
  "LUIS TIZONI": "/audio/luis.mp3",
  "ALINE GOMES": "/audio/felipe.mp3",
  "MARCIA MELLER": "/audio/marcia.mp3",
  "JONATHAS RODRIGUES": "/audio/jonathas.mp3",
  "PAULO FAGUNDES": "/audio/fagundes.mp3",
  "RAFAEL AZEVEDO": "/audio/rafael.mp3",
  "GB": "/audio/felipe.mp3",
  "GILIARD CAMPOS": "/audio/giliard.mp3",
  "SABINO BRESOLIN": "/audio/6+Sabino.mp3",
  "GUILHERME FRANCA": "/audio/guilherme.mp3",
  "LEONARDO MACHADO": "/audio/leonardo.mp3",
  "EDUARDO SANTOS": "/audio/eduardo.mp3",
  "RICARDO MULLER": "/audio/ricardo.mp3",
  "BRUNA SIQUEIRA": "/audio/felipe.mp3",
  "REBECA MOURA": "/audio/felipe.mp3",
  "GABRIEL AIRES": "/audio/gabriel.mp3",
  "GELSON MACHADO": "/audio/felipe.mp3",
  "GASPAR TARTARI": "/audio/gaspar.mp3",
  "FERNANDO SERAFIM": "/audio/fernando.mp3",
  "TREVISANI": "/audio/felipe.mp3",
  "DAIANE CAMPOS": "/audio/daiane.mp3",
  "JULIA TARTARI": "/audio/felipe.mp3",
  "FELIPE TARTARI": "/audio/felipe.mp3",
  "BETO TARTARI": "/audio/beto.mp3",
  "DANIEL MACCARI": "/audio/felipe.mp3",
};

function normalizarNome(nome?: string | null): string {
  if (!nome) return "";
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

export const AUDIO_INSTANCE_ID = Math.random().toString(36).slice(2, 8);

export class AudioLogger {
  static log(type: string, message: string, data?: any) {
    if (!AUDIO_DEBUG) return;

    const timestamp = new Date().toLocaleTimeString("pt-BR", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });

    console.log(
      `🔊 [${timestamp}] [INSTÂNCIA:${AUDIO_INSTANCE_ID}] [${type}] ${message}`,
      data ?? ""
    );
  }

  static important(type: string, message: string, data?: any) {
    const timestamp = new Date().toLocaleTimeString("pt-BR", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    console.info(`🔔 [${timestamp}] [${type}] ${message}`, data ?? "");
  }
}

const PLAYED_STORAGE_KEY = "audioPlayedNunotas";

function loadPlayedNunotas(): Set<number> {
  try {
    const raw = localStorage.getItem(PLAYED_STORAGE_KEY);
    return raw ? new Set<number>(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function savePlayedNunotas() {
  try {
    localStorage.setItem(PLAYED_STORAGE_KEY, JSON.stringify(Array.from(playedNunotas)));
  } catch {}
}

const queueNunotas = new Set<number>();
const playedNunotas: Set<number> = loadPlayedNunotas();

let audioLock = false;
let audioQueue: Array<{ src: string; nunota: number; nomeVendedor: string }> = [];
let currentAudio: HTMLAudioElement | null = null;

export function limparFilaAudio() {
  AudioLogger.log("CLEAR", "Limpando fila de áudio", {
    filaAntes: audioQueue.map((q) => q.nunota),
    audioAtual: currentAudio ? "playing" : "none",
  });

  audioQueue = [];
  audioLock = false;

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }

  queueNunotas.clear();
}

function processarFilaAudio() {
  if (audioLock) {
    AudioLogger.log("QUEUE_LOCKED", "Áudio travado, aguardando áudio atual terminar", {
      filaAtual: audioQueue.map((q) => q.nunota),
    });
    return;
  }

  if (audioQueue.length === 0) {
    AudioLogger.log("QUEUE_EMPTY", "Fila vazia, nada para tocar");
    return;
  }

  audioLock = true;
  const proximo = audioQueue.shift()!;

  AudioLogger.important("PLAY_START", `Iniciando áudio do pedido #${proximo.nunota}`, {
    nunota: proximo.nunota,
    vendedor: proximo.nomeVendedor,
    arquivo: proximo.src,
  });

  try {
    currentAudio = new Audio(proximo.src);

    currentAudio.onloadeddata = () => {
      AudioLogger.log("LOADED", `Áudio carregado para pedido #${proximo.nunota}`);
    };

    currentAudio.onplaying = () => {
      AudioLogger.log("PLAYING", `Áudio tocando para pedido #${proximo.nunota}`);
    };

    const finalizarPedidoDaFila = (motivo: string) => {
      AudioLogger.log("FINISH_ITEM", `Finalizando pedido #${proximo.nunota} na fila (${motivo})`, {
        nunota: proximo.nunota,
      });

      playedNunotas.add(proximo.nunota);
      savePlayedNunotas();
      queueNunotas.delete(proximo.nunota);

      audioLock = false;
      currentAudio = null;

      setTimeout(() => {
        if (audioQueue.length > 0) {
          processarFilaAudio();
        }
      }, 300);
    };

    currentAudio.onended = () => {
      AudioLogger.important("PLAY_END", `Áudio finalizado para pedido #${proximo.nunota}`);
      finalizarPedidoDaFila("onended");
    };

    currentAudio.onerror = (err) => {
      AudioLogger.important("ERROR", `Erro ao tocar áudio do pedido #${proximo.nunota}`, {
        error: err,
        src: proximo.src,
      });
      finalizarPedidoDaFila("onerror");
    };

    currentAudio.play().catch((err) => {
      AudioLogger.important("PLAY_FAIL", `Falha ao iniciar áudio do pedido #${proximo.nunota}`, {
        error: err,
        src: proximo.src,
      });
      finalizarPedidoDaFila("play.catch");
    });
  } catch (e) {
    AudioLogger.important("CRITICAL", `Erro crítico ao criar áudio para pedido #${proximo.nunota}`, {
      error: e,
    });

    audioLock = false;
    currentAudio = null;

    setTimeout(() => {
      if (audioQueue.length > 0) {
        processarFilaAudio();
      }
    }, 300);
  }
}

export function tocarAlertaCorte(
  nomeVendedor: string | null | undefined,
  nunota: number
): boolean {
  if (playedNunotas.has(nunota)) {
    AudioLogger.log("SKIP_PLAYED", `Pulando pedido #${nunota} - já tocou nesta sessão`, {
      nunota,
      vendedor: nomeVendedor,
    });
    return false;
  }

  if (queueNunotas.has(nunota)) {
    AudioLogger.log("SKIP_QUEUED", `Pulando pedido #${nunota} - já está na fila`, {
      nunota,
      vendedor: nomeVendedor,
      filaAtual: audioQueue.map((q) => q.nunota),
    });
    return false;
  }

  const nomeNorm = normalizarNome(nomeVendedor);
  const src = (nomeNorm && audioVendedores[nomeNorm]) || "/audio/felipe.mp3";

  AudioLogger.important("ALERT_TRIGGER_STATUS_C", `Pedido #${nunota} entrou em status C`, {
    nunota,
    vendedor: nomeVendedor,
    normalizado: nomeNorm,
    arquivo: src,
  });

  queueNunotas.add(nunota);

  audioQueue.push({
    src,
    nunota,
    nomeVendedor: nomeVendedor || "Desconhecido",
  });

  if (!audioLock) {
    processarFilaAudio();
  }

  return true;
}

export function dispararAlertasVoz(lista: DetalhePedido[]) {
  // Remove do set os pedidos que já saíram do status "C".
  // Isso garante que se um pedido voltar a "C" no futuro, o áudio toca de novo.
  const nunotasEmC = new Set(
    lista.filter((p) => p.statusConferencia === "C").map((p) => Number(p.nunota))
  );
  let limpou = false;
  for (const nunota of Array.from(playedNunotas)) {
    if (!nunotasEmC.has(nunota)) {
      playedNunotas.delete(nunota);
      limpou = true;
    }
  }
  if (limpou) savePlayedNunotas();

  for (const p of lista) {
    const estaAguardandoLiberacaoParaCorte = p.statusConferencia === "C";
    const jaTocou = playedNunotas.has(p.nunota);
    const jaNaFila = queueNunotas.has(p.nunota);

    if (estaAguardandoLiberacaoParaCorte && !jaTocou && !jaNaFila) {
      tocarAlertaCorte(p.nomeVendedor, p.nunota);
      break;
    }
  }
}

export function getEstadoFila() {
  return {
    emFila: Array.from(queueNunotas),
    jaTocaram: Array.from(playedNunotas),
    filaInterna: audioQueue.map((q) => q.nunota),
  };
}

export function verificarEstadoFila() {
  const estado = getEstadoFila();

  console.log("🎧 ESTADO ATUAL DE ÁUDIO:", estado);

  alert(
    `Veja no console:\n- Em fila: ${
      estado.emFila.join(", ") || "nenhum"
    }\n- Já tocados: ${estado.jaTocaram.join(", ") || "nenhum"}`
  );
}

export function limparTudoAudio() {
  if (
    window.confirm(
      "Tem certeza que deseja limpar a fila e o estado de áudio? Os pedidos poderão tocar novamente nesta sessão."
    )
  ) {
    playedNunotas.clear();
    savePlayedNunotas();
    queueNunotas.clear();
    limparFilaAudio();
    alert("Fila e estado de áudio limpos com sucesso!");
  }
}