DROP SCHEMA public CASCADE;
CREATE SCHEMA public;


CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

-- =========================
-- ROL
-- =========================
CREATE TABLE public.rol (
    id_rol SERIAL PRIMARY KEY,
    descripcion_rol character varying(200)
);

-- =========================
-- USUARIO
-- =========================
CREATE TABLE public.usuario (
    id_usuario SERIAL PRIMARY KEY,

    nombre_usuario character varying(30) NOT NULL,
    apellido character varying(30) NOT NULL,
    correo_usuario character varying(30) NOT NULL,
    telefono_usuario character(10) NOT NULL,
    contrasena character varying(255),
    habilitado boolean NOT NULL DEFAULT true,
    intentos_fallidos integer NOT NULL DEFAULT 0,
    bloqueado_hasta timestamp with time zone,

    departamento character varying(100),
    municipio character varying(100),
    vereda character varying(100),

    rol_id integer,

    CONSTRAINT fk_usuario_rol FOREIGN KEY (rol_id)
        REFERENCES public.rol (id_rol),

    CONSTRAINT uq_usuario_correo UNIQUE (correo_usuario),
    CONSTRAINT chk_contrasena_longitud CHECK (length(contrasena) >= 8)
);

-- =========================
-- CONDUCTOR
-- =========================
CREATE TABLE public.conductor (
    id_conductor SERIAL PRIMARY KEY,

    licencia character varying(20) NOT NULL,
    foto_licencia text NOT NULL,

    usuario_id integer,

    CONSTRAINT fk_conductor_usuario FOREIGN KEY (usuario_id)
        REFERENCES public.usuario (id_usuario),

    CONSTRAINT conductor_usuario_unique UNIQUE (usuario_id)
);

-- =========================
-- UBICACION (UUID)
-- =========================
CREATE TABLE public.ubicacion (
    id_ubicacion uuid DEFAULT public.uuid_generate_v4() PRIMARY KEY,

    x numeric(9,6),
    y numeric(9,6),

    departamento character varying(50) NOT NULL,
    ciudad character varying(50) NOT NULL,
    direccion text NOT NULL
);

-- =========================
-- COOPERATIVA
-- =========================
CREATE TABLE public.cooperativa (
    id_cooperativa SERIAL PRIMARY KEY,

    nombre character varying(50) NOT NULL,
    telefono character(10) NOT NULL,
    correo character varying(50) NOT NULL,

    ubicacion_id uuid NOT NULL,

    CONSTRAINT fk_cooperativa_ubicacion FOREIGN KEY (ubicacion_id)
        REFERENCES public.ubicacion (id_ubicacion)
);

-- =========================
-- RUTA
-- =========================
CREATE TABLE public.ruta (
    id_ruta SERIAL PRIMARY KEY,

    nombre_ruta character varying(100) NOT NULL,
    descripcion_recorrido text,
    distancia_estimada numeric(5,2),
    tiempo_estimado_horas numeric(4,2),

    cooperativa_id integer,

    CONSTRAINT fk_ruta_cooperativa FOREIGN KEY (cooperativa_id)
        REFERENCES public.cooperativa (id_cooperativa)
);

-- =========================
-- VEHICULO
-- =========================
CREATE TABLE public.vehiculo (
    id_vehiculo SERIAL PRIMARY KEY,

    placa character varying(7) NOT NULL,
    tipo_vehiculo character varying(30) NOT NULL,
    modelo character varying(50),
    capacidad_kg real NOT NULL,
    estado_vehiculo character varying(20),

    conductor_id integer,

    CONSTRAINT fk_vehiculo_conductor FOREIGN KEY (conductor_id)
        REFERENCES public.conductor (id_conductor),

    CONSTRAINT chk_capacidad_positiva CHECK (capacidad_kg > 0),

    CONSTRAINT chk_estados_vehiculo CHECK (
        estado_vehiculo IN ('disponible', 'en camino', 'en mantenimiento')
    )
);

-- =========================
-- CARGA (UUID)
-- =========================
CREATE TABLE public.carga (
    id_carga uuid DEFAULT public.uuid_generate_v4() PRIMARY KEY,

    peso_kg numeric(8,2),
    descripcion character varying(100),

    vehiculo_id integer,
    cooperativa_id integer,
    ruta_id integer,
    caficultor_id integer,

    estado_sincronizacion character varying(20) DEFAULT 'pendiente' NOT NULL,
    actualizado_en timestamp DEFAULT current_timestamp,

    CONSTRAINT fk_carga_vehiculo FOREIGN KEY (vehiculo_id)
        REFERENCES public.vehiculo (id_vehiculo),

    CONSTRAINT fk_carga_cooperativa FOREIGN KEY (cooperativa_id)
        REFERENCES public.cooperativa (id_cooperativa),

    CONSTRAINT fk_carga_ruta FOREIGN KEY (ruta_id)
        REFERENCES public.ruta (id_ruta),

    CONSTRAINT fk_carga_caficultor FOREIGN KEY (caficultor_id)
        REFERENCES public.usuario (id_usuario),

    CONSTRAINT chk_peso_positivo CHECK (peso_kg > 0)
);

-- =========================
-- SOLICITUD (UUID)
-- =========================
CREATE TABLE public.solicitud (
    id_solicitud uuid DEFAULT public.uuid_generate_v4() PRIMARY KEY,

    estado_solicitud character varying(20) NOT NULL,
    fecha_hora_solicitud timestamp NOT NULL,

    caficultor_id integer,
    carga_id uuid,
    client_request_id uuid,

    estado_sincronizacion character varying(20) DEFAULT 'pendiente' NOT NULL,

    CONSTRAINT chk_estados_permitidos CHECK (
        estado_solicitud IN ('pendiente', 'en camino', 'entregado', 'cancelado')
    ),

    CONSTRAINT fk_solicitud_caficultor FOREIGN KEY (caficultor_id)
        REFERENCES public.usuario (id_usuario),

    CONSTRAINT fk_solicitud_carga FOREIGN KEY (carga_id)
        REFERENCES public.carga (id_carga)
);
CREATE UNIQUE INDEX ux_solicitud_client_request_id
    ON public.solicitud (client_request_id) WHERE client_request_id IS NOT NULL;

-- ENTREGA DE CAFÉ (RF-04 / RF-05)
CREATE TABLE public.entrega (
    id_entrega uuid DEFAULT public.uuid_generate_v4() PRIMARY KEY,
    solicitud_id uuid NOT NULL REFERENCES public.solicitud (id_solicitud),
    caficultor_id integer NOT NULL REFERENCES public.usuario (id_usuario),
    cantidad_kg numeric(8,2) NOT NULL CHECK (cantidad_kg > 0),
    fecha_hora_entrega timestamp NOT NULL,
    observaciones character varying(500),
    estado_entrega character varying(20) NOT NULL DEFAULT 'pendiente',
    actualizado_en timestamp,
    distancia_recorrida_m double precision NOT NULL DEFAULT 0,
    CONSTRAINT uq_entrega_solicitud_id UNIQUE (solicitud_id),
    CONSTRAINT chk_entrega_distancia_recorrida CHECK (distancia_recorrida_m >= 0),
    CONSTRAINT chk_estados_entrega CHECK (
        estado_entrega IN ('pendiente', 'en camino', 'entregado', 'cancelado')
    )
);

-- Historial persistente de cada asignación de entrega, vehículo y conductor.
CREATE TABLE public.historial_asignacion (
    id_asignacion uuid DEFAULT public.uuid_generate_v4() PRIMARY KEY,
    entrega_id uuid NOT NULL REFERENCES public.entrega (id_entrega),
    carga_id uuid NOT NULL REFERENCES public.carga (id_carga),
    vehiculo_id integer NOT NULL REFERENCES public.vehiculo (id_vehiculo),
    conductor_id integer NOT NULL REFERENCES public.conductor (id_conductor),
    coordinador_id integer NOT NULL REFERENCES public.usuario (id_usuario),
    fecha_hora_asignacion timestamp NOT NULL DEFAULT current_timestamp
);

-- Trazabilidad de los cambios de estado de una entrega (RF-05).
-- El usuario se obtiene de la sesión autenticada y no del cliente.
CREATE TABLE public.historial_estado_entrega (
    id_historial uuid DEFAULT public.uuid_generate_v4() PRIMARY KEY,
    entrega_id uuid NOT NULL REFERENCES public.entrega (id_entrega) ON DELETE CASCADE,
    estado_anterior character varying(20) NOT NULL,
    estado_nuevo character varying(20) NOT NULL,
    usuario_id integer NOT NULL REFERENCES public.usuario (id_usuario),
    fecha_hora_cambio timestamp NOT NULL DEFAULT current_timestamp,
    CONSTRAINT chk_historial_estado_anterior CHECK (
        estado_anterior IN ('pendiente', 'en camino', 'entregado', 'cancelado')
    ),
    CONSTRAINT chk_historial_estado_nuevo CHECK (
        estado_nuevo IN ('pendiente', 'en camino', 'entregado', 'cancelado')
    )
);

-- Sesiones JWT revocables. Solo se almacena el identificador jti, nunca el JWT completo.
CREATE TABLE public.auth_session (
    token character varying(64) PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.usuario (id_usuario),
    expires_at timestamp with time zone NOT NULL
);
CREATE INDEX ix_auth_session_user_id ON public.auth_session (user_id);

-- Puntos GPS reales capturados por el dispositivo y vinculados a una entrega.
CREATE TABLE public.seguimiento_ubicacion (
    id_ubicacion uuid DEFAULT public.uuid_generate_v4() PRIMARY KEY,
    client_point_id uuid,
    entrega_id uuid NOT NULL REFERENCES public.entrega (id_entrega),
    vehiculo_id integer NOT NULL REFERENCES public.vehiculo (id_vehiculo),
    latitud numeric(9,6) NOT NULL,
    longitud numeric(9,6) NOT NULL,
    precision_m double precision,
    velocidad_m_s double precision,
    rumbo_grados double precision,
    registrada_en timestamp NOT NULL,
    recibida_en timestamp,
    CONSTRAINT chk_seguimiento_coordenadas CHECK (
        latitud BETWEEN -90 AND 90 AND longitud BETWEEN -180 AND 180
    ),
    CONSTRAINT chk_seguimiento_precision CHECK (precision_m IS NULL OR precision_m >= 0),
    CONSTRAINT chk_seguimiento_velocidad CHECK (velocidad_m_s IS NULL OR velocidad_m_s >= 0),
    CONSTRAINT chk_seguimiento_rumbo CHECK (rumbo_grados IS NULL OR rumbo_grados BETWEEN 0 AND 360)
);
CREATE UNIQUE INDEX ux_seguimiento_client_point_id
    ON public.seguimiento_ubicacion (client_point_id) WHERE client_point_id IS NOT NULL;
CREATE INDEX ix_seguimiento_entrega_fecha
    ON public.seguimiento_ubicacion (entrega_id, registrada_en);
CREATE INDEX ix_seguimiento_vehiculo_id
    ON public.seguimiento_ubicacion (vehiculo_id);

-- =========================
-- HISTORIAL DE EVENTOS (UUID)
-- =========================
CREATE TABLE public.historial_de_eventos (
    id_evento uuid DEFAULT public.uuid_generate_v4() PRIMARY KEY,

    carga_id uuid NOT NULL,
    entrega_id uuid,
    tipo_evento character varying(30) NOT NULL,
    descripcion_evento character varying(300) NOT NULL,

    fecha_hora_evento timestamp NOT NULL,
    fecha_hora_sincronizacion timestamp NOT NULL,
    expira_en timestamp NOT NULL,

    ubicacion_id uuid,
    conductor_id integer,
    usuario_id_cambio integer NOT NULL,

    CONSTRAINT fk_historial_ubicacion FOREIGN KEY (ubicacion_id)
        REFERENCES public.ubicacion (id_ubicacion),

    CONSTRAINT fk_historial_carga FOREIGN KEY (carga_id)
        REFERENCES public.carga (id_carga),

    CONSTRAINT fk_historial_entrega FOREIGN KEY (entrega_id)
        REFERENCES public.entrega (id_entrega),

    CONSTRAINT fk_historial_conductor FOREIGN KEY (conductor_id)
        REFERENCES public.conductor (id_conductor),

    CONSTRAINT fk_historial_usuario_cambio FOREIGN KEY (usuario_id_cambio)
        REFERENCES public.usuario (id_usuario)
);
CREATE INDEX ix_historial_eventos_entrega_fecha
    ON public.historial_de_eventos (entrega_id, fecha_hora_evento);
CREATE INDEX ix_historial_eventos_tipo
    ON public.historial_de_eventos (tipo_evento);
CREATE INDEX ix_historial_eventos_expira
    ON public.historial_de_eventos (expira_en);

-- =========================
-- INSERT ROLES
-- =========================
INSERT INTO public.rol (descripcion_rol) VALUES
('coordinador'),
('conductor'),
('registrador'),
('caficultor');

-- =========================
-- SELECT (JOIN EJEMPLO)
-- =========================
SELECT 
rol.descripcion_rol AS perfil, 
u_caficultor.nombre_usuario AS nombre_productor,
u_caficultor.vereda AS vereda,
u_caficultor.municipio AS municipio,
solicitud.id_solicitud AS carga,
solicitud.estado_solicitud AS estado,
ruta.nombre_ruta AS ruta_asignada,
carga.id_carga AS viaje,
carga.peso_kg AS kilogramos_totales,
vehiculo.placa AS placa_transporte
FROM public.solicitud
INNER JOIN public.usuario u_caficultor 
    ON solicitud.caficultor_id = u_caficultor.id_usuario
INNER JOIN public.rol 
    ON u_caficultor.rol_id = rol.id_rol
LEFT JOIN public.carga 
    ON solicitud.carga_id = carga.id_carga
LEFT JOIN public.ruta 
    ON carga.ruta_id = ruta.id_ruta
LEFT JOIN public.vehiculo 
    ON carga.vehiculo_id = vehiculo.id_vehiculo;
