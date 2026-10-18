import { useCallback, useEffect, useRef, useState } from 'react';

import { API_BASE_URL, fetchApi } from '../../configuracion';
import './LlamadasRuta.css';

const socketUrl = () => {
  const url = new URL(API_BASE_URL, window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/llamadas/ws`;
  return url.href;
};

const iceServers = () => {
  try {
    const servers = JSON.parse(process.env.EXPO_PUBLIC_CALL_ICE_SERVERS || '[]');
    return Array.isArray(servers) ? servers : [];
  } catch { return []; }
};

export default function LlamadasRuta({ token, user, screen }) {
  const [contacts, setContacts] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [call, setCallState] = useState(null);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const socketRef = useRef(null);
  const callRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const pendingIceRef = useRef([]);
  const remoteAudioRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const receiveSignalRef = useRef(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const setCall = useCallback((next) => {
    callRef.current = next;
    setCallState(next);
  }, []);

  const send = useCallback((tipo, active, contenido = {}) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN || !active) return false;
    socketRef.current.send(JSON.stringify({ tipo, viaje_id: active.viaje_id, llamada_id: active.llamada_id, contenido }));
    return true;
  }, []);

  const clearMedia = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    cameraStreamRef.current = null;
    pendingIceRef.current = [];
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setMuted(false);
    setCameraOn(false);
  }, []);

  const endCall = useCallback((notify = true) => {
    const active = callRef.current;
    if (notify && active) send('finalizar', active);
    clearMedia();
    setCall(null);
  }, [clearMedia, send, setCall]);

  const loadContacts = useCallback(async () => {
    if (!tokenRef.current) return;
    try {
      const response = await fetchApi(`${API_BASE_URL}/llamadas/contactos`, { headers: { Authorization: `Bearer ${tokenRef.current}` } });
      if (!response.ok) throw Error('No fue posible consultar los contactos de ruta.');
      setContacts(await response.json());
    } catch { setContacts([]); }
  }, []);

  const newPeer = useCallback((active) => {
    if (typeof RTCPeerConnection === 'undefined') throw Error('Este dispositivo no permite llamadas en la aplicación.');
    const peer = new RTCPeerConnection({ iceServers: iceServers() });
    peerRef.current = peer;
    localStreamRef.current?.getTracks().forEach((track) => peer.addTrack(track, localStreamRef.current));
    peer.onicecandidate = ({ candidate }) => {
      if (candidate) send('candidato', active, { candidate: candidate.toJSON() });
    };
    peer.ontrack = ({ streams }) => {
      const stream = streams?.[0];
      if (!stream) return;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch(() => setError('Toca reproducir audio para escuchar la llamada.'));
      }
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
      if (callRef.current?.llamada_id === active.llamada_id) setCall({ ...callRef.current, status: 'active' });
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'failed') setError('No se pudo conectar el audio. Revisa la red o el servidor TURN.');
    };
    return peer;
  }, [send, setCall]);

  const addRemoteIce = useCallback(async (peer) => {
    const pending = pendingIceRef.current.splice(0);
    for (const candidate of pending) await peer.addIceCandidate(candidate).catch(() => {});
  }, []);

  const receiveSignal = useCallback(async (message) => {
    if (message.tipo === 'listo') { setConnected(true); loadContacts(); return; }
    if (message.tipo === 'ping') { socketRef.current?.send(JSON.stringify({ tipo: 'ping' })); return; }
    if (message.tipo === 'no_disponible') { setError('El otro participante no tiene la aplicación abierta.'); endCall(false); return; }
    if (message.tipo === 'invitar') {
      if (callRef.current) {
        send('rechazar', message, { motivo: 'ocupado' });
        return;
      }
      const contact = contacts.find((item) => item.viaje_id === message.viaje_id);
      setError('');
      setCall({ viaje_id: message.viaje_id, llamada_id: message.llamada_id, nombre: contact?.nombre || 'Participante de la ruta', status: 'incoming' });
      return;
    }
    const active = callRef.current;
    if (!active || active.llamada_id !== message.llamada_id || active.viaje_id !== message.viaje_id) return;
    if (message.tipo === 'finalizar' || message.tipo === 'rechazar') { endCall(false); return; }
    const peer = peerRef.current;
    if (message.tipo === 'aceptar' && peer) {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      send('oferta', active, { sdp: offer.sdp, type: offer.type });
    }
    if (message.tipo === 'oferta' && peer) {
      await peer.setRemoteDescription({ type: 'offer', sdp: message.contenido?.sdp });
      await addRemoteIce(peer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      send('respuesta', active, { sdp: answer.sdp, type: answer.type });
    }
    if (message.tipo === 'respuesta' && peer) {
      await peer.setRemoteDescription({ type: 'answer', sdp: message.contenido?.sdp });
      await addRemoteIce(peer);
    }
    if (message.tipo === 'candidato' && message.contenido?.candidate) {
      if (peer?.remoteDescription) await peer.addIceCandidate(message.contenido.candidate).catch(() => {});
      else pendingIceRef.current.push(message.contenido.candidate);
    }
  }, [addRemoteIce, contacts, endCall, loadContacts, send, setCall]);
  receiveSignalRef.current = receiveSignal;

  useEffect(() => {
    let socket;
    let retry;
    let stopped = false;
    const connect = () => {
      if (stopped) return;
      socket = new WebSocket(socketUrl());
      socketRef.current = socket;
      socket.onopen = () => socket.send(JSON.stringify({ token: tokenRef.current }));
      socket.onmessage = ({ data }) => {
        try { receiveSignalRef.current(JSON.parse(data)).catch((reason) => setError(reason.message || 'Falló la llamada.')); }
        catch { setError('La llamada recibió una señal inválida.'); }
      };
      socket.onclose = ({ code }) => {
        setConnected(false);
        if (callRef.current) endCall(false);
        if (!stopped && ![4401, 4403].includes(code)) retry = setTimeout(connect, 3500);
      };
    };
    if (token) connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      socket?.close();
      if (socketRef.current === socket) socketRef.current = null;
      clearMedia();
      callRef.current = null;
    };
  }, [token, endCall, clearMedia]);

  const startCall = async (contact) => {
    if (callRef.current || !connected) return;
    const active = { viaje_id: contact.viaje_id, llamada_id: crypto.randomUUID(), nombre: contact.nombre, status: 'outgoing' };
    setCall(active);
    setMenuOpen(false);
    setError('');
    try {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      newPeer(active);
      if (!send('invitar', active, { medio: 'audio' })) throw Error('No hay conexión para llamar.');
    } catch (reason) { endCall(false); setError(reason.message || 'No se pudo activar el micrófono.'); }
  };

  const acceptCall = async () => {
    const active = callRef.current;
    if (!active || active.status !== 'incoming') return;
    try {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      newPeer(active);
      setCall({ ...active, status: 'connecting' });
      send('aceptar', active);
    } catch (reason) { send('rechazar', active); endCall(false); setError(reason.message || 'No se pudo activar el micrófono.'); }
  };

  const toggleCamera = async () => {
    const active = callRef.current;
    const peer = peerRef.current;
    if (!active || !peer) return;
    try {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => {
          const sender = peer.getSenders().find((item) => item.track === track);
          if (sender) peer.removeTrack(sender);
          track.stop();
        });
        cameraStreamRef.current = null;
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        setCameraOn(false);
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        cameraStreamRef.current = stream;
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        setCameraOn(true);
      }
      if (peer.remoteDescription) {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        send('oferta', active, { sdp: offer.sdp, type: offer.type });
      }
    } catch (reason) { setError(reason.message || 'No se pudo activar la cámara.'); }
  };

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  };

  const role = String(user?.rol || '').toLowerCase();
  if (!['conductor', 'coordinador'].includes(role)) return null;
  return <div className="cf-call-layer">
    <audio ref={remoteAudioRef} autoPlay controls={call?.status === 'active'} className={call?.status === 'active' ? 'cf-call-audio' : 'cf-call-hidden'} />
    {!call && <button type="button" className="cf-call-launch" onClick={() => { setMenuOpen((value) => !value); loadContacts(); }} aria-expanded={menuOpen}>☎ Llamar</button>}
    {menuOpen && !call && <section className="cf-call-menu" aria-label="Contactos para llamada">
      <strong>Llamadas de ruta</strong>
      {!connected && <p>Conectando con llamadas…</p>}
      {connected && !contacts.length && <p>No hay un conductor o coordinador asignado a una ruta activa.</p>}
      {contacts.map((contact) => <button type="button" key={contact.viaje_id} onClick={() => startCall(contact)}>{contact.nombre} · {contact.rol}</button>)}
    </section>}
    {call && <section className="cf-call-dialog" role="dialog" aria-modal="true" aria-label="Llamada de Coffee Fly">
      <h2>{call.status === 'incoming' ? 'Llamada entrante' : call.status === 'outgoing' ? 'Llamando…' : 'Llamada en curso'}</h2>
      <p>{call.nombre}</p>
      <div className="cf-call-videos"><video ref={remoteVideoRef} autoPlay playsInline muted /><video ref={localVideoRef} autoPlay playsInline muted /></div>
      <div className="cf-call-actions">
        {call.status === 'incoming' && <button type="button" className="accept" onClick={acceptCall}>Contestar</button>}
        {call.status !== 'incoming' && <><button type="button" onClick={toggleMic}>{muted ? 'Activar micrófono' : 'Silenciar micrófono'}</button><button type="button" onClick={toggleCamera}>{cameraOn ? 'Apagar cámara' : 'Compartir cámara'}</button></>}
        <button type="button" className="hangup" onClick={() => endCall()}>Terminar llamada</button>
      </div>
    </section>}
    {error && <div className="cf-call-error" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Cerrar aviso">×</button></div>}
  </div>;
}
