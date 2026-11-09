# AGENTS.md — Instrucciones para agentes de IA

Este documento es la referencia para cualquier agente (IA o persona) que modifique Piixell.
Léelo antes de tocar código. Junto a él van `CONTEXT.md` (qué es el proyecto y cómo está
hecho) y `DESIGN_SYSTEM.md` (cómo se ve y se comporta la interfaz).

## Idioma

- Responder y redactar la interfaz en **español**. Los nombres de código pueden estar en inglés o español, pero deben ser coherentes con el código existente.

## Versionado (obligatorio)

Versión SemVer en tres sitios que deben coincidir: `package.json` (`version`), `src/config.ts` (`APP_VERSION`) y `public/sw.js` (nombre de la caché `fsb-vX.Y.Z`). El README indica también la versión actual.

- **Nueva funcionalidad** → subir la versión menor: `0.19.2` → `0.20.0`.
- **Corrección de error** → subir la versión de parche: `0.19.1` → `0.19.2`.
- Cada cambio se confirma en git con un mensaje que empiece por `vX.Y.Z:`.

## Entregables (siempre)

Cada entrega incluye, en el zip y en el repositorio:
1. El código fuente completo (sin `node_modules/` ni `dist/`).
2. `AGENTS.md`, `DESIGN_SYSTEM.md` y `CONTEXT.md`, actualizados si el cambio los afecta.
3. Build verificado (`npm run build`) antes de empaquetar.

## Flujo de trabajo

1. Leer la petición. Si hay dudas sobre comportamiento, aspecto o alcance, **preguntar** antes de implementar. No adivinar.
2. Verificar cambios de geometría con cálculos (por ejemplo, distancias entre extremos) cuando sea posible: el usuario no siempre puede enviar capturas.
3. Hacer el cambio mínimo que resuelva la petición. No refactorizar código no relacionado.
4. Ejecutar `npx tsc --noEmit` y `npm run build`.
5. Subir la versión, confirmar en git y empaquetar `piixell-vX.Y.Z.zip`.

## Reglas técnicas

- **Geometría en coordenadas del mundo**. Las gradas, fachadas y cubiertas se construyen con `Frame` (curva `at(t)` y tangente `tan(t)`), no con transformaciones de grupo.
- **Esquinas**: cada fila de una esquina se une a la fila del mismo nivel de sus vecinos (`neighborFrame`). El desplazamiento propio de una esquina es solo la diferencia con sus vecinos (`cornerExtraOffset`).
- **Fachadas**: usan una distancia común (`ringBack`) para que sigan una línea continua alrededor del estadio.
- **Rendimiento**: como mucho 8 focos y 8 fanales de marquesina con luz real. Las farolas y ventanas son sprites y geometría, no luces.
- **Persistencia**: los datos de usuario son JSON validado en `persistence.ts` y `environment.ts`. Cualquier campo nuevo necesita valor por defecto para archivos antiguos y rango en `EXTERIOR_RANGES` si es numérico.
- **Diálogos**: nunca usar `alert`, `confirm` ni `prompt` del navegador. Usar `dialog.ts` / `flows.ts`.
- **Service Worker**: red primero (`public/sw.js`). Subir el nombre de caché en cada versión.
- **Sin texto de relleno** en la interfaz. El usuario ha pedido explícitamente quitar avisos innecesarios.

## Qué no hacer

- No añadir dependencias nuevas sin preguntar.
- No cambiar identificadores internos de módulos (`west`, `north`, `nw`…): los estadios guardados dependen de ellos.
- No cambiar el nombre del producto (Piixell) sin instrucción explícita.
