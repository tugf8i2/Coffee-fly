from sqlalchemy.orm import Session, joinedload

from app.models.usuario_models import Usuario
from app.schemas.usuario_schemas import (
    UsuarioCreate,
    UsuarioUpdate
)


class UsuarioRepository:

    def __init__(self, db: Session):
        self.db = db


    def get_usuario(
        self,
        id_usuario: int
    ) -> Usuario | None:

        return (
            self.db.query(Usuario)
            .options(joinedload(Usuario.conductor))
            .filter(
                Usuario.id_usuario == id_usuario,
                Usuario.eliminado_en.is_(None),
            )
            .first()
        )


    def get_usuarios(
        self,
        skip: int = 0,
        limit: int = 100
    ) -> list[Usuario]:

        return (
            self.db.query(Usuario)
            .options(joinedload(Usuario.conductor))
            .filter(Usuario.eliminado_en.is_(None))
            .offset(skip)
            .limit(limit)
            .all()
        )


    def get_usuario_by_correo(
        self,
        correo_usuario: str
    ) -> Usuario | None:

        return (
            self.db.query(Usuario)
            .options(joinedload(Usuario.conductor))
            .filter(
                Usuario.correo_usuario.ilike(correo_usuario.strip()),
                Usuario.eliminado_en.is_(None),
            )
            .first()
        )


    def create_usuario(self, usuario: Usuario):

        self.db.add(usuario)
        self.db.commit()
        self.db.refresh(usuario)

        return usuario


    def update_usuario(
        self,
        id_usuario: int,
        usuario: Usuario
    ) -> Usuario | None:

        db_usuario = self.get_usuario(
            id_usuario
        )

        if db_usuario is None:
            return None


        self.db.commit()

        self.db.refresh(
            db_usuario
        )

        return db_usuario
