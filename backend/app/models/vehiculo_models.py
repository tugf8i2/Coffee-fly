from sqlalchemy import Column, Date, DateTime, Float, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Vehiculo(Base):
    __tablename__ = "vehiculo"
    id_vehiculo = Column(Integer, primary_key=True)
    placa = Column(String(7), nullable=False)
    tipo_vehiculo = Column(String(30), nullable=False)
    modelo = Column(String(50), nullable=True)
    capacidad_kg = Column(Float, nullable=False)
    estado_vehiculo = Column(String(20))
    marca = Column(String(60), nullable=True)
    modelo_comercial = Column(String(60), nullable=True)
    color = Column(String(40), nullable=True)
    clase_vehiculo = Column(String(40), nullable=True)
    tipo_servicio = Column(String(12), nullable=True)
    configuracion = Column(String(12), ForeignKey("configuracion_vehicular.codigo"), nullable=True)
    numero_ejes = Column(Integer, nullable=True)
    tipo_carroceria = Column(String(60), nullable=True)
    tara_kg = Column(Float, nullable=True)
    pbv_homologado_kg = Column(Float, nullable=True)
    soat_vencimiento = Column(Date, nullable=True)
    tecnomecanica_vencimiento = Column(Date, nullable=True)
    seguro_vencimiento = Column(Date, nullable=True)
    cooperativa_id = Column(Integer, ForeignKey("cooperativa.id_cooperativa"), nullable=True)
    creado_en = Column(DateTime, nullable=True)
    actualizado_en = Column(DateTime, nullable=True)
    creado_por = Column(Integer, ForeignKey("usuario.id_usuario"), nullable=True)
    actualizado_por = Column(Integer, ForeignKey("usuario.id_usuario"), nullable=True)

    conductor_id = Column(Integer, ForeignKey("conductor.id_conductor"))

    conductor = relationship("Conductor", back_populates="vehiculos")

    configuracion_catalogo = relationship("ConfiguracionVehicular")
    cargas = relationship("Carga", back_populates="vehiculo")

    @property
    def pbv_maximo_legal_kg(self):
        return self.configuracion_catalogo.pbv_maximo_legal_kg if self.configuracion_catalogo else None

    @property
    def licencia_minima_requerida(self):
        catalogo = self.configuracion_catalogo
        if not catalogo:
            return None
        return catalogo.licencia_publico if self.tipo_servicio == "PUBLICO" else catalogo.licencia_particular if self.tipo_servicio == "PARTICULAR" else None

    @property
    def documentacion_completa(self):
        return all((self.tara_kg, self.pbv_homologado_kg, self.tipo_servicio, self.configuracion,
                    self.soat_vencimiento, self.tecnomecanica_vencimiento, self.seguro_vencimiento))
