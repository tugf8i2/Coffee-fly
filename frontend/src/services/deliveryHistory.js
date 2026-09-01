import { API_BASE_URL, fetchApi } from '../config';

export async function fetchDeliveryHistories(deliveries, token) {
  const ids = [...new Set((deliveries || []).map((delivery) => delivery.id_entrega).filter(Boolean))];
  const grouped = Object.fromEntries(ids.map((id) => [id, []]));
  if (!ids.length) return grouped;
  const query = ids.map((id) => `entrega_id=${encodeURIComponent(id)}`).join('&');
  const response = await fetchApi(`${API_BASE_URL}/entregas/historial-estados/lote?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const rows = await response.json();
  if (!response.ok) throw Error(rows.detail || 'No se pudo consultar la trazabilidad de las entregas.');
  rows.forEach((row) => {
    if (grouped[row.entrega_id]) grouped[row.entrega_id].push(row);
  });
  return grouped;
}
