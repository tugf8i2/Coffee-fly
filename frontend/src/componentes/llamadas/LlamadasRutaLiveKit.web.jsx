import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';

import { API_BASE_URL, fetchApi } from '../../configuracion';
import './LlamadasRuta.css';

const socketUrl = () => {
  const url = new URL(API_BASE_URL, window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/llamadas/ws`;
  return url.href;
};

export default function LlamadasRutaLiveKit({ token, user }) {
  const [contacts, setContacts] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [call, setCallState] = useState(null);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [remoteCameraOn, setRemoteCameraOn] = useState(false);
  const socketRef = useRef(null);
  const roomRef = useRef(null);
  const callRef = useRef(null);
  const generationRef = useRef(0);
  const remoteLeaveTimerRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const ringtoneRef = useRef(null);
  const tokenRef = useRef(token);
  const receiveRef = useRef(null);
  tokenRef.current = token;

  const setCall = useCallback((next) => {
    callRef.current = next;
    setCallState(next);
  }, []);

  const send = useCallback((tipo, active) => {
    if (!active || socketRef.current?.readyState !== WebSocket.OPEN) return false;
    socketRef.current.send(JSON.stringify({ tipo, viaje_id: active.viaje_id, llamada_id: active.llamada_id }));
    return true;
  }, []);

  const clearMedia = useCallback(() => {
    generationRef.current += 1;
    clearTimeout(remoteLeaveTimerRef.current);
    remoteLeaveTimerRef.current = null;
    const room = roomRef.current;
    roomRef.current = null;
    room?.disconnect();
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setMuted(false);
    setCameraOn(false);
    setRemoteCameraOn(false);
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
      const response = await fetchApi(`${API_BASE_URL}/llamadas/contactos`, {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });
      if (!response.ok) throw Error();
      setContacts(await response.json());
    } catch { setContacts([]); }
  }, []);

  const joinRoom = useCallback(async (active) => {
    const generation = generationRef.current;
    const response = await fetchApi(`${API_BASE_URL}/llamadas/livekit-token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenRef.current}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ viaje_id: active.viaje_id, llamada_id: active.llamada_id }),
    });
    if (!response.ok) throw Error('No se pudo conectar la llamada. Revisa la conexión e intenta otra vez.');
    const { server_url: url, participant_token: roomToken } = await response.json();
    if (generation !== generationRef.current || callRef.current?.llamada_id !== active.llamada_id) return false;

    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (roomRef.current !== room) return;
      if (track.kind === Track.Kind.Audio && remoteAudioRef.current) {
        track.attach(remoteAudioRef.current);
        remoteAudioRef.current.play().catch(() => setError('Toca reproducir audio para escuchar la llamada.'));
      }
      if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
        track.attach(remoteVideoRef.current);
        remoteVideoRef.current.play().catch(() => setError('Toca el vídeo para verlo en este navegador.'));
        setRemoteCameraOn(true);
      }
      if (callRef.current?.llamada_id === active.llamada_id) setCall({ ...callRef.current, status: 'active' });
    });
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach();
      if (track.kind === Track.Kind.Video) {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        setRemoteCameraOn(false);
      }
    });
    room.on(RoomEvent.TrackMuted, (publication, participant) => {
      if (participant !== room.localParticipant && publication.kind === Track.Kind.Video) setRemoteCameraOn(false);
    });
    room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
      if (participant !== room.localParticipant && publication.kind === Track.Kind.Video) setRemoteCameraOn(true);
    });
    room.on(RoomEvent.ParticipantConnected, () => {
      clearTimeout(remoteLeaveTimerRef.current);
      remoteLeaveTimerRef.current = null;
      if (callRef.current?.llamada_id === active.llamada_id) setCall({ ...callRef.current, status: 'active' });
    });
    room.on(RoomEvent.ParticipantDisconnected, () => {
      clearTimeout(remoteLeaveTimerRef.current);
      remoteLeaveTimerRef.current = setTimeout(() => {
        if (roomRef.current === room) endCall(false);
      }, 10000);
    });
    room.on(RoomEvent.Reconnecting, () => setError('Reconectando la llamada…'));
    room.on(RoomEvent.Reconnected, () => setError(''));
    room.on(RoomEvent.Disconnected, () => {
      if (roomRef.current === room) {
        endCall(false);
        setError('La llamada perdió la conexión. Intenta llamar de nuevo.');
      }
    });
    try {
      await room.connect(url, roomToken);
      if (generation !== generationRef.current || callRef.current?.llamada_id !== active.llamada_id) {
        room.disconnect();
        return false;
      }
      await room.localParticipant.setMicrophoneEnabled(true);
      if (generation !== generationRef.current || callRef.current?.llamada_id !== active.llamada_id) {
        room.disconnect();
        return false;
      }
      return true;
    } catch (reason) {
      if (roomRef.current === room) roomRef.current = null;
      room.disconnect();
      throw reason;
    }
  }, [endCall, setCall]);

  const receiveSignal = useCallback((message) => {
    if (message.tipo === 'listo') { setConnected(true); loadContacts(); return; }
    if (message.tipo === 'ping') { socketRef.current?.send(JSON.stringify({ tipo: 'ping' })); return; }
    if (message.tipo === 'no_disponible') {
      setError('El otro participante no tiene la aplicación abierta.');
      endCall(false);
      return;
    }
    if (message.tipo === 'invitar') {
      if (callRef.current) { send('rechazar', message); return; }
      const contact = contacts.find((item) => item.viaje_id === message.viaje_id);
      setError('');
      setCall({ viaje_id: message.viaje_id, llamada_id: message.llamada_id, nombre: message.de_nombre || contact?.nombre || 'Participante de la ruta', status: 'incoming' });
      return;
    }
    const active = callRef.current;
    if (!active || active.llamada_id !== message.llamada_id || active.viaje_id !== message.viaje_id) return;
    if (message.tipo === 'rechazar' || message.tipo === 'finalizar') { endCall(false); return; }
    if (message.tipo === 'aceptar' && active.status === 'outgoing') setCall({ ...active, status: 'connecting' });
  }, [contacts, endCall, loadContacts, send, setCall]);
  receiveRef.current = receiveSignal;

  const userId = user?.id ?? user?.id_usuario;
  useEffect(() => {
    let socket;
    let retry;
    let stopped = false;
    const connect = () => {
      if (stopped) return;
      const authToken = tokenRef.current;
      socket = new WebSocket(socketUrl());
      socketRef.current = socket;
      socket.onopen = () => socket.send(JSON.stringify({ token: authToken }));
      socket.onmessage = ({ data }) => {
        try { receiveRef.current(JSON.parse(data)); }
        catch { setError('La llamada recibió una señal inválida.'); }
      };
      socket.onclose = ({ code }) => {
        setConnected(false);
        if (!stopped && code !== 4403 && (code !== 4401 || tokenRef.current !== authToken)) retry = setTimeout(connect, 3500);
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
  }, [userId, clearMedia]);

  useEffect(() => {
    window.ReactNativeWebView?.postMessage?.(JSON.stringify({ type: 'call_visibility', active: Boolean(call) }));
    return () => window.ReactNativeWebView?.postMessage?.(JSON.stringify({ type: 'call_visibility', active: false }));
  }, [Boolean(call)]);

  useEffect(() => {
    const ringtone = ringtoneRef.current;
    if (!ringtone) return;
    if (call?.status === 'incoming' || call?.status === 'outgoing') {
      ringtone.currentTime = 0;
      ringtone.play().catch(() => {
        if (call?.status === 'incoming') setError('Hay una llamada entrante. Activa el sonido del dispositivo para escuchar el tono.');
      });
    } else {
      ringtone.pause();
      ringtone.currentTime = 0;
    }
    return () => ringtone.pause();
  }, [call?.status]);

  const startCall = async (contact) => {
    if (callRef.current || !connected) return;
    const active = { viaje_id: contact.viaje_id, llamada_id: crypto.randomUUID(), nombre: contact.nombre, status: 'outgoing' };
    setCall(active);
    setMenuOpen(false);
    setError('');
    try {
      if (!await joinRoom(active)) return;
      if (!send('invitar', active)) throw Error('No hay conexión para llamar.');
    } catch (reason) {
      if (callRef.current?.llamada_id !== active.llamada_id) return;
      endCall(false);
      setError(reason.message || 'No se pudo iniciar la llamada.');
    }
  };

  const acceptCall = async () => {
    const active = callRef.current;
    if (!active || active.status !== 'incoming') return;
    setCall({ ...active, status: 'connecting' });
    setError('');
    try {
      if (!await joinRoom(active)) return;
      if (!send('aceptar', active)) throw Error('No hay conexión para contestar.');
    } catch (reason) {
      if (callRef.current?.llamada_id !== active.llamada_id) return;
      send('rechazar', active);
      endCall(false);
      setError(reason.message || 'No se pudo contestar la llamada.');
    }
  };

  const toggleCamera = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      const next = !cameraOn;
      await room.localParticipant.setCameraEnabled(next);
      if (roomRef.current !== room) return;
      const video = localVideoRef.current;
      if (video) {
        video.srcObject = null;
        if (next) {
          const track = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
          if (!track) throw Error('La cámara no produjo imagen.');
          track.attach(video);
          setCameraOn(true);
          video.play().catch(() => setError('Toca el vídeo para ver tu cámara en este navegador.'));
        }
      }
      if (!next) setCameraOn(false);
    } catch (reason) { setError(reason.message || 'No se pudo cambiar la cámara.'); }
  };

  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setMicrophoneEnabled(muted);
      if (roomRef.current === room) setMuted(!muted);
    } catch (reason) { setError(reason.message || 'No se pudo cambiar el micrófono.'); }
  };

  const role = String(user?.rol || '').toLowerCase();
  if (!['conductor', 'coordinador'].includes(role)) return null;
  return <div className="cf-call-layer">
    <audio ref={ringtoneRef} src="/call-ringtone.wav" preload="auto" loop />
    <audio ref={remoteAudioRef} autoPlay playsInline controls={call?.status === 'active'} className={call?.status === 'active' ? 'cf-call-audio' : 'cf-call-hidden'} />
    {!call && <button type="button" className="cf-call-launch" onClick={() => { setMenuOpen((value) => !value); loadContacts(); }} aria-expanded={menuOpen}>☎ Llamar</button>}
    {menuOpen && !call && <section className="cf-call-menu" aria-label="Contactos para llamada">
      <strong>Llamadas de ruta</strong>
      {!connected && <p>Conectando con llamadas…</p>}
      {connected && !contacts.length && <p>No hay un conductor o coordinador asignado a una ruta activa.</p>}
      {contacts.map((contact) => <button type="button" key={contact.viaje_id} onClick={() => startCall(contact)}>{contact.nombre} · {contact.rol}</button>)}
    </section>}
    {call && <section className="cf-call-dialog" role="dialog" aria-modal="true" aria-label="Llamada de Coffee Fly">
      <h2>{call.status === 'incoming' ? 'Llamada entrante' : call.status === 'outgoing' ? 'Llamando…' : call.status === 'connecting' ? 'Conectando…' : 'Llamada en curso'}</h2>
      <p>{call.nombre}</p>
      <div className="cf-call-videos"><div className="cf-call-video"><video ref={remoteVideoRef} autoPlay playsInline muted />{!remoteCameraOn && <span>Cámara apagada</span>}</div><div className="cf-call-video"><video ref={localVideoRef} autoPlay playsInline muted />{!cameraOn && <span>Tu cámara apagada</span>}</div></div>
      <div className="cf-call-actions">
        {call.status === 'incoming' && <button type="button" className="accept" onClick={acceptCall}>Contestar</button>}
        {call.status !== 'incoming' && <><button type="button" onClick={toggleMic}>{muted ? 'Activar micrófono' : 'Silenciar micrófono'}</button><button type="button" onClick={toggleCamera}>{cameraOn ? 'Apagar cámara' : 'Compartir cámara'}</button></>}
        <button type="button" className="hangup" onClick={() => endCall()}>Terminar llamada</button>
      </div>
    </section>}
    {error && <div className="cf-call-error" role="alert">{error}<button type="button" aria-label="Cerrar aviso" onClick={() => setError('')}>×</button></div>}
  </div>;
}
