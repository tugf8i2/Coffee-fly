export function calculateLoadKg(bagWeight, bagCount, extraWeight = 0) {
  const weight = Number(bagWeight);
  const count = Number(bagCount);
  const extra = Number(extraWeight || 0);
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isInteger(count) || count <= 0) return null;
  if (!Number.isFinite(extra) || extra < 0) return null;
  return Math.round(((weight * count) + extra) * 100) / 100;
}

export function calculateBagGroupsKg(groups) {
  if (!Array.isArray(groups) || !groups.length) return null;
  let total = 0;
  for (const group of groups) {
    const subtotal = calculateLoadKg(group.peso_bulto_kg, Number(group.cantidad_bultos), 0);
    if (subtotal === null) return null;
    total += subtotal;
  }
  return Math.round(total * 100) / 100;
}

export function tonnes(kg) {
  return `${(Number(kg || 0) / 1000).toLocaleString('es-CO', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} t`;
}

export function weight(kg) {
  return `${Number(kg || 0).toLocaleString('es-CO')} kg · ${tonnes(kg)}`;
}

export function bagSummary(item) {
  if (item?.grupos_bultos?.length) return item.grupos_bultos.map((group) => `${group.cantidad_bultos} bulto(s) de ${weight(group.peso_bulto_kg)}`).join(' + ');
  if (!item?.cantidad_bultos || !item?.peso_bulto_kg) return null;
  return `${item.cantidad_bultos} bulto(s) de ${weight(item.peso_bulto_kg)}${Number(item.peso_extra_kg) > 0 ? ` + 1 bulto extra de ${weight(item.peso_extra_kg)}` : ''}`;
}
