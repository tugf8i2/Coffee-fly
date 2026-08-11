from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.repositories.usuario_repositories import UsuarioRepository
from app.schemas.usuario_schemas import UsuarioCreate, UsuarioUpdate
from app.core.security import hash_password

from app.models.usuario_models import Usuario


class UsuarioService:

    def __init__(self, db: Session):
        self.repository = UsuarioRepository(db)

    # -------------------------
    # LISTAR
    # -------------------------
    def obtener_usuarios(self, skip: int = 0, limit: int = 100):
        return self.repository.get_usuarios(skip, limit)

    # -------------------------
    # OBTENER UNO
    # -------------------------
    def obtener_usuario(self, id_usuario: int):
        usuario = self.repository.get_usuario(id_usuario)

        if not usuario:
            raise HTTPException(
                status_code=404,
                detail="Usuario no encontrado"
            )

        return usuario

    # -------------------------
    # CREAR USUARIO
    # -------------------------
    def crear_usuario(self, usuario: UsuarioCreate):

        existe = self.repository.get_usuario_by_correo(
            usuario.correo_usuario
        )

        if existe:
            raise HTTPException(
                status_code=400,
                detail="El correo ya existe"
            )

        datos = usuario.model_dump()

        # 🔥 FIX: eliminar campos que NO existen en la tabla
        datos.pop("departamento", None)
        datos.pop("municipio", None)
        datos.pop("vereda", None)

        password = datos.get("contrasena")

        if not password:
            raise HTTPException(
                status_code=400,
                detail="La contraseña es obligatoria"
            )

        datos["contrasena"] = hash_password(password)

        nuevo_usuario = Usuario(**datos)

        return self.repository.create_usuario(nuevo_usuario)

    # -------------------------
    # ACTUALIZAR
    # -------------------------
    def actualizar_usuario(self, id_usuario: int, usuario: UsuarioUpdate):

        db_usuario = self.repository.get_usuario(id_usuario)

        if not db_usuario:
            raise HTTPException(
                status_code=404,
                detail="Usuario no encontrado"
            )

        datos = usuario.model_dump(exclude_unset=True)

        if "correo_usuario" in datos:
            existe = self.repository.get_usuario_by_correo(
                datos["correo_usuario"]
            )

            if existe and existe.id_usuario != id_usuario:
                raise HTTPException(
                    status_code=400,
                    detail="Correo ya registrado"
                )

        if "contrasena" in datos:
            datos["contrasena"] = hash_password(datos["contrasena"])

        for key, value in datos.items():
            setattr(db_usuario, key, value)

        return self.repository.update_usuario(id_usuario, db_usuario)

    # -------------------------
    # DELETE
    # -------------------------
    def eliminar_usuario(self, id_usuario: int):

        eliminado = self.repository.delete_usuario(id_usuario)

        if not eliminado:
            raise HTTPException(
                status_code=404,
                detail="Usuario no encontrado"
            )

        return {"mensaje": "Usuario eliminado"}