# DESIGN_SYSTEM.md — Sistema de diseño de Piixell

Describe cómo se ve y se comporta la interfaz. Los valores de referencia están en `src/styles.css` (sección v0.29.0, al final del archivo).

## Estilo: Fluent

Colores planos, sin degradados. Superficies translúcidas con desenfoque de fondo.

- **Superficie** (`.glass`, `.toolbar`, `.panel`, `.menu`, `.modal`): color plano `rgba(237,231,227,0.8)` (fondo al 80 %), `backdrop-filter: blur(24px)`, borde de 1 px `rgba(29,39,41,0.12)`, radio 8 px.
- **Brillo**: borde superior de 1 px claro `inset 0 1px 0 rgba(255,255,255,0.9)`. Sin degradados.
- **Sombra**: suave por detrás, `0 8px 24px rgba(29,39,41,0.18)`.
- **Radio único**: 8 px en todos los elementos, también en casillas (4 px) y botones de selección.
- **Separación**: 8 px entre elementos.
- **Espaciado**: márgenes y paddings en múltiplos de 8 (8, 16, 24, 32). Las variables `--space-1` a `--space-3` lo expresan.
- **Acento secundario**: solo en detalles (foco de teclado, marca de selección). Nunca en superficies ni en botones.

## Colores

| Rol | Valor | Uso |
|---|---|---|
| Acento principal | `#16697A` | Botón principal, selección, deslizadores, interruptores, pantalla de carga móvil |
| Textos | `#1D2729` | Todo el texto |
| Fondos | `#EDE7E3` | Fondo de la página y superficies (con 80 % de transparencia) |
| Acento secundario | `#FFA62B` | Solo detalles: foco de teclado |

Estados: el peligro usa `#B42318`.

Los colores de los objetos del estadio (`PALETTE_COLORS` en `src/palette.ts`) no forman parte de la interfaz y no han cambiado.

## Tipografía

- Familia: `"Segoe UI Variable", "Segoe UI", system-ui, -apple-system, sans-serif`.
- Títulos de sección: 12 px, mayúsculas, espaciado de 0,08 em, color secundario.
- Texto de controles: 14 px. Texto de ayuda: 14 px en color secundario.

## Forma y espaciado

- Radios: paneles 26 px, botones 14 px, tarjetas de gradas y herramientas 14 px, detalles 16 px, modales 28 px, pastillas 999 px.
- Espaciado entre bloques de panel: 16 px. Espaciado de listas: 6 px.
- Área táctil mínima: 40 px de alto en botones y 44 px en controles de móvil.

## Componentes

- **Botón**: `.btn` (translúcido), `.btn.primary` (coral con texto tinta), `.btn.danger` (texto rojo claro), `.btn.ghost`, `.btn.icon`, `.btn.full`.
- **Selector de color**: `ColorPicker` (12 colores predefinidos y uno personalizado). Usarlo en lugar de `input type=color` suelto.
- **Botones de la escena**: giro izquierda, vista cenital (activa en arena) y giro derecha.
- **Pastilla de modo**: `.segmented`. La opción activa es blanca con texto oscuro. Se usa para Estadio/Entorno, Día/Noche y para los tipos de edificio.
- **Botón redondo de giro**: `.round-btn` con flechas curvas de trazo.
- **Menú**: `.menu` flotante, con elementos `.menu-item` y la acción destructiva en rojo claro.
- **Panel**: `.panel` fijo abajo en móvil (hoja deslizante, altura máxima 38 vh), columna lateral de 340 px en escritorio. Cabecera con asa y botón de cierre `.panel-close` (solo móvil).
- **Acordeón**: `details.sub`, un solo apartado abierto a la vez.
- **Selector de color**: input nativo `type=color`.
- **Deslizadores**: `input[type=range]` con color de acento.
- **Conmutador**: `input.switch` con color de acento.
- **Modales**: `.modal-overlay` con desenfoque, `.modal` glass. Escape o clic fuera para cerrar.
- **Tarjetas de la biblioteca**: `.saved-item` con miniatura `.thumb` de 96 × 60 px.

## Comportamiento

- **Vista**: isométrica por defecto; la vista cenital mira desde arriba con el norte arriba.
- **Selección**: tocar un módulo o una grada en el estadio. El panel se abre al seleccionar una grada.
- **Pinchar y arrastrar**: en modo entorno, pintar celdas con arrastre.
- **Zoom**: rueda del ratón o pellizco, entre 0,25× y 3×.
- **Rotación**: botones de flecha, 90° por pulsación.
- **Animaciones**: 0,15–0,3 s, siempre suaves (`ease`). Sin animaciones de rebote.
- **Estados vacíos**: texto breve, sin relleno. Ejemplo: «Este módulo no tiene gradas todavía.»

## Accesibilidad

- Botones con `aria-label` cuando solo tienen icono.
- Pestañas con `role="tab"` y `aria-selected`.
- Contraste mínimo de texto: 4,5:1 sobre las superficies glass.

## Reglas

- No añadir avisos o textos de ayuda que el usuario no haya pedido.
- Los estados de error usan rojo, no el acento.
- Las superficies de la interfaz siempre son glass. No usar fondos sólidos en paneles ni menús.
