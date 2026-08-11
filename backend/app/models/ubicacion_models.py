import uuid
from sqlalchemy import Column, String, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base

class Ubicacion(Base):
    __tablename__ = "ubicacion"
    __table_args__ = {"schema": "public"}

    id_ubicacion = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,   
        nullable=False
    )


    x = Column(Numeric(9, 6))
    y = Column(Numeric(9, 6))

    departamento = Column(String(50), nullable=False)
    ciudad = Column(String(50), nullable=False)
    direccion = Column(Text, nullable=False)






    