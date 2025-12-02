// src/config/status.ts

export const statusMap: Record<string, string> = {
  A: "Em andamento",
  AC: "Aguardando conferência",
  AL: "Aguardando liberação p/ conferência",
  C: "Aguardando liberação de corte",
  D: "Finalizada divergente",
  F: "Finalizada OK",
  R: "Aguardando recontagem",
  RA: "Recontagem em andamento",
  RD: "Recontagem finalizada divergente",
  RF: "Recontagem finalizada OK",
  Z: "Aguardando finalização",
};

export const statusColors: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  A: { bg: "#E5F0FF", border: "#BFDBFE", text: "#1D4ED8" },
  AC: { bg: "#FEF3C7", border: "#FDE68A", text: "#92400E" },
  AL: { bg: "#F3F4F6", border: "#E5E7EB", text: "#4B5563" },
  C: { bg: "#FFF4E5", border: "#FFCC80", text: "#E65100" },
  D: { bg: "#FEE2E2", border: "#FCA5A5", text: "#B91C1C" },
  F: { bg: "#E8FDEB", border: "#66CC66", text: "#166534" },
  R: { bg: "#FFEDD5", border: "#FED7AA", text: "#9A3412" },
  RA: { bg: "#E5F0FF", border: "#BFDBFE", text: "#1D4ED8" },
  RD: { bg: "#FEE2E2", border: "#FCA5A5", text: "#B91C1C" },
  RF: { bg: "#E8FDEB", border: "#66CC66", text: "#166534" },
  Z: { bg: "#F3F4F6", border: "#E5E7EB", text: "#4B5563" },
};
