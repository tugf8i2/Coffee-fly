from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.repositories.usuario_repositories import UsuarioRepository
from app.schemas.usuario_schemas import UsuarioCreate, UsuarioUpdate
from app.core.security import hash_password
from app.models.usuario_models import Usuario
from app.models.conductor_models import Conductor
from app.services.login_services import remove_account_state


class UsuarioService:
    def __init__(self, db: Session):
        self.repository = UsuarioRepository(db)

    def obtener_usuarios(self, skip: int = 0, limit: int = 100):
        return [self._con_perfil(usuario) for usuario in self.repository.get_usuarios(skip, limit)]

    def obtener_usuario(self, id_usuario: int):
        usuario = self.repository.get_usuario(id_usuario)
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        return self._con_perfil(usuario)

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
        return usuario

    def crear_usuario(self, usuario: UsuarioCreate):
        if self.repository.get_usuario_by_correo(usuario.correo_usuario):
            raise HTTPException(status_code=400, detail="El correo ya existe")

        datos = usuario.model_dump()
        licencia = datos.pop("licencia", None)
        foto_licencia = datos.pop("foto_licencia", None)
        if datos.get("rol_id") == 2 and (not licencia or not foto_licencia):
            raise HTTPException(status_code=400, detail="El tipo y la foto de la licencia son obligatorios para un conductor")
        if datos.get("rol_id") == 2:
            self._validar_licencia(licencia, foto_licencia)
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
        db = self.repository.db
        try:
            db.add(db_usuario)
            db.flush()
            if db_usuario.rol_id == 2:
                db.add(Conductor(
                    licencia=licencia.strip(),
                    foto_licencia=foto_licencia,
                    usuario_id=db_usuario.id_usuario,
                ))
            db.commit()
            db.refresh(db_usuario)
        except Exception:
            db.rollback()
            raise
        return self._con_perfil(db_usuario)

    def actualizar_usuario(self, id_usuario: int, usuario: UsuarioUpdate):
        db_usuario = self.repository.get_usuario(id_usuario)
        if not db_usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        datos = usuario.model_dump(exclude_unset=True)
        licencia = datos.pop("licencia", None)
        foto_licencia = datos.pop("foto_licencia", None)
        if "correo_usuario" in datos:
            existe = self.repository.get_usuario_by_correo(datos["correo_usuario"])
            if existe and existe.id_usuario != id_usuario:
                raise HTTPException(status_code=400, detail="Correo ya registrado")
        if "contrasena" in datos:
            datos["contrasena"] = hash_password(datos["contrasena"])
        for key, value in datos.items():
            setattr(db_usuario, key, value)

        es_conductor = db_usuario.rol_id == 2
        perfil = db_usuario.conductor
        if db_usuario.rol_id == 4 and not all(
            str(getattr(db_usuario, campo) or "").strip()
            for campo in ("departamento", "municipio", "vereda")
        ):
            raise HTTPException(status_code=400, detail="Departamento, municipio y vereda son obligatorios para un caficultor")
        if es_conductor and perfil is None and (not licencia or not foto_licencia):
            raise HTTPException(status_code=400, detail="El tipo y la foto de la licencia son obligatorios para un conductor")
        if es_conductor and (licencia is not None or foto_licencia is not None):
            licencia_final = licencia.strip() if licencia is not None else (perfil.licencia if perfil else "")
            foto_final = foto_licencia if foto_licencia is not None else (perfil.foto_licencia if perfil else None)
            if not licencia_final or not foto_final:
                raise HTTPException(status_code=400, detail="El tipo y la foto de la licencia son obligatorios para un conductor")
            self._validar_licencia(licencia_final, foto_final)
            if perfil is None:
                perfil = Conductor(licencia=licencia_final, foto_licencia=foto_final, usuario_id=db_usuario.id_usuario)
                self.repository.db.add(perfil)
            else:
                perfil.licencia = licencia_final
                perfil.foto_licencia = foto_final

        try:
            self.repository.db.commit()
            self.repository.db.refresh(db_usuario)
        except Exception:
            self.repository.db.rollback()
            raise
        return self._con_perfil(db_usuario)

    @staticmethod
    def _validar_licencia(licencia: str | None, foto_licencia: str | None):
        if licencia is not None and licencia.strip().upper() not in {"B2", "B3", "C1", "C2", "C3"}:
            raise HTTPException(status_code=400, detail="Selecciona un tipo de licencia válido: B2, B3, C1, C2 o C3")
        if foto_licencia is not None:
            if not foto_licencia.startswith("data:image/"):
                raise HTTPException(status_code=400, detail="La foto de la licencia debe ser una imagen válida")
            if len(foto_licencia) > 4_000_000:
                raise HTTPException(status_code=400, detail="La foto de la licencia no puede superar 3 MB")

    def eliminar_usuario(self, id_usuario: int, registrador_id: int):
        if id_usuario == registrador_id:
            raise HTTPException(
                status_code=400,
                detail="No puedes eliminar tu propia cuenta de Registrador",
            )
        if not self.repository.get_usuario(id_usuario):
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        self.repository.delete_usuario(id_usuario)
        remove_account_state(id_usuario)
        return {"mensaje": "Usuario eliminado"}
