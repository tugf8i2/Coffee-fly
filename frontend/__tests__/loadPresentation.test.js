import { bagSummary, calculateBagGroupsKg, calculateLoadKg, tonnes, weight } from '../src/servicios/presentacionCarga';

test('calcula bultos normales y un bulto extra', () => {
  expect(calculateLoadKg('60', 12, '35.5')).toBe(755.5);
  expect(bagSummary({ cantidad_bultos: 12, peso_bulto_kg: 60, peso_extra_kg: 35.5 })).toContain('bulto extra');
});

test('rechaza cantidades que no son enteras o pesos inválidos', () => {
  expect(calculateLoadKg(60, 1.5, 0)).toBeNull();
  expect(calculateLoadKg(0, 12, 0)).toBeNull();
  expect(calculateLoadKg(60, 12, -1)).toBeNull();
});

test('presenta el peso en toneladas', () => {
  expect(tonnes(755.5)).toMatch(/0[,.]756 t/);
  expect(weight(755.5)).toMatch(/kg.*0[,.]756 t/);
});

test('suma varios grupos de bultos', () => {
  expect(calculateBagGroupsKg([{ peso_bulto_kg: 60, cantidad_bultos: 10 }, { peso_bulto_kg: 35, cantidad_bultos: 2 }])).toBe(670);
});
