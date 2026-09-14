const readableLocation = (location) => (Array.isArray(location)
  ? location.filter((part) => !['body', 'query', 'path'].includes(String(part))).join('.')
  : '');

function detailMessage(detail) {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(detailMessage).filter(Boolean).join('\n');
  if (!detail || typeof detail !== 'object') return '';
  if (detail.msg) {
    const location = readableLocation(detail.loc);
    return location ? `${location}: ${detail.msg}` : String(detail.msg);
  }
  if (detail.detail != null) return detailMessage(detail.detail);
  if (detail.message) return String(detail.message);
  return '';
}

export function apiErrorMessage(data, fallback = 'No se pudo completar la operación.') {
  return detailMessage(data?.detail ?? data) || fallback;
}
