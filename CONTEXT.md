# CONTEXT.md — Contexto del proyecto Piixell

## Qué es

Piixell es un **constructor de estadios de fútbol** en pixel art isométrico, en forma de aplicación web progresiva (PWA). Funciona en escritorio, tablet y móvil, se puede instalar y usar sin conexión.

El usuario construye un estadio por módulos (laterales, fondos y esquinas), con gradas, cubiertas y exteriores, y diseña el entorno urbano alrededor (carreteras, parques, edificios).

## Estado actual

Versión **0.23.4**. Funcionalidades:

- **Estadio**: 8 módulos (`north`, `ne`, `east`, `se`, `south`, `sw`, `west`, `nw`). `north`/`south` son laterales (105 m), `west`/`east` son fondos (68 m), las esquinas son curvas de Bézier.
- **Gradas**: altura, inclinación, desplazamiento, curvatura (recta, curva intermedia, curva), pilares, barandilla, color. Se apilan por niveles.
- **Exteriores por módulo**: fachada (6 estilos), cubierta (3 tipos, ancho, extensión interior, pilares), iluminación (torres de focos o barra), marcador, decoración exterior y sobre cubierta (pilares, torres, soportes, arcos, armaduras, mástiles, celosía).
- **Muros de unión** entre fachadas vecinas.
- **Entorno**: cuadrícula de 400 × 400 m, celdas de 20 m. Parque por defecto. Herramientas: vía (carretera, avenida o camino), árboles, edificio (casa, edificio u oficinas en torre), agua y borrar. Vías unidas con curvas, cruces, aceras, líneas, coches y semáforos. Glorietas: anillo de 8 vías alrededor de una celda central libre. Aparcamiento: bloque 3 × 3 de vías o vías interiores de un bloque mayor. Agua con orillas irregulares y arena.
- **Día y noche**: sombras solo de día. De noche, farolas, ventanas iluminadas, focos y fanales de marquesina con luz real.
- **Guardar y cargar**: biblioteca local con miniaturas, archivo `.json`, exportar PNG.
- **Vistas**: isométrica y cenital. Paleta de la interfaz: arena, petróleo y coral.

## Arquitectura

```
src/
├── config.ts              Versión, dimensiones del campo, límites, cuadrícula del entorno
├── types.ts               Tipos del dominio y opciones de los selectores
├── store.ts               Estado global, acciones y persistencia local (localStorage)
├── persistence.ts         Formato de archivo, validación, biblioteca y descarga
├── environment.ts         Coordenadas de la cuadrícula y saneado del entorno
├── names.ts               Nombres aleatorios de estadios
├── capture.ts             PNG y miniaturas del escenario
├── geometry/
│   ├── modules.ts         Gradas, esquinas, fachadas, cubiertas, decoración, focos, muros
│   └── environment.ts     Carreteras, parques, edificios, luces de noche
├── three/
│   ├── StadiumView.tsx    Escena Three.js: cámara ortográfica, selección, gestos, luces
│   └── pitch.ts           Campo de fútbol
└── ui/
    ├── App.tsx            Cabecera, menú, selector Estadio/Entorno, día/noche
    ├── EditorPanel.tsx    Panel de gradas y exteriores
    ├── StandEditor.tsx    Propiedades de una grada
    ├── ExteriorEditor.tsx Fachada, cubierta, iluminación, marcador, decoración (acordeón)
    ├── EnvironmentPanel.tsx Herramientas del entorno
    ├── DialogHost.tsx     Modales y biblioteca
    ├── dialog.ts          Diálogos basados en promesas
    ├── flows.ts           Guardar, cargar, exportar, importar, PNG, nuevo
    ├── Slider.tsx, Toggle.tsx
public/
├── manifest.webmanifest   Manifiesto PWA
├── sw.js                  Service Worker (red primero)
└── icon.svg
```

## Decisiones importantes

- **Ejes**: el campo mide 105 m en X y 68 m en Z. Las gradas se miden desde la línea de banda o de fondo.
- **Identificadores estables**: los módulos conservan sus identificadores aunque cambien sus nombres visibles. Los archivos guardados dependen de ellos.
- **Estado**: un único store con `useSyncExternalStore`. La escena se reconstruye por partes, solo cuando cambia su clave.
- **Sin luces por farola**: las luces reales están limitadas a 8 focos y 8 fanales por rendimiento en móviles.
- **Cámara**: ortográfica, con rotación de 90° y zoom entre 0,25× y 3×.

## Pendiente

- **Orillas de agua**: el usuario menciona tiles adjuntas de referencia que no han llegado. Por ahora las orillas son irregulares y generadas.

- **Confirmar arena y petróleo**: son estimaciones de la referencia de color. Ver `DESIGN_SYSTEM.md`.
- **Esquinas con tribunas de distinta altura**: si un vecino tiene menos niveles, la esquina se une a su nivel más alto (puede quedar un escalón).

## Historial relevante

- 0.13: entorno con cuadrícula.
- 0.15: diseño Liquid Glass y acento verde.
- 0.16: PNG, miniaturas, nombres aleatorios, parque por defecto, glorietas, semáforos y tipos de edificio.
- 0.17: sombras, día/noche, farolas, halos y ventanas iluminadas.
- 0.18: curvatura intermedia y ancho de cubierta.
- 0.19: extensión interior de cubierta, celosía, esquinas por niveles.
- 0.20: focos de noche como luz real y dirigidos al campo; corrección de desplazamiento en esquinas.
- 0.21: fachadas uniformes, fanales de marquesina, más intensidad de luz, aparcamientos.
- 0.22: paleta arena/petróleo/coral, selector de 12 colores, vista cenital.
- 0.23: agua, avenidas, selector de vía, glorietas de 8 vías, aparcamiento 3 × 3, torres de oficinas, marcador de marquesina, torres de decoración en esquinas.
