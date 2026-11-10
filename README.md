# Piixell

Constructor visual de estadios de fútbol en estética pixel art isométrica. Es una aplicación web progresiva (PWA) que funciona en escritorio, tablet y móvil, y puede instalarse y usarse sin conexión tras la primera carga.

**Versión actual:** 0.33.0

## Reglas de la red viaria

- **Cruce:** vía con 3 o 4 vías vecinas (T o X). Lleva paso de peatones y línea de detención en cada brazo. Nunca es aparcamiento.
- **Aparcamiento:** cualquier bloque de 2 × 2 vías o más.
- **Glorieta:** anillo de 8 vías alrededor de una celda libre.
- **Vía:** el resto. Si dos vías tienen anchura distinta, el brazo se ensancha con transición suave.

## Características

- **Campo fijo** de 105 × 68 m con líneas, áreas, círculo central, porterías y franjas de césped.
- **8 módulos** seleccionables: laterales, fondos y cuatro esquinas curvas (cuartos de circunferencia).
- **Gradas independientes** con altura, inclinación real (la pendiente se calcula geométricamente), desplazamiento, curvatura, color y barandilla.
- **Pasillos y salidas** automáticos: un pasillo pintado cada 20 m en cada grada, centrado a lo largo de la grada; las salidas son agujeros oscuros sobre el tablero, repartidos a lo largo del pasillo: 1 hasta 12 m de altura y una más cada 10 m. Color de pasillos editable por grada.
- **Aforo aproximado** del estadio, calculado con 0,5 m por asiento y las filas de cada grada.
- **Apilado de tribunas**: las gradas superiores se elevan sobre la altura de las inferiores.
- **Copiar gradas** a otro módulo o a todos a la vez.
- **Fachada por grada**: la fachada sigue el perfil escalonado, con la altura de su grada y una profundidad de 0 a 40 m.
  - Tipos: sin fachada (tablero hueco de 0,5 m), pilares exteriores, lisa, paneles verticales o paneles horizontales.
- **Exteriores por módulo**:
  - Cubiertas: voladizo con inclinación de −20° a 20° y cubierta curva.
  - Torres de escaleras huecas (0 a 3).
  - Iluminación: torres de focos o barra en cubierta.
  - Marcador clásico o pantalla LED.
- **Cámara ortográfica** isométrica con rotación de 90° en 90°.
- **Guardado y carga**:
  - Biblioteca local en el navegador.
  - Exportar e importar archivos `.json`.
- **Diálogos modales** propios para confirmaciones y avisos.

## Requisitos

- Node.js 18 o superior
- npm

## Instalación y uso

```bash
npm install
npm run dev       # servidor de desarrollo
npm run build     # comprobación de tipos y build de producción en dist/
npm run preview   # sirve la build de producción (necesario para probar el Service Worker)
```

## Estructura del proyecto

```
src/
├── config.ts              Versión, dimensiones del campo y límites de los controles
├── types.ts               Tipos del dominio: gradas, exteriores, opciones
├── store.ts               Estado global, acciones y persistencia local
├── persistence.ts         Formato de archivo, validación, biblioteca y descarga
├── geometry/
│   └── modules.ts         Geometría: gradas, pilares, fachadas, cubiertas, focos, escaleras, torres
├── three/
│   ├── StadiumView.tsx    Escena Three.js, cámara, selección y rotación
│   └── pitch.ts           Construcción del campo
└── ui/
    ├── App.tsx            Barra superior y disposición general
    ├── EditorPanel.tsx    Panel de edición (módulos, gradas, exteriores)
    ├── StandEditor.tsx    Propiedades de una grada
    ├── ExteriorEditor.tsx Fachada, cubierta, iluminación y marcador
    ├── DialogHost.tsx     Modales
    ├── dialog.ts          Sistema de diálogos basado en promesas
    ├── flows.ts           Flujos de guardar, cargar, exportar, importar y reiniciar
    ├── Slider.tsx         Control deslizante reutilizable
    └── Toggle.tsx         Conmutador reutilizable
public/
├── manifest.webmanifest   Manifiesto de la PWA
├── sw.js                  Service Worker (caché sin conexión)
└── icon.svg               Icono de la aplicación
```

## Formato de archivo de estadio

Los estadios exportados son JSON con esta forma:

```json
{
  "format": "football-stadium-builder",
  "formatVersion": 1,
  "name": "Mi estadio",
  "savedAt": "2026-11-08T10:00:00.000Z",
  "stands": [],
  "exteriors": {}
}
```

Al importar, el archivo se valida y los valores fuera de rango se ajustan a los límites permitidos.

## Tecnologías

- React 18 y TypeScript
- Vite
- Three.js (cámara ortográfica)
- CSS con estética glass
- PWA: manifiesto y Service Worker

## Limitaciones conocidas

- La biblioteca de estadios guardados usa `localStorage`, con capacidad limitada. Para estadios grandes o copias de seguridad, conviene exportar a archivo.
- Las esquinas curvas estiran las texturas de ladrillo y ventanas a lo largo del arco.
- Las fachadas de gradas vecinas no se unen automáticamente en las esquinas: cada grada tiene su propia profundidad.
- Las torres circulares y las escaleras pueden solaparse si se colocan en la misma zona del módulo.
- Las cubiertas y la iluminación se calculan por módulo, sin coordinarse con los módulos vecinos.

## Documentación para agentes

- `AGENTS.md`: instrucciones, versionado y flujo de trabajo.
- `CONTEXT.md`: qué es el proyecto, arquitectura y decisiones.
- `DESIGN_SYSTEM.md`: estilo visual, colores y componentes.

## Licencia

Pendiente de definir.
