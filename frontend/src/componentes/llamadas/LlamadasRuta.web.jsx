import { useEffect, useState } from 'react';

import { API_BASE_URL } from '../../configuracion';
import LlamadasRutaLegacy from './LlamadasRutaLegacy.web';
import LlamadasRutaLiveKit from './LlamadasRutaLiveKit.web';

export default function LlamadasRuta(props) {
  const [mode, setMode] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!props.token) { setMode(null); return; }
    fetch(`${API_BASE_URL}/llamadas/medio`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${props.token}` },
    }).then((response) => response.ok ? response.json() : { medio: 'webrtc' })
      .then((result) => { if (!cancelled) setMode(result.medio === 'livekit' ? 'livekit' : 'webrtc'); })
      .catch(() => { if (!cancelled) setMode(null); });
    return () => { cancelled = true; };
  }, [props.token]);

  if (!mode) return null;
  return mode === 'livekit' ? <LlamadasRutaLiveKit {...props} /> : <LlamadasRutaLegacy {...props} />;
}
