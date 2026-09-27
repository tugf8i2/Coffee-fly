# Guía para modificar el diseño de Coffee Fly

Esta guía explica cómo cambiar colores, textos, imágenes, menús, tarjetas y la
apariencia general de Coffee Fly, cómo probar los cambios y cómo publicarlos.

## 1. Cómo funciona la web y la APK

La APK instalada abre la aplicación publicada en:

`https://coffee-fly.hostless.app`

Por eso, los cambios hechos en la interfaz web se reflejan tanto en la página
como en la APK sin tener que compilar ni instalar otra APK. El proceso normal es:

1. Modificar los archivos dentro de `frontend/src`.
2. Probar el cambio en el computador.
3. Ejecutar las pruebas y la compilación de verificación.
4. Guardar el cambio en Git y enviarlo a la rama `master` de GitHub.
5. Esperar a que Hostless termine el despliegue automático.
6. Cerrar y volver a abrir Coffee Fly en el teléfono.

### Cambios que no requieren una APK nueva

- Colores de fondos, botones, textos y bordes.
- Tamaños de letra, espacios, tarjetas y formularios.
- Posición y apariencia de los menús.
- Textos, títulos, etiquetas y mensajes.
- Imágenes utilizadas dentro de la página.
- Diseño adaptable para celular, tableta y computador.
- Pantallas de registrador, coordinador, conductor y caficultor.

### Cambios que sí requieren una APK nueva

- Icono que aparece en el menú de aplicaciones de Android.
- Pantalla de inicio o `splash` mostrada antes de cargar la web.
- Nombre, identificador o versión de la aplicación Android.
- Permisos de cámara, ubicación, almacenamiento o segundo plano.
- Barra de estado de Android, pantalla completa o comportamiento del WebView.
- Cualquier cambio en `frontend/app.json` o
  `frontend/src/aplicacion/EntradaAplicacion.native.jsx`.

## 2. Preparar el proyecto

Abrir PowerShell y entrar en el repositorio:

```powershell
cd "<ruta-al-proyecto>\Coffee-fly"
git pull --ff-only origin master
cd frontend
npm ci
```

`npm ci` instala exactamente las dependencias registradas en el proyecto. Solo
es necesario repetirlo cuando cambien `package.json` o `package-lock.json`, o al
preparar otro computador.

## 3. Ejecutar Coffee Fly localmente

Desde la carpeta `frontend`:

```powershell
npm run web
```

Expo mostrará la dirección local, normalmente `http://localhost:8081`. Abrirla
en el navegador. Mientras el proceso siga activo, la mayoría de los cambios se
actualizarán automáticamente al guardar el archivo.

Para detener el servidor local, usar `Ctrl + C` en la terminal.

> La prueba local puede usar la API publicada, según las variables de entorno
> disponibles. No cambiar credenciales ni secretos para una modificación visual.

## 4. Dónde modificar cada parte del diseño

### Paleta general y estilos compartidos

- `frontend/src/estilos/secciones/estructura.js`: estructura de páginas,
  contenedores y distribución general.
- `frontend/src/estilos/secciones/formularios.js`: campos, etiquetas y botones.
- `frontend/src/estilos/secciones/tarjetas.js`: tarjetas y superficies.
- `frontend/src/estilos/secciones/operacion.js`: estados y elementos operativos.
- `frontend/src/estilos/temaGlobal.js`: colores aplicados en modo oscuro.
- `frontend/src/estilos/crearEstilosModulo.js`: combina los estilos compartidos.

### Inicio de sesión

- Componente: `frontend/src/modulos/autenticacion/IniciarSesion.jsx`
- Colores, medidas y posiciones:
  `frontend/src/modulos/autenticacion/IniciarSesion.styles.js`
- Imagen del paisaje: `frontend/src/assets/brand/coffee-landscape.jpg`
- Logotipo: `frontend/src/assets/brand/login-logo.png`

En `IniciarSesion.styles.js` se encuentran, por ejemplo:

- `loginPage` y `loginPanel`: fondos principales.
- `loginCard`: tarjeta blanca del formulario.
- `loginTitle`: título “Inicia sesión”.
- `loginInputShell`: borde y fondo de los campos.
- `loginButton`: color, tamaño y forma del botón principal.
- `loginMottoText`: frase sobre la imagen.

### Cabecera, logotipo y menús para celular

- Marca y comportamiento adaptable:
  `frontend/src/componentes/comunes/MarcaCafe.css`
- Componente de la marca:
  `frontend/src/componentes/comunes/MarcaCafe.web.jsx`
- Menú lateral y menú de cuenta compartidos por los roles:
  `frontend/src/modulos/panel/MarcoOperativo.web.jsx`
- Estilos del marco:
  `frontend/src/modulos/panel/MarcoOperativo.css`

Las reglas `@media(max-width:850px)` y `@media(max-width:560px)` controlan el
diseño para teléfonos. Después de cambiar una de esas reglas, comprobar también
la vista de computador para no alterar accidentalmente el escritorio.

### Panel del registrador

- Contenido y opciones del menú:
  `frontend/src/modulos/panel/PanelRegistrador.web.jsx`
- Colores, tarjetas, métricas y distribución:
  `frontend/src/modulos/panel/PanelRegistrador.css`
- Tema oscuro y controles:
  `frontend/src/modulos/panel/TemaOscuro.css`

El color verde principal del registrador está definido al comienzo de
`PanelRegistrador.css`:

```css
.registrar-app {
  --reg-green: #064c3b;
  --reg-ink: #0b2639;
  --reg-border: #e0e7e9;
}
```

Cambiar estas variables permite actualizar gran parte de la paleta sin editar
cada botón por separado.

### Panel del coordinador

- Componente: `frontend/src/modulos/coordinador/CoordinadorLayout.web.jsx`
- Diseño: `frontend/src/modulos/coordinador/PanelCoordinador.css`
- Estilos de módulos internos:
  `frontend/src/modulos/coordinador/Coordinador.styles.js`

### Panel del conductor

- Componente principal: `frontend/src/modulos/conductor/ConductorLayout.jsx`
- Estilos: `frontend/src/modulos/conductor/Conductor.styles.js`
- Diseño documentado: `Docs/DISENO_CONDUCTOR.md`
- Diseño de navegación: `Docs/DISENO_GPS_CONDUCTOR.md`

### Panel del caficultor

- Estructura: `frontend/src/modulos/caficultor/CaficultorLayout.web.jsx`
- Cada pantalla posee su archivo `.styles.js`, por ejemplo
  `MiActividad.styles.js`, `SolicitarRecoleccion.styles.js` y
  `UbicacionFinca.styles.js`.

### Imágenes e identidad visual

Los recursos visuales están en `frontend/src/assets/brand`.

Cuando se reemplace una imagen:

1. Conservar el mismo nombre del archivo si no se desea modificar el código.
2. Mantener una proporción parecida para evitar recortes inesperados.
3. Optimizar el peso de la imagen antes de subirla.
4. Revisar el resultado tanto en celular como en computador.

No editar archivos generados dentro de `frontend/dist` o
`frontend/dist-android-check`. Esas carpetas se vuelven a crear en cada
compilación y no son la fuente del diseño.

## 5. Ejemplo: cambiar el color principal

Supongamos que se quiere cambiar el verde `#064c3b` por `#075e48`.

1. Abrir `frontend/src/modulos/panel/PanelRegistrador.css`.
2. Cambiar `--reg-green: #064c3b;` por `--reg-green: #075e48;`.
3. Buscar colores verdes escritos directamente en el mismo archivo y decidir
   si también deben actualizarse.
4. Abrir `frontend/src/modulos/autenticacion/IniciarSesion.styles.js` y revisar
   `loginButton`, `loginTitle` y `loginBrandName` si se desea que el inicio de
   sesión utilice el mismo tono.
5. Revisar el modo oscuro en `frontend/src/estilos/temaGlobal.js` y
   `frontend/src/modulos/panel/TemaOscuro.css`.
6. Guardar y revisar la actualización en el navegador local.

Se debe mantener suficiente contraste: texto blanco sobre fondos oscuros y
texto oscuro sobre superficies claras.

## 6. Verificar antes de publicar

Desde `frontend` ejecutar:

```powershell
npm test -- --runInBand
npm run export:web
npx expo export --platform android --output-dir dist-android-check
```

Los tres comandos deben terminar sin errores. Después revisar manualmente:

1. Inicio de sesión.
2. Cabecera superior.
3. Menú hamburguesa.
4. Menú de cuenta.
5. Formularios y botones.
6. Vista estrecha de celular.
7. Vista ancha de computador.
8. Modo oscuro, si el panel lo ofrece.

También es recomendable revisar los cambios que se van a enviar:

```powershell
cd ..
git status --short
git diff --check
git diff
```

No incluir contraseñas, tokens, archivos `.env`, bases de datos ni claves de
servicios en el commit.

## 7. Publicar el cambio en Hostless

Cuando las pruebas hayan pasado:

```powershell
git add frontend/src
git commit -m "style: actualizar diseño de Coffee Fly"
git push origin master
```

Si también se modificaron imágenes u otro archivo visual fuera de
`frontend/src`, agregar solamente esos archivos de manera explícita. Evitar
`git add .` para no subir archivos temporales por accidente.

Hostless detectará el nuevo commit, construirá la imagen Docker y publicará el
resultado. Durante ese tiempo la aplicación puede mostrar el estado `Updating`.
Esperar a que cambie a `Running`.

Comprobar el servicio desde PowerShell:

```powershell
Invoke-RestMethod https://coffee-fly.hostless.app/health/ready
```

La respuesta debe indicar que la aplicación y la base de datos están listas.
Luego abrir:

`https://coffee-fly.hostless.app`

Finalmente, cerrar por completo la APK y volver a abrirla. La misma versión web
se cargará en el teléfono sin instalar una APK nueva.

## 8. Si el cambio no aparece en la APK

Seguir este orden:

1. Confirmar que el cambio sí aparece en la web pública.
2. Verificar que Hostless esté en estado `Running`.
3. Cerrar Coffee Fly desde aplicaciones recientes y abrirlo de nuevo.
4. Comprobar que el teléfono tenga internet.
5. Si continúa mostrando una versión anterior, borrar únicamente la caché de
   Coffee Fly desde los ajustes de Android. No borrar los datos salvo que sea
   necesario volver a iniciar sesión.

## 9. Generar una APK nueva cuando el cambio sea nativo

Solo usar este proceso para los cambios nativos enumerados en la sección 1.

Desde `frontend`:

```powershell
npx eas-cli build --platform android --profile preview
```

El proceso utiliza la configuración de `frontend/eas.json`. Al terminar,
entrega un enlace para descargar el archivo `.apk`. Instalarlo sobre la versión
anterior permite conservar los datos siempre que se mantengan el paquete
`com.coffeefly.mobile` y las mismas credenciales de firma.

Después de modificar `frontend/app.json` también se debe ejecutar primero:

```powershell
npx expo config --type public
npx expo export --platform android --output-dir dist-android-check
```

## 10. Deshacer un cambio visual con seguridad

Antes de publicarlo, se puede restaurar manualmente el archivo usando el editor.
Si el cambio ya fue publicado, crear un commit que revierta únicamente el commit
problemático:

```powershell
git log --oneline -10
git revert <identificador-del-commit>
git push origin master
```

No usar `git reset --hard` en un proyecto con trabajo que no esté respaldado.

## Resumen rápido

Para un cambio normal de diseño:

```powershell
cd "<ruta-al-proyecto>\Coffee-fly"
git pull --ff-only origin master
cd frontend
npm run web
# Editar y revisar el diseño.
npm test -- --runInBand
npm run export:web
cd ..
git add frontend/src
git commit -m "style: actualizar diseño de Coffee Fly"
git push origin master
```

Después se espera a que Hostless indique `Running`, se verifica la web y se
vuelve a abrir la APK. Para esos cambios visuales no se genera otra APK.
