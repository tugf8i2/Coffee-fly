from sqlalchemy.orm import Session

from app.models.usuario_models import Usuario
from app.models.auth_session_models import AuthSession
from app.models.conductor_models import Conductor
from app.models.vehiculo_models import Vehiculo
from app.models.solicitud_models import Solicitud
from app.models.historial_eventos_models import HistorialEvento
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
            .filter(
                Usuario.id_usuario == id_usuario
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
            .filter(
                Usuario.correo_usuario.ilike(correo_usuario.strip())
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


    def delete_usuario(
        self,
        id_usuario: int
    ) -> Usuario | None:

        db_usuario = self.get_usuario(
            id_usuario
        )

        if db_usuario is None:
            return None


        # Las sesiones y el perfil de conductor dependen de Usuario. Se
        # eliminan en la misma transacción para no dejar registros huérfanos
        # ni provocar un error de llave foránea al borrar una cuenta válida.
        try:
            self.db.query(AuthSession).filter(AuthSession.user_id == id_usuario).delete(
                synchronize_session=False
            )
            self.db.query(Solicitud).filter(Solicitud.caficultor_id == id_usuario).update(
                {Solicitud.caficultor_id: None}, synchronize_session=False
            )
            self.db.query(HistorialEvento).filter(HistorialEvento.usuario_id_cambio == id_usuario).delete(
                synchronize_session=False
            )
            conductor = self.db.query(Conductor).filter(Conductor.usuario_id == id_usuario).first()
            if conductor:
                self.db.query(Vehiculo).filter(Vehiculo.conductor_id == conductor.id_conductor).update(
                    {Vehiculo.conductor_id: None}, synchronize_session=False
                )
                self.db.query(HistorialEvento).filter(HistorialEvento.conductor_id == conductor.id_conductor).update(
                    {HistorialEvento.conductor_id: None}, synchronize_session=False
                )
                self.db.delete(conductor)
            self.db.delete(db_usuario)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

        return db_usuario
