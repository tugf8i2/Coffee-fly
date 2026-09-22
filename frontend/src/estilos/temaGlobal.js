let oscuro = false;

export const establecerTemaOscuro = (valor) => { oscuro = Boolean(valor); };
export const temaOscuroActivo = () => oscuro;

const fondosOscuros = new Set(['safe', 'page', 'content', 'screenStage', 'screenContent']);
const textosClaros = new Set(['title', 'section', 'pageMuted', 'pageLabel', 'attribution']);

export function aplicarTemaGlobal(nombre, estilo) {
  if (!oscuro || !estilo) return estilo;
  // Un estilo que ya declara ser oscuro es una decisión explícita del módulo;
  // no debe convertirse otra vez en una superficie clara.
  if (/^dark/i.test(String(nombre))) return estilo;
  if (fondosOscuros.has(nombre)) return { ...estilo, backgroundColor: '#102c27' };
  if (textosClaros.has(nombre)) return { ...estilo, color: ['pageMuted', 'attribution'].includes(nombre) ? '#c5ddd0' : '#f0f6ef', borderBottomColor: '#34594f' };
  // Las superficies se mantienen crema para que también los textos sin estilo
  // explícito tengan contraste suficiente en Android e iOS.
  if (/card|form|history|panel|sheet|modal/i.test(nombre)
    && !/text|title|label|link|value|description|eyebrow/i.test(nombre)) {
    return { ...estilo, backgroundColor: '#f6f1e4', borderColor: '#6f8d80' };
  }
  if (/^(input|readonly)$/.test(nombre)) return { ...estilo, backgroundColor: '#17382f', borderColor: '#70a38e', color: '#f4fbf6' };
  return estilo;
}
