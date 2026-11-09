/** Nombre del estadio actual: el que se usó al guardar, exportar o cargar. */
let currentName: string | null = null;

export const getCurrentName = (): string | null => currentName;
export const setCurrentName = (name: string | null) => {
  currentName = name;
};
