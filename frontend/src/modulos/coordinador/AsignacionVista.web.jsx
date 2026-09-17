import { useState } from 'react';
import Icon from '../panel/IconoRegistrador.web';

export default function AsignacionVista({
  deliveries,
  vehicles,
  drivers,
  cooperatives,
  selectedDeliveries,
  selectedVehicle,
  selectedDriver,
  selectedCooperative,
  setSelectedDeliveries,
  setSelectedVehicle,
  setSelectedDriver,
  setSelectedCooperative,
  selectedWeight,
  saving,
  refreshing,
  message,
  messageType,
  onAssign,
  onRefresh,
  onCancel,
  onHistory,
  onIncomplete,
  vehicleEligibility = {},
  driverEligibility = {},
  checkingVehicles = false,
  checkingDrivers = false,
}) {
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [driverSearch, setDriverSearch] = useState('');
  const choice = (selected) => `coord-choice ${selected ? 'selected' : ''}`;
  return (
    <div>
      <div className="coord-heading">
        <div>
          <h1>Asignar transporte</h1>
          <p>
            Selecciona las cargas, un vehículo, un conductor y la cooperativa de
            destino.
          </p>
        </div>
      </div>
      {message && (
        <div
          className="coord-notice"
          role={messageType === 'error' ? 'alert' : 'status'}
        >
          {message}
        </div>
      )}
      <section className="coord-card">
        <h2>
          <Icon name="clipboard" size={20} />
          Cargas pendientes · {selectedWeight.toLocaleString('es-CO')} kg
          seleccionados
        </h2>
        <div className="coord-loads">
          {deliveries.map((item) => {
            const selected = selectedDeliveries.some(
              (load) => load.id_entrega === item.id_entrega,
            );
            return (
              <button
                key={item.id_entrega}
                className={choice(selected)}
                role="checkbox"
                aria-checked={selected}
                disabled={saving}
                onClick={() =>
                  setSelectedDeliveries((current) =>
                    selected
                      ? current.filter(
                          (load) => load.id_entrega !== item.id_entrega,
                        )
                      : [...current, item],
                  )
                }
              >
                <div>
                  <strong>{item.caficultor_nombre}</strong>
                  <small>
                    {item.cantidad_kg.toLocaleString('es-CO')} kg · CF-
                    {String(item.id_entrega).slice(0, 8)}
                  </small>
                </div>
                <span className="coord-choice-dot" />
              </button>
            );
          })}
        </div>
        {!deliveries.length && <p>No hay cargas pendientes de asignación.</p>}
      </section>
      <div className="coord-assignment-grid">
        <section className="coord-card">
          <h2>
            <Icon name="truck" size={20} />
            Vehículos · capacidad y documentos
          </h2>
          <label className="coord-search">
            <input
              aria-label="Buscar vehículo para asignar"
              placeholder="Buscar vehículo…"
              value={vehicleSearch}
              onChange={(event) => setVehicleSearch(event.target.value)}
            />
          </label>
          {vehicles
            .filter((item) =>
              `${item.placa} ${item.tipo_vehiculo}`
                .toLowerCase()
                .includes(vehicleSearch.toLowerCase()),
            )
            .map((item) => (
              <button
                key={item.id_vehiculo}
                role="radio"
                aria-checked={selectedVehicle?.id_vehiculo === item.id_vehiculo}
                disabled={saving || (selectedWeight > 0 && vehicleEligibility[item.id_vehiculo]?.compatible !== true)}
                className={choice(
                  selectedVehicle?.id_vehiculo === item.id_vehiculo,
                )}
                onClick={() => {
                  setSelectedVehicle(item);
                  setSelectedDriver(null);
                }}
              >
                <span className="coord-truck-icon">
                  <Icon name="truck" size={38} />
                </span>
                <div>
                  <strong>{item.placa}</strong>
                  <small>
                    {item.tipo_vehiculo} ·{' '}
                    {(item.capacidad_kg / 1000).toLocaleString('es-CO')} t
                  </small>
                  <small>
                    {item.estado_vehiculo === 'en camino' ? 'En ruta · próximo viaje en cola' : 'Disponible para iniciar'}
                  </small>
                  {selectedWeight > 0 && <small>Capacidad restante: {vehicleEligibility[item.id_vehiculo]?.capacidad_restante_kg?.toLocaleString('es-CO') ?? '—'} kg</small>}
                  {vehicleEligibility[item.id_vehiculo]?.motivos?.map((reason) => <small key={reason} style={{ color: '#b42318' }}>{reason}</small>)}
                </div>
                <span className="coord-choice-dot" />
              </button>
            ))}
          {checkingVehicles && <p>Verificando vehículos con el servidor…</p>}
          {!vehicles.length && <p>No hay vehículos programables.</p>}
        </section>
        <section className="coord-card">
          <h2>
            <Icon name="driver" size={20} />
            Conductores
          </h2>
          <label className="coord-search">
            <input
              aria-label="Buscar conductor para asignar"
              placeholder="Buscar conductor…"
              value={driverSearch}
              onChange={(event) => setDriverSearch(event.target.value)}
            />
          </label>
          {drivers
            .filter((item) =>
              item.nombre_conductor
                .toLowerCase()
                .includes(driverSearch.toLowerCase()),
            )
            .map((item, index) => (
              <button
                key={item.id_conductor || index}
                role="radio"
                aria-checked={
                  !!item.id_conductor &&
                  selectedDriver?.id_conductor === item.id_conductor
                }
                disabled={saving || !selectedVehicle || driverEligibility[item.id_conductor]?.compatible !== true}
                className={choice(
                  !!item.id_conductor &&
                    selectedDriver?.id_conductor === item.id_conductor,
                )}
                onClick={() => {
                  if (!item.id_conductor || !item.tiene_foto_licencia)
                    return onIncomplete(item);
                  setSelectedDriver(item);
                }}
              >
                <span className="coord-avatar">
                  {item.foto_perfil ? <img src={item.foto_perfil} alt={`Foto de ${item.nombre_conductor}`}/> : <Icon name="user" size={27} />}
                </span>
                <div>
                  <strong>{item.nombre_conductor}</strong>
                  <small>Licencia: {item.licencia || 'No registrada'}</small>
                  <small>Vence: {driverEligibility[item.id_conductor]?.fecha_vencimiento_licencia || 'sin fecha'}</small>
                  <small>
                    {driverEligibility[item.id_conductor]?.compatible ? 'Compatible' : 'No compatible'}
                  </small>
                  {driverEligibility[item.id_conductor]?.motivos?.map((reason) => <small key={reason} style={{ color: '#b42318' }}>{reason}</small>)}
                </div>
                <span className="coord-choice-dot" />
              </button>
            ))}
          {!selectedVehicle && <p>Selecciona primero un vehículo.</p>}
          {checkingDrivers && <p>Verificando licencias con el servidor…</p>}
          {!drivers.length && <p>No hay conductores registrados.</p>}
        </section>
      </div>
      <section className="coord-card">
        <h2>
          <Icon name="pin" size={20} />
          Cooperativa de destino
        </h2>
        <div className="coord-loads">
          {cooperatives.map((item) => (
            <button
              key={item.id_cooperativa}
              role="radio"
              aria-checked={
                selectedCooperative?.id_cooperativa === item.id_cooperativa
              }
              disabled={saving}
              className={choice(
                selectedCooperative?.id_cooperativa === item.id_cooperativa,
              )}
              onClick={() => setSelectedCooperative(item)}
            >
              <div>
                <strong>{item.nombre}</strong>
                <small>{item.direccion}</small>
                <small>
                  {item.ciudad}, {item.departamento}
                </small>
              </div>
              <span className="coord-choice-dot" />
            </button>
          ))}
        </div>
        {!cooperatives.length && (
          <p>
            El registrador debe crear una cooperativa con ubicación antes de
            asignar.
          </p>
        )}
      </section>
      <div className="coord-actions">
        <button
          className="coord-button secondary"
          disabled={saving}
          onClick={onHistory}
        >
          Historial de asignaciones
        </button>
        <button
          className="coord-button secondary"
          disabled={saving || refreshing}
          onClick={onRefresh}
        >
          {refreshing ? 'Actualizando…' : 'Actualizar disponibilidad'}
        </button>
        <button
          className="coord-button secondary"
          disabled={saving}
          onClick={onCancel}
        >
          Cancelar
        </button>
        <button className="coord-button" disabled={saving} onClick={onAssign}>
          {saving ? 'Asignando viaje…' : 'Confirmar asignación'}
        </button>
      </div>
    </div>
  );
}
