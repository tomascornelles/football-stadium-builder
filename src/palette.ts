/**
 * Paleta de Piixell (basada en la referencia: 60 % arena, 30 % petróleo, 10 % coral).
 * Coral: exacto (#FF5E4D). Arena y petróleo: estimados de la referencia.
 */
export const UI_PALETTE = {
  /** Fondos */
  sand: '#EDE7E3',
  /** Acento principal */
  teal: '#16697A',
  /** Acento secundario: solo detalles */
  coral: '#FFA62B',
  /** Textos */
  ink: '#1D2729',
  mist: '#A9C3C6',
} as const;

/** 12 colores predefinidos para fachadas, gradas, cubiertas y edificios. */
export const PALETTE_COLORS: string[] = [
  '#E8DCC4', // arena
  '#D4B98C', // arena oscura
  '#F7F3EA', // marfil
  '#0F4C5C', // petróleo
  '#1F7A8C', // mar
  '#5FB3B3', // turquesa suave
  '#FF5E4D', // coral
  '#FF8C7A', // coral suave
  '#C2452D', // ladrillo
  '#F2A65A', // albaricoque
  '#2B3A42', // grafito
  '#8FA3A8', // piedra
];
