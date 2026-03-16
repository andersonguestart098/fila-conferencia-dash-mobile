import type { Conferente } from "./storage";

export const ITENS_POR_PAGINA = 50;

export const ROTA_INICIAR = "/api/conferencia/iniciar";
export const ROTA_DEFINIR_CONFERENTE = "/api/conferencia/conferente";
export const ROTA_FINALIZAR = "/api/conferencia/finalizar";

export const OPTIMISTIC_FINAL_TTL_MS = 65_000;

export const VENDEDORES: string[] = [
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

export const CONFERENTES: Conferente[] = [
  { codUsuario: 1, nome: "Manoel" },
  { codUsuario: 4, nome: "Matheus" },
  { codUsuario: 5, nome: "Cristiano" },
  { codUsuario: 7, nome: "Eduardo" },
  { codUsuario: 8, nome: "Everton" },
  { codUsuario: 9, nome: "Maximiliano" },
  { codUsuario: 10, nome: "Miqueias" },
];

export const FINAL_OK_COLORS = {
  bg: "rgba(22, 163, 74, 0.10)",
  border: "rgba(22, 163, 74, 0.55)",
  text: "#16a34a",
};