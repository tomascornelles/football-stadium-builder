import { actions } from '../store';
import {
  Project,
  currentProject,
  deleteFromLibrary,
  downloadProject,
  findSavedByName,
  parseProject,
  saveToLibrary,
} from '../persistence';
import { alertDialog, confirmDialog, loadDialog, saveDialog } from './dialog';

const defaultName = () => `Estadio ${new Date().toLocaleDateString('es-ES')}`;

/** Carga un proyecto reemplazando el actual, previa confirmación. */
export async function requestLoad(project: Project, label: string): Promise<boolean> {
  const ok = await confirmDialog({
    title: 'Reemplazar estadio',
    message: `Se sustituirá el estadio actual por «${label}». Los cambios no guardados se perderán.`,
    confirmLabel: 'Cargar',
    danger: true,
  });
  if (ok) actions.loadProject(project);
  return ok;
}

export async function saveFlow() {
  const name = await saveDialog('Guardar estadio', defaultName(), 'Guardar');
  if (!name) return;

  if (findSavedByName(name)) {
    const ok = await confirmDialog({
      title: 'Sobrescribir',
      message: `Ya existe un estadio llamado «${name}». ¿Quieres reemplazarlo?`,
      confirmLabel: 'Sobrescribir',
      danger: true,
    });
    if (!ok) return;
  }

  try {
    saveToLibrary(name);
    await alertDialog('Guardado', `El estadio «${name}» se ha guardado en este dispositivo.`);
  } catch {
    await alertDialog('Error', 'No se pudo guardar: el almacenamiento del navegador está lleno.');
  }
}

export async function exportFlow() {
  const name = await saveDialog('Exportar estadio', defaultName(), 'Exportar');
  if (!name) return;
  downloadProject(currentProject(name));
}

export function libraryFlow() {
  return loadDialog();
}

export async function importFlow(file: File) {
  let text: string;
  try {
    text = await file.text();
  } catch {
    await alertDialog('Error', 'No se pudo leer el archivo.');
    return;
  }
  let project: Project;
  try {
    project = parseProject(text);
  } catch (err) {
    await alertDialog('Archivo no válido', (err as Error).message);
    return;
  }
  await requestLoad(project, project.name);
}

export async function resetFlow() {
  const ok = await confirmDialog({
    title: 'Reiniciar estadio',
    message: 'Se borrarán las gradas y exteriores de la pantalla. Los estadios guardados no se verán afectados.',
    confirmLabel: 'Reiniciar',
    danger: true,
  });
  if (ok) actions.reset();
}

/** Borra un estadio guardado, pidiendo confirmación. Devuelve true si se borró. */
export async function deleteSavedFlow(id: string, name: string): Promise<boolean> {
  const ok = await confirmDialog({
    title: 'Eliminar estadio guardado',
    message: `¿Eliminar «${name}» de la biblioteca? Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    danger: true,
  });
  if (ok) deleteFromLibrary(id);
  return ok;
}
