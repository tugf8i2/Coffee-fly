# Cumbre Cafetera - Proyecto Bootcamp

## 1️⃣ ¿Qué Problema Resuelve?

La empresa cafetera **"Cumbre Cafetera"** opera en zonas de difícil acceso donde las vías son mayoritariamente caminos de herradura o trochas terciarias. Esto eleva drásticamente los costos de transporte, genera dependencia de vehículos informales y provoca retrasos críticos que afectan la calidad del grano y el cumplimiento con los centros de acopio. Actualmente, la operación logística es manual y carece de trazabilidad digital.

Este sistema es una **plataforma web de gestión logística integral** que optimiza el flujo del café desde las zonas de producción hasta los centros de acopio. Conecta a productores con transportistas mediante planificación de rutas, control de costos en tiempo real y monitoreo del estado de carga, garantizando la eficiencia operativa y la calidad del grano.

Es importante porque sin esta herramienta, los fletes informales encarecen el café frente a la competencia, el grano puede perder calidad por retrasos en la recolección, y la ausencia de datos reales genera fugas de capital e incumplimiento de contratos. La digitalización de este proceso es clave para la supervivencia y escalabilidad del negocio cafetero.

---

## 2️⃣ Usuarios Principales

1. **Administrador Logístico**: Gestiona la flota de vehículos y conductores, crea y supervisa rutas, genera reportes de costos operativos (combustible, flete, mantenimiento) y tiene control total sobre el sistema.

2. **Operador Logístico**: Coordina la asignación de rutas y transportistas, actualiza el estado de las cargas y consulta reportes de sus rutas asignadas.

3. **Conductor**: Accede al sistema desde su dispositivo móvil para consultar las rutas asignadas y actualizar el estado de la carga en tiempo real (en tránsito, entregada, pendiente).

4. **Centro de Acopio / Cliente Final**: Consulta el estado y la trazabilidad de las entregas para planificar la recepción del grano y mantener el control de la cadena de suministro.

---

## 3️⃣ Funcionalidades Principales

- [ ] Autenticación de usuarios por rol (administrador, operador, conductor) con recuperación de contraseña
- [ ] Registro, edición y consulta de vehículos y conductores (flota)
- [ ] Creación y gestión de rutas de transporte con origen, destino y paradas intermedias
- [ ] Monitoreo del estado de carga en tiempo real con trazabilidad completa (timestamp por cada cambio)
- [ ] Control y registro de costos operativos por viaje (combustible, flete, mantenimiento)
- [ ] Generación y exportación de reportes de costos filtrados por ruta, vehículo o conductor (PDF / Excel)
- [ ] Interfaz responsiva accesible desde móvil, tableta y escritorio

---

## 4️⃣ Decisiones Iniciales

### Metodología de Desarrollo

**Elegí**: Scrum

**¿Por qué?**: El entorno logístico de "Cumbre Cafetera" es dinámico: las rutas cambian, la disponibilidad de conductores varía y los requerimientos evolucionan. Scrum permite desarrollar el sistema por módulos (flota, rutas, costos) en Sprints de 2 a 4 semanas, entregando funcionalidades de forma incremental y obteniendo retroalimentación temprana del cliente para reducir errores y retrabajos.

### Arquitectura Inicial

**Elegí**: N-Capas

**¿Por qué?**: Separar el sistema en capas (presentación, lógica de negocio y datos) permite que el equipo trabaje en paralelo sobre cada parte sin interferirse. Además, facilita el mantenimiento futuro del módulo logístico y permite escalar el sistema para cubrir más fincas o rutas sin reescribir todo desde cero.

### Tecnologías

- **Backend**: Python con Flask (porque tiene una sintaxis sencilla y clara, es ideal para construir APIs REST ligeras y escalables, y permite un desarrollo ágil adaptado al tamaño de nuestro equipo)
- **Base de datos**: PostgreSQL (porque es gratuita, robusta y soporta bien las relaciones entre flotas, rutas y costos)
- **Frontend**: React (porque tiene mucha documentación, permite construir interfaces responsivas y el equipo tiene experiencia previa)

---

**Autores**: Jhonatan David Prieto González, Brandon Cristofer Poveda Romero, Cristian Ronaldo Hernández Ducuara, Nicolás Ramírez Rincón  
**Fecha**: Marzo 2026  
**Bootcamp**: Arquitectura de Software - SENA  
**Ficha**: 3407179
