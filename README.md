# Football Stadium Builder

Constructor visual de estadios de fútbol en estética pixel art isométrica. Es una aplicación web progresiva (PWA) que funciona en escritorio, tablet y móvil, y puede instalarse y usarse sin conexión tras la primera carga.

**Versión actual:** 0.13.0

## Características

- **Campo fijo** de 105 × 68 m con líneas, áreas, círculo central, porterías y franjas de césped.
- **8 módulos** seleccionables: laterales, fondos y cuatro esquinas curvas (cuartos de circunferencia).
- **Gradas independientes** con altura, inclinación real (la pendiente se calcula geométricamente), desplazamiento, color, pilares y barandilla.
- **Apilado de tribunas**: las gradas superiores se elevan sobre la altura de las inferiores, sostenidas por pilares.
- **Copiar gradas** a otro módulo o a todos a la vez.
- **Exteriores por módulo**:
  - Fachadas: hormigón, cristal, ladrillo, ventanas corridas y paneles verticales.
  - Cubiertas: marquesina plana, voladizo inclinado y cubierta curva.
  - Iluminación: torres de focos o barra en cubierta.
  - Marcador clásico o pantalla LED.
- **Muros de unión** automáticos entre fachadas vecinas que no coinciden.
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
│   └── modules.ts         Geometría: gradas, pilares, fachadas, cubiertas, focos, muros de unión
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
- Los muros de unión son cajas rectas, así que en uniones muy oblicuas pueden verse angulares.
- Las cubiertas y la iluminación se calculan por módulo, sin coordinarse con los módulos vecinos.

## Licencia

Pendiente de definir.
