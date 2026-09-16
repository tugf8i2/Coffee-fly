const colors = [
  '#118057',
  '#298ceb',
  '#efae30',
  '#71b78b',
  '#e36046',
  '#637daa',
];
export default function GraficosCoordinador({ report }) {
  const daily = report.resumen_diario || [];
  const fleet = report.entregas_por_vehiculo || [];
  const count = daily.reduce(
    (total, item) => total + Number(item.entregas || 0),
    0,
  );
  const weight = daily.reduce(
    (total, item) => total + Number(item.kilogramos || 0),
    0,
  );
  const fleetTotal = fleet.reduce(
    (total, item) => total + Number(item.entregas || 0),
    0,
  );
  const maximum = Math.max(
    1,
    ...daily.map((item) => Number(item.entregas || 0)),
  );
  let offset = 0;
  const segments = fleet.map((item, index) => {
    const start = offset;
    offset += fleetTotal ? (Number(item.entregas || 0) / fleetTotal) * 100 : 0;
    return `${colors[index % colors.length]} ${start}% ${offset}%`;
  });
  return (
    <div>
      <div className="coord-metrics">
        <div className="coord-metric">
          <div>
            <strong>{count.toLocaleString('es-CO')}</strong>
            <span>Recolecciones del período</span>
          </div>
        </div>
        <div className="coord-metric">
          <div>
            <strong>{weight.toLocaleString('es-CO')} kg</strong>
            <span>Café recolectado</span>
          </div>
        </div>
        <div className="coord-metric blue">
          <div>
            <strong>{fleet.length}</strong>
            <span>Vehículos en el reporte</span>
          </div>
        </div>
        <div className="coord-metric amber">
          <div>
            <strong>{report.cafe_por_caficultor?.length || 0}</strong>
            <span>Caficultores en el reporte</span>
          </div>
        </div>
      </div>
      <div className="coord-chart-grid">
        <section className="coord-card">
          <h2>Recolecciones por día</h2>
          {daily.length ? (
            <div
              className="coord-bars"
              role="img"
              aria-label={daily
                .map((item) => `${item.fecha}: ${item.entregas} recolecciones`)
                .join(', ')}
            >
              {daily.map((item) => (
                <div className="coord-bar" key={item.fecha}>
                  <span>{item.entregas}</span>
                  <div
                    className="coord-bar-fill"
                    style={{
                      height: `${(Number(item.entregas || 0) / maximum) * 80}%`,
                    }}
                  />
                  <small>{String(item.fecha).slice(5)}</small>
                </div>
              ))}
            </div>
          ) : (
            <p>Sin datos para el período.</p>
          )}
        </section>
        <section className="coord-card">
          <h2>Recolecciones por vehículo</h2>
          {fleetTotal ? (
            <div className="coord-donut-row">
              <div
                className="coord-donut"
                style={{ background: `conic-gradient(${segments.join(',')})` }}
                role="img"
                aria-label={`${fleetTotal} recolecciones por vehículo`}
              >
                <strong>{fleetTotal}</strong>
              </div>
              <div className="coord-chart-legend">
                {fleet.map((item, index) => (
                  <span key={`${item.vehiculo}-${index}`}>
                    <i style={{ background: colors[index % colors.length] }} />
                    {item.vehiculo}: {item.entregas} ·{' '}
                    {Math.round(
                      (Number(item.entregas || 0) / fleetTotal) * 100,
                    )}
                    %
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p>Sin recolecciones asociadas a vehículos.</p>
          )}
        </section>
      </div>
    </div>
  );
}
