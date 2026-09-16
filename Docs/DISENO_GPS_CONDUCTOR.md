# GPS del conductor: referencia de navegación

La pantalla de navegación incorpora la referencia entregada: cabecera crema con marca y lema manuscrito, estado del viaje, mapa amplio, indicación verde del próximo giro y maniobra siguiente, ruta azul con borde blanco, flecha del conductor, marcador rojo del destino, orientación, zoom, voz, reporte, centrado y resumen de tiempo, llegada y distancia. El panel lateral muestra la parada actual, carga, lista de paradas, offline, novedades, contacto y confirmación. En celular, el panel pasa debajo del mapa; no se duplican cabeceras ni pestañas durante la navegación.

La imagen sirve como referencia visual y como fuente de las ilustraciones de marca. No se utiliza como mapa ni como interfaz estática. No se recibieron CSS ni archivos de la tipografía original; se reutilizan las fuentes locales del panel del conductor. No se reproducen marco de tablet, batería ni hora ficticia del sistema.

## Datos y acciones

- Geometría, nombres de vías, maniobras y estimaciones proceden de la ruta del viaje; no se fijan los valores ilustrativos de la imagen. La llegada estimada no incluye tráfico en vivo.
- Se conserva una única suscripción GPS. La web aprovecha la lectura local reciente para reducir el retraso del marcador, conservando la publicación de posiciones y las validaciones existentes. La guía web exige precisión de hasta 25 m y antigüedad de hasta 90 segundos. Esto no aumenta la precisión física del dispositivo.
- Recogida y entrega son acciones diferentes. La recogida web se habilita únicamente con ubicación reciente y precisa dentro del radio de la finca. Ambas acciones vuelven a solicitar una lectura GPS actual y se validan con los servicios existentes; llegar no finaliza automáticamente el viaje.
- La lista incluye las recogidas del viaje y la cooperativa final. Elegir una carga pendiente conserva el flujo de seguimiento existente.
- Voz: silenciar/activar y repetir; se comunica la ausencia de una voz española instalada. El botón del estado abre información GPS/voz y el cambio día/noche.
- Offline abre las capacidades reales del panel existente; no anuncia descargas cartográficas inexistentes.
- Contacto llama solo si el seguimiento contiene un teléfono del coordinador. Si falta, abre los mensajes existentes e informa que no hay teléfono.

## Archivos principales

`VistaGpsConductor.jsx` contiene la presentación compartida. `MapaGpsConductor.web.jsx` y `.native.jsx` conectan los controles del mapa. `usarGuiaGps.web.js` integra progreso e indicaciones por voz con las posiciones existentes. `presentacionGps.js` reúne formatos y guardas. Las pantallas `SeguimientoVehiculo` conservan los servicios, permisos y confirmaciones. Los componentes `MapaAbierto` admiten controles y grosor de ruta específicos sin cambiar los valores predeterminados de otros roles.

## Verificación y ejecución

Desde `frontend`: `npm test -- --runInBand`, `npx expo export --platform web --output-dir dist` y `npx expo export --platform android --output-dir dist-android-check`.

La revisión visual automatizada usa usuarios, viajes y posiciones GPS simuladas de prueba aislados, geometría real de Valhalla y calles de OpenFreeMap. Incluye tablet/celular, ausencia de desbordamiento, controles, activación/silenciado de voz (sin voz española instalada en el navegador de prueba), día/noche, paradas, mensajes y confirmación de recogida. Las regresiones revisan las nueve vistas del conductor y las nueve del coordinador.

Actualizar únicamente la web local: `docker compose -f docker-compose.yml -f docker-compose.valhalla.yml up -d --no-deps --build frontend`. Abrir `http://localhost:8080`, actualizar con Ctrl+F5 y entrar como conductor en Ruta → Iniciar navegación.

Android requiere recompilar e instalar la aplicación para recibir estos cambios. La exportación verifica el empaquetado, no sustituye pruebas de GPS, voz, cámara y seguimiento en un teléfono físico. Mapas descargados y recálculo offline siguen sujetos a las capacidades documentadas del proyecto.
