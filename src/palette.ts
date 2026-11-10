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
  '#424279', // Jacksons Purple
  '#7370D6', // C64 Purple
  '#F8F1E5', // Swan White
  '#35ACE2', // Summer Sky
  '#35DCB5', // Celestial Green
  '#2D2D57', // Lucky Point
  '#484885', // Liberty
  '#A9A59C', // Hot Stone
  '#22739A', // Devil Blue
  '#21917A', // Palm Springs Splash
  '#FF5455', // Fluorescent Red
  '#FF7A3D', // Synthetic Pumpkin
  '#D0CDBE', // Crocodile Tooth
  '#FFB142', // Mandarin Sorbet
  '#FFD97A', // Spiced Butternut
  '#B33939', // Eye of Newt
  '#CF6136', // Chilean Fire
  '#86837A', // Grey Porcelain
  '#CC8D35', // Alameda Ochre
  '#C9AE63', // Desert
  '#16697A', // Piixell teal
  '#FF5E4D', // Piixell coral
  '#1D2729', // Piixell ink
  '#EDE7E3', // Piixell sand
];
