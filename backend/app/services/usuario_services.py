from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.repositories.usuario_repositories import UsuarioRepository
from app.schemas.usuario_schemas import UsuarioCreate, UsuarioUpdate
from app.core.security import hash_password
from app.models.usuario_models import Usuario
from app.models.conductor_models import Conductor
from app.core.time import utc_now_naive
from app.services.compatibilidad_transporte import LICENCIAS_PERMITIDAS, hoy_colombia
from app.services.auditoria_operativa import registrar_auditoria


class UsuarioService:
    def __init__(self, db: Session):
        self.repository = UsuarioRepository(db)

    def obtener_usuarios(self, skip: int = 0, limit: int = 100):
        return [self._con_perfil(usuario) for usuario in self.repository.get_usuarios(skip, limit)]

    def obtener_usuario(self, id_usuario: int):
        usuario = self.obtener_usuario_modelo(id_usuario)
        return self._con_perfil(usuario)

    def obtener_usuario_modelo(self, id_usuario: int):
        usuario = self.repository.get_usuario(id_usuario)
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        return usuario

    def obtener_usuario_por_correo(self, correo: str):
        usuario = self.repository.get_usuario_by_correo(correo.strip().lower())
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        return self._con_perfil(usuario)

    @staticmethod
    def _con_perfil(usuario: Usuario):
        """Expone los datos del perfil de conductor junto al usuario para el formulario."""
        conductor = usuario.conductor
        usuario.licencia = conductor.licencia if conductor else None
        usuario.tiene_foto_licencia = bool(conductor and conductor.foto_licencia)
        usuario.numero_licencia = conductor.numero_licencia if conductor else None
        usuario.fecha_expedicion_licencia = conductor.fecha_expedicion_licencia if conductor else None
        usuario.fecha_vencimiento_licencia = conductor.fecha_vencimiento_licencia if conductor else None
        usuario.estado_conductor = conductor.estado_conductor if conductor else None
        usuario.estado_licencia = conductor.estado_licencia if conductor else None
        usuario.cooperativa_id_conductor = conductor.cooperativa_id if conductor else None
        return usuario

    def crear_usuario(self, usuario: UsuarioCreate, actor_id: int | None = None):
        if self.repository.get_usuario_by_correo(usuario.correo_usuario):
            raise HTTPException(status_code=400, detail="El correo ya existe")

        datos = usuario.model_dump()
        licencia = datos.pop("licencia", None)
        foto_licencia = datos.pop("foto_licencia", None)
        foto_perfil = datos.pop("foto_perfil", None)
        numero_licencia = datos.pop("numero_licencia", None)
        fecha_expedicion = datos.pop("fecha_expedicion_licencia", None)
        fecha_vencimiento = datos.pop("fecha_vencimiento_licencia", None)
        cooperativa_id = datos.pop("cooperativa_id_conductor", None)
        if datos.get("rol_id") == 2 and (not licencia or not foto_licencia or not numero_licencia or not fecha_vencimiento):
            raise HTTPException(status_code=400, detail="Categoría, número, foto y vencimiento de licencia son obligatorios para el conductor")
        if datos.get("rol_id") == 2:
            self._validar_licencia(licencia, foto_licencia)
            self._validar_foto_perfil(foto_perfil)
            self._validar_fechas_licencia(fecha_expedicion, fecha_vencimiento)
        if datos.get("rol_id") == 4 and not all(
            str(datos.get(campo) or "").strip()
            for campo in ("departamento", "municipio", "vereda")
        ):
            raise HTTPException(status_code=400, detail="Departamento, municipio y vereda son obligatorios para un caficultor")
        password = datos.get("contrasena")
        if not password:
            raise HTTPException(status_code=400, detail="La contrasena es obligatoria")
        datos["contrasena"] = hash_password(password)
        db_usuario = Usuario(**datos)
        if db_usuario.rol_id == 2:
            db_usuario.foto_perfil = foto_perfil
        db = self.repository.db
        try:
            db.add(db_usuario)
            db.flush()
            if db_usuario.rol_id == 2:
                db.add(Conductor(
                    licencia=licencia.strip(),
                    foto_licencia=foto_licencia,
                    usuario_id=db_usuario.id_usuario,
                    numero_licencia=numero_licencia.strip(), fecha_expedicion_licencia=fecha_expedicion,
                    fecha_vencimiento_licencia=fecha_vencimiento, estado_conductor="disponible",
                    cooperativa_id=cooperativa_id, actualizado_en=utc_now_naive(),
                ))
                registrar_auditoria(db, "conductor", db_usuario.id_usuario, "crear", actor_id,
                                    despues={"categoria": licencia.strip(), "numero_licencia": numero_licencia.strip(),
                                             "fecha_vencimiento": fecha_vencimiento.isoformat()})
            db.commit()
            db.refresh(db_usuario)
        except Exception:
            db.rollback()
            raise
        return self._con_perfil(db_usuario)

    def actualizar_usuario(self, id_usuario: int, usuario: UsuarioUpdate, actor_id: int | None = None):
        db_usuario = self.repository.get_usuario(id_usuario)
        if not db_usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        datos = usuario.model_dump(exclude_unset=True)
        licencia = datos.pop("licencia", None)
        foto_licencia = datos.pop("foto_licencia", None)
        foto_perfil = datos.pop("foto_perfil", None)
        numero_licencia = datos.pop("numero_licencia", None)
        fecha_expedicion = datos.pop("fecha_expedicion_licencia", None)
        fecha_vencimiento = datos.pop("fecha_vencimiento_licencia", None)
        cooperativa_id = datos.pop("cooperativa_id_conductor", None)
        if "correo_usuario" in datos:
            existe = self.repository.get_usuario_by_correo(datos["correo_usuario"])
            if existe and existe.id_usuario != id_usuario:
                raise HTTPException(status_code=400, detail="Correo ya registrado")
        if "contrasena" in datos:
            datos["contrasena"] = hash_password(datos["contrasena"])
        for key, value in datos.items():
            setattr(db_usuario, key, value)

        es_conductor = db_usuario.rol_id == 2
        if foto_perfil is not None:
            if not es_conductor:
                raise HTTPException(status_code=400, detail="La foto de perfil solo corresponde a conductores")
            self._validar_foto_perfil(foto_perfil)
            db_usuario.foto_perfil = foto_perfil
        perfil = db_usuario.conductor
        if db_usuario.rol_id == 4 and not all(
            str(getattr(db_usuario, campo) or "").strip()
            for campo in ("departamento", "municipio", "vereda")
        ):
            raise HTTPException(status_code=400, detail="Departamento, municipio y vereda son obligatorios para un caficultor")
        if es_conductor and perfil is None and (not licencia or not foto_licencia or not numero_licencia or not fecha_vencimiento):
            raise HTTPException(status_code=400, detail="Categoría, número, foto y vencimiento son obligatorios para un conductor")
        if es_conductor and (licencia is not None or foto_licencia is not None or numero_licencia is not None or fecha_expedicion is not None or fecha_vencimiento is not None or cooperativa_id is not None):
            licencia_final = licencia.strip() if licencia is not None else (perfil.licencia if perfil else "")
            foto_final = foto_licencia if foto_licencia is not None else (perfil.foto_licencia if perfil else None)
            numero_final = numero_licencia if numero_licencia is not None else (perfil.numero_licencia if perfil else None)
            vencimiento_final = fecha_vencimiento if fecha_vencimiento is not None else (perfil.fecha_vencimiento_licencia if perfil else None)
            expedicion_final = fecha_expedicion if fecha_expedicion is not None else (perfil.fecha_expedicion_licencia if perfil else None)
            if not licencia_final or not foto_final:
                raise HTTPException(status_code=400, detail="El tipo y la foto de la licencia son obligatorios para un conductor")
            self._validar_licencia(licencia_final, foto_final)
            self._validar_fechas_licencia(expedicion_final, vencimiento_final)
            if perfil is None:
                perfil = Conductor(licencia=licencia_final, foto_licencia=foto_final,
                                  numero_licencia=numero_final, fecha_expedicion_licencia=expedicion_final,
                                  fecha_vencimiento_licencia=vencimiento_final, estado_conductor="disponible",
                                  cooperativa_id=cooperativa_id, usuario_id=db_usuario.id_usuario)
                self.repository.db.add(perfil)
            else:
                antes = {"categoria": perfil.licencia, "numero_licencia": perfil.numero_licencia,
                         "fecha_vencimiento": perfil.fecha_vencimiento_licencia.isoformat() if perfil.fecha_vencimiento_licencia else None}
                perfil.licencia = licencia_final
                perfil.foto_licencia = foto_final
                perfil.numero_licencia = numero_final
                perfil.fecha_expedicion_licencia = expedicion_final
                perfil.fecha_vencimiento_licencia = vencimiento_final
                if cooperativa_id is not None:
                    perfil.cooperativa_id = cooperativa_id
                perfil.actualizado_en = utc_now_naive()
                registrar_auditoria(self.repository.db, "conductor", perfil.id_conductor, "actualizar", actor_id,
                                    antes, {"categoria": perfil.licencia, "numero_licencia": perfil.numero_licencia,
                                            "fecha_vencimiento": perfil.fecha_vencimiento_licencia.isoformat() if perfil.fecha_vencimiento_licencia else None})

        try:
            self.repository.db.commit()
            self.repository.db.refresh(db_usuario)
        except Exception:
            self.repository.db.rollback()
            raise
        return self._con_perfil(db_usuario)

    def actualizar_ubicacion_finca(self, caficultor_id: int, latitud: float, longitud: float, direccion: str | None):
        usuario = self.repository.get_usuario(caficultor_id)
        if not usuario:
            raise HTTPException(status_code=404, detail="Caficultor no encontrado")
        usuario.latitud_finca = latitud
        usuario.longitud_finca = longitud
        if direccion is not None:
            usuario.direccion_finca = direccion.strip()
        usuario.ubicacion_finca_actualizada_en = utc_now_naive()
        try:
            self.repository.db.commit()
            self.repository.db.refresh(usuario)
        except Exception:
            self.repository.db.rollback()
            raise
        return {
            "latitud": usuario.latitud_finca,
            "longitud": usuario.longitud_finca,
            "direccion": usuario.direccion_finca,
            "actualizada_en": usuario.ubicacion_finca_actualizada_en,
        }

    @staticmethod
    def _validar_licencia(licencia: str | None, foto_licencia: str | None):
        if licencia is not None and licencia.strip().upper() not in LICENCIAS_PERMITIDAS:
            raise HTTPException(status_code=400, detail="Selecciona una categoría de licencia válida")
        if foto_licencia is not None:
            if not foto_licencia.startswith("data:image/"):
                raise HTTPException(status_code=400, detail="La foto de la licencia debe ser una imagen válida")
            if len(foto_licencia) > 4_000_000:
                raise HTTPException(status_code=400, detail="La foto de la licencia no puede superar 3 MB")

    @staticmethod
    def _validar_foto_perfil(foto: str | None):
        if foto is None:
            return
        if not foto.startswith(("data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,")):
            raise HTTPException(status_code=400, detail="La foto de perfil debe ser PNG, JPG o WebP")
        if len(foto) > 1_500_000:
            raise HTTPException(status_code=400, detail="La foto de perfil no puede superar 1 MB")

    @staticmethod
    def _validar_fechas_licencia(expedicion, vencimiento):
        if vencimiento is None or vencimiento < hoy_colombia():
            raise HTTPException(status_code=400, detail="La licencia debe tener una fecha de vencimiento vigente")
        if expedicion and expedicion > vencimiento:
            raise HTTPException(status_code=400, detail="La expedición no puede ser posterior al vencimiento")

    def eliminar_usuario(self, id_usuario: int, registrador_id: int):
        if id_usuario == registrador_id:
            raise HTTPException(
                status_code=400,
                detail="No puedes eliminar tu propia cuenta de Registrador",
            )
        if not self.repository.get_usuario(id_usuario):
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        self.repository.delete_usuario(id_usuario)
        return {"mensaje": "Usuario eliminado"}
