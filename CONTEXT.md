# CONTEXT.md — Contexto del proyecto Piixell

## Qué es

Piixell es un **constructor de estadios de fútbol** en pixel art isométrico, en forma de aplicación web progresiva (PWA). Funciona en escritorio, tablet y móvil, se puede instalar y usar sin conexión.

El usuario construye un estadio por módulos (laterales, fondos y esquinas), con gradas, cubiertas y exteriores, y diseña el entorno urbano alrededor (carreteras, parques, edificios).

## Estado actual

Versión **0.30.1**. Funcionalidades:

- **Estadio**: 8 módulos (`north`, `ne`, `east`, `se`, `south`, `sw`, `west`, `nw`). `north`/`south` son laterales (105 m), `west`/`east` son fondos (68 m), las esquinas son curvas de Bézier.
- **Gradas**: altura, inclinación, desplazamiento, curvatura (recta o curva), barandilla, color. Se apilan por niveles. Pasillos pintados cada 20 m, centrados (color propio por grada); salidas como agujeros oscuros sobre el tablero, repartidas a lo largo de cada pasillo (una cada 10 m de altura a partir de 12 m) y con marco de pasillo alrededor. Aforo aproximado mostrado en el editor (0,5 m por asiento).
- **Fachada por grada** (con barandilla, en el mismo apartado): sin fachada (tableta de 0,5 m), pilares exteriores, lisa, paneles verticales o horizontales. Profundidad de 0 a 40 m desde el borde trasero. Tipo «Pisos»: tableros horizontales cada 5 m; cada tablero empieza donde la grada tiene ese nivel y avanza hacia fuera. Selector en barra de iconos.
- **Exteriores por módulo**: cubierta (voladizo con inclinación de −20° a 20°, curva), iluminación (torres de focos o barra), marcador, decoración exterior (pilares que siguen el borde exterior, torres, arcos) y sobre cubierta, torres de escaleras circulares. Cada apartado puede aplicarse a todos los módulos por separado.
- **Entorno**: cuadrícula de 400 × 400 m, celdas de 20 m. Parque por defecto. Herramientas: vía (carretera, avenida o camino), árboles, edificio (casa, edificio u oficinas en torre), agua y borrar. Vías unidas con curvas, cruces, aceras, líneas, coches y semáforos. Glorietas: anillo de 8 vías alrededor de una celda central libre. Aparcamiento: cualquier bloque de 2 × 2 vías o más. Agua con orillas irregulares y arena.
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
- 0.24: fachada por grada, pilares interiores o exteriores, voladizo con inclinación real, focos repartidos en esquinas, escaleras zigzag y torres circulares.
- 0.36.0: vista exterior libre (arrastrar con ratón o dedo gira la cámara alrededor del estadio); las flechas y los botones de giro la recolocan en isométrica; el marcador de marquesina se apoya en la cara inferior de la cubierta.
- 0.35.0: el campo recibe sombras de las gradas; en la vista interior se camina con las flechas (dentro del campo, 12 m/s).
- 0.34.0: vista interior desde el centro del campo a 1,7 m de altura; arrastrar gira la mirada y el zoom cambia el campo de visión.
- 0.33.0: salidas por pasillo según la altura (1 hasta 12 m, 2 desde 12 m, 3 desde 22 m, y así cada 10 m), repartidas y centradas a lo largo del pasillo.
- 0.32.5: salidas y pasillos cada 20 m, centrados a lo largo de la grada y a media altura.
- 0.32.4: pilares exteriores sobre el marco de la grada más alejada de cada módulo; los tableros comprueban su cara superior para no atravesar la grada.
- 0.32.3: pilares exteriores repartidos por longitud de arco (siguen las esquinas); fachadas y pisos 0,5 m más bajos para no atravesar el tablero.
- 0.32.2: las fachadas lisas y de paneles rellenan la zona bajo la grada; los pisos arrancan desde el nivel de la grada.
- 0.32.1: pisos desde la base del tablero; salidas más grandes con marco de pasillo.
- 0.32.0: color de pasillos por grada, desplazamiento de hasta 80 m, fachada de pisos cada 5 m, salidas como agujeros sobre el tablero.
- 0.31.1: pilares decorativos pegados al borde exterior; pasillos pintados sobre la grada en lugar de cortarla; salidas como huecos en la fachada maciza.
- 0.31.0: pasillos y salidas automáticos, aforo aproximado, color como botón de color completo con paleta por familias, curvatura y fachada como controles de barra, fachada y barandilla unidas, sin marquesina plana ni escaleras en zigzag, pilares decorativos que siguen el borde exterior.
- 0.30.1: sin pilares en las gradas; curvatura reducida a recta y curva; pilares decorativos exteriores con extremos en las esquinas y distancia común del anillo.
- 0.30.0: radio único de 8 px, sombras tras los elementos, separación de 8 px, formularios uniformes, casillas cuadradas, selector día/noche legible, sin borde naranja en seleccionados, datos secundarios legibles sobre el acento.
- 0.27.0: diseño Fluent (superficies planas al 80 %, desenfoque, brillo de 1 px, sin degradados), paleta nueva (acento #16697A, textos #1D2729, fondos #EDE7E3, detalle #FFA62B), logo nuevo en cabecera e icono, pantalla de carga móvil con el acento de fondo.
- 0.26.1: parking para cualquier bloque 2×2; esquinas con desplazamiento positivo sin deformación (los extremos se desplazan, no la curva entera).
- 0.26: cruces con paso de peatones y línea de detención, transición de anchura entre vías distintas, reglas de aparcamiento corregidas, marcador de marquesina como tira LED de 1 m.
- 0.25: fachada desde la base de la grada con grosor de 0,5 a 40 m; tablero hueco de 0,5 m; marcador de marquesina LED; torres de escaleras huecas; escaleras sobre la fachada; agua con orillas suaves según las celdas vecinas; celda bajo el ratón resaltada; selector de color plegable.
- 0.23: agua, avenidas, selector de vía, glorietas de 8 vías, aparcamiento 3 × 3, torres de oficinas, marcador de marquesina, torres de decoración en esquinas.
