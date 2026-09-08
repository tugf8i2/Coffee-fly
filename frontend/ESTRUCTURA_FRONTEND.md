# Estructura del front-end

El front-end está organizado por responsabilidad y por módulo funcional. Las
pantallas y componentes que renderizan React usan la extensión `.jsx`; los
servicios, configuraciones, cálculos y demás lógica sin interfaz usan `.js`.

```text
frontend/
├── App.js                         Entrada compatible con Expo
├── index.js                       Registro y arranque de la aplicación
├── assets/                        Imágenes y recursos estáticos
├── __tests__/                     Pruebas automatizadas
└── src/
    ├── aplicacion/                Composición general de la aplicación
    ├── componentes/
    │   ├── comunes/               Campos, encabezado, avisos y control de errores
    │   ├── entregas/              Componentes reutilizables de entregas
    │   └── mapas/                 Mapas y selectores por plataforma
    ├── configuracion/             API, navegación y disponibilidad de mapas
    ├── estilos/
    │   ├── secciones/             Estilos React Native separados por finalidad
    │   ├── colores.js             Paleta de colores compartida
    │   ├── global.native.js       Entrada de estilos globales para móvil
    │   ├── global.web.js          Entrada de estilos globales para web
    │   ├── index.js               Unión de estilos React Native
    │   └── web.css                CSS exclusivo del navegador
    ├── ganchos/                   Ganchos reutilizables de React
    ├── modulos/
    │   ├── autenticacion/         Inicio y restauración de sesión
    │   ├── caficultor/            Actividad, finca y solicitudes
    │   ├── cooperativas/          Registro y administración de cooperativas
    │   ├── entregas/              Recolecciones, asignaciones e historiales
    │   ├── panel/                 Menús y paneles según el rol
    │   ├── reportes/              Informes del sistema
    │   ├── seguimiento/           GPS, trayectos y monitoreo
    │   ├── usuarios/              Registro y administración de usuarios
    │   └── vehiculos/             Vehículos, estados y asignaciones
    ├── servicios/                 Persistencia, sincronización y reglas de negocio
    └── utilidades/                Funciones de cálculo sin interfaz
```

## Convenciones

- Use nombres de archivo en español y en `PascalCase` para componentes, por
  ejemplo `GestionUsuarios.jsx`.
- Use nombres descriptivos en `camelCase` para servicios y utilidades, por
  ejemplo `politicaContrasena.js`.
- Coloque una pantalla dentro del módulo al que pertenece; no agregue pantallas
  directamente en la raíz de `src`.
- Mantenga los estilos compartidos en `src/estilos/secciones`. El CSS de web
  debe permanecer en `src/estilos/web.css`.
- Para diferencias entre móvil y navegador use los sufijos `.native` y `.web`.
  React Native selecciona automáticamente el archivo apropiado.
- Evite mezclar llamadas a la API o persistencia con componentes visuales; esa
  lógica debe vivir en `configuracion` o `servicios`.

## Puntos principales

- `src/aplicacion/AplicacionPrincipal.jsx` controla sesión, navegación y estado
  global de conectividad.
- `src/configuracion/ClienteApi.js` centraliza la comunicación con FastAPI.
- `src/servicios/sinConexion.native.js` y `sinConexion.web.js` administran la
  operación sin red y la sincronización posterior.
- `src/estilos/index.js` reúne los estilos de React Native sin volver a mezclar
  las secciones en un único archivo grande.
