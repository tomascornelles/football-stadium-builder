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

/**
 * 24 colores predefinidos: 20 de la referencia de colores (ordenados como en ella)
 * y 4 de la marca. Los valores hex de la referencia son aproximados.
 */
export const PALETTE_COLORS: string[] = [
  // Ordenados por matiz (neutros primero, de oscuro a claro); 6 por fila
  '#86837A', '#A9A59C', '#B33939', '#FF5455', '#FF5E4D', '#CF6136',
  '#FF7A3D', '#EDE7E3', '#CC8D35', '#FFB142', '#F8F1E5', '#FFD97A',
  '#C9AE63', '#D0CDBE', '#35DCB5', '#21917A', '#1D2729', '#16697A',
  '#35ACE2', '#22739A', '#2D2D57', '#424279', '#484885', '#7370D6',
];
