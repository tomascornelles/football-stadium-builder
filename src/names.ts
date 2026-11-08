const PREFIXES = ['Estadio', 'Arena', 'Coliseo', 'Campo', 'Parque'];
const NAMES = [
  'del Alba', 'Monte Azul', 'Río Dorado', 'Costa Norte', 'Sol Naciente', 'Puerta Verde',
  'Vista Alta', 'Llano Real', 'Faro Blanco', 'Cima Dorada', 'de la Bahía', 'del Valle',
  'Luna Plateada', 'Pradera Real', 'Torre Alta', 'del Lago',
];

/** Nombre aleatorio con aspecto de estadio, por ejemplo «Arena Monte Azul». */
export function randomStadiumName(): string {
  const p = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  const n = NAMES[Math.floor(Math.random() * NAMES.length)];
  return `${p} ${n}`;
}
