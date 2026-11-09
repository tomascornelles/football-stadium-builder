# DESIGN_SYSTEM.md — Sistema de diseño de Piixell

Describe cómo se ve y se comporta la interfaz. Los valores de referencia están en `src/styles.css`.

## Estilo: Liquid Glass

Superficies translúcidas con desenfoque fuerte, borde claro y brillo especular superior.

- **Superficie `.glass`**: fondo degradado blanco translúcido (sobre el petróleo) (24 % → 7 % → 13 %), `backdrop-filter: blur(30px) saturate(190%) brightness(1.06)`, borde `rgba(255,255,255,.3)`, radio 26 px, sombra exterior `0 18px 50px rgba(0,0,0,.32)` y sombra interior de brillo.
- **Brillo especular**: pseudoelemento `::before` con gradiente blanco en la parte superior, detrás del contenido (`z-index: -1`).
- **Aislamiento**: los paneles y la cabecera usan `isolation: isolate`. La cabecera tiene `z-index: 60` y el menú `z-index: 1000` (capa fija).

## Colores

### Paleta de la interfaz (vigente desde 0.22.0)

Basada en la referencia de color: 60 % arena, 30 % petróleo, 10 % coral.

| Rol | Nombre | Valor | Uso |
|---|---|---|---|
| Principal (60 %) | Arena | `#E8DCC4` | Texto principal, pastilla activa, superficies claras |
| Secundario (30 %) | Petróleo | `#0F4C5C` | Fondo de la página, superficies profundas |
| Acento (10 %) | Coral | `#FF5E4D` | Botón principal, selección, deslizadores, interruptores |
| Tinta | Tinta | `#0A2E38` | Texto sobre arena y coral, fondos más oscuros |
| Secundario claro | Bruma | `#A9C3C6` | Texto secundario y de ayuda |

Valores exactos: coral `#FF5E4D` (de la referencia). Arena `#E8DCC4` y petróleo `#0F4C5C` son estimaciones de la referencia; confirmar antes de considerarlos definitivos.

Estados: el peligro usa rojo (`#E4574A`), distinto del coral de acento.

### Paleta de selección de color (12 colores predefinidos)

Definida en `src/palette.ts`: arena, arena oscura, marfil, petróleo, mar, turquesa suave, coral, coral suave, ladrillo, albaricoque, grafito y piedra. Se usa en fachadas, gradas, cubiertas, decoración y edificios. Cada selector permite además un color personalizado.

### Escenario

El césped, el asfalto, las aceras y los edificios del escenario mantienen sus colores propios (ver `src/geometry/`). La paleta de la interfaz no los cambia.

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

## Tema claro (vigente desde 0.24.0)

Fondo arena (`#EFE8DC` → `#E2D6C0`), paneles blancos esmerilados (`rgba(255,255,255,.94)`), texto petróleo oscuro (`#0A2E38`) y texto secundario (`#4F6B72`). Acción principal y pastilla activa en petróleo (`#0F4C5C`) con texto blanco. El asa del panel sigue en verde (`#27ae60`).

Se aplica con las reglas al final de `src/styles.css`, que sustituyen las del tema oscuro.
