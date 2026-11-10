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

/** 24 colores predefinidos, en cuatro filas por familia de tono y de claro a oscuro. */
export const PALETTE_COLORS: string[] = [
  // Neutros: de claro a oscuro
  '#F7F3EA', '#E8DCC4', '#C5CFD1', '#8FA3A8', '#5C6B70', '#1D2729',
  // Rojos y corales
  '#FFB3A6', '#FF8C7A', '#FF5E4D', '#E14A3A', '#C2452D', '#8B2E1F',
  // Amarillos, naranjas y tierras
  '#F5E6C8', '#FFA62B', '#F2A65A', '#D4B98C', '#B98B5A', '#8A5A36',
  // Verdes, azules y petróleos
  '#A8D8CF', '#5FB3B3', '#1F7A8C', '#16697A', '#0F4C5C', '#0A2E38',
];
