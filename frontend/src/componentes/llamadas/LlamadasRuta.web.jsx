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
  const publicStun = { urls: 'stun:stun.cloudflare.com:3478' };
  try {
    const servers = JSON.parse(process.env.EXPO_PUBLIC_CALL_ICE_SERVERS || '[]');
    return Array.isArray(servers) ? [publicStun, ...servers] : [publicStun];
  } catch { return [publicStun]; }
};

export default function LlamadasRuta({ token, user, screen }) {
  const [contacts, setContacts] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [call, setCallState] = useState(null);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [remoteCameraOn, setRemoteCameraOn] = useState(false);
  const socketRef = useRef(null);
  const callRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const videoSenderRef = useRef(null);
  const pendingIceRef = useRef([]);
  const recoveryTimerRef = useRef(null);
  const recoveryAttemptsRef = useRef(0);
  const mediaGenerationRef = useRef(0);
  const cameraBusyRef = useRef(false);
  const remoteAudioRef = useRef(null);
  const ringtoneRef = useRef(null);
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
    mediaGenerationRef.current += 1;
    cameraBusyRef.current = false;
    clearTimeout(recoveryTimerRef.current);
    recoveryTimerRef.current = null;
    recoveryAttemptsRef.current = 0;
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    cameraStreamRef.current = null;
    videoSenderRef.current = null;
    pendingIceRef.current = [];
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
    peer.ontrack = ({ track, streams }) => {
      const stream = streams?.[0] || new MediaStream([track]);
      if (track.kind === 'audio' && remoteAudioRef.current) {
        const audio = remoteAudioRef.current;
        // A video track can join the same WebRTC stream later. Keep playback bound
        // to the audio track alone so camera negotiation cannot reset the player.
        if (audio.srcObject?.getAudioTracks?.()[0] !== track) {
          audio.srcObject = new MediaStream([track]);
        }
        audio.play().catch(() => setError('Toca reproducir audio para escuchar la llamada.'));
      }
      if (track.kind === 'video') {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
        setRemoteCameraOn(!track.muted);
        const clearVideo = () => {
          if (remoteVideoRef.current?.srcObject === stream) remoteVideoRef.current.srcObject = null;
          setRemoteCameraOn(false);
        };
        track.addEventListener('mute', clearVideo);
        track.addEventListener('ended', clearVideo);
        track.addEventListener('unmute', () => {
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
          setRemoteCameraOn(true);
        });
      }
      if (callRef.current?.llamada_id === active.llamada_id) setCall({ ...callRef.current, status: 'active' });
    };
    const scheduleCheck = (delay) => {
      recoveryTimerRef.current = setTimeout(() => {
        recoveryTimerRef.current = null;
        monitorConnection();
      }, delay);
    };
    const monitorConnection = () => {
      if (peerRef.current !== peer) return;
      const state = peer.connectionState;
      if (state === 'connected') {
        clearTimeout(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
        recoveryAttemptsRef.current = 0;
        setError((current) => current === 'Reconectando el audio…' ? '' : current);
        return;
      }
      if (!active.initiator || !['disconnected', 'failed'].includes(state) || recoveryTimerRef.current) return;
      setError('Reconectando el audio…');
      recoveryTimerRef.current = setTimeout(async () => {
        recoveryTimerRef.current = null;
        if (peerRef.current !== peer || callRef.current?.llamada_id !== active.llamada_id || peer.connectionState === 'connected') return;
        if (recoveryAttemptsRef.current >= 3) {
          endCall();
          setError('La llamada perdió la conexión. Revisa la red y vuelve a llamar.');
          return;
        }
        if (peer.signalingState !== 'stable' || socketRef.current?.readyState !== WebSocket.OPEN) {
          scheduleCheck(2500);
          return;
        }
        recoveryAttemptsRef.current += 1;
        try {
          peer.restartIce();
          const offer = await peer.createOffer({ iceRestart: true });
          await peer.setLocalDescription(offer);
          send('oferta', active, { sdp: offer.sdp, type: offer.type });
          scheduleCheck(5000);
        } catch {
          scheduleCheck(2500);
        }
      }, state === 'failed' ? 1000 : 3000);
    };
    peer.onconnectionstatechange = monitorConnection;
    return peer;
  }, [endCall, send, setCall]);

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
      setCall({ viaje_id: message.viaje_id, llamada_id: message.llamada_id, nombre: message.de_nombre || contact?.nombre || 'Participante de la ruta', status: 'incoming', initiator: false });
      return;
    }
    const active = callRef.current;
    if (!active || active.llamada_id !== message.llamada_id || active.viaje_id !== message.viaje_id) return;
    if (message.tipo === 'finalizar' || message.tipo === 'rechazar') { endCall(false); return; }
    if (message.tipo === 'video_apagado') {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      setRemoteCameraOn(false);
      return;
    }
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
        try { receiveSignalRef.current(JSON.parse(data)).catch((reason) => setError(reason.message || 'Falló la llamada.')); }
        catch { setError('La llamada recibió una señal inválida.'); }
      };
      socket.onclose = ({ code }) => {
        setConnected(false);
        // El audio WebRTC puede continuar mientras se restablece la señalización.
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
  }, [userId, endCall, clearMedia]);

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

  const captureMedia = (constraints) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw Error('El micrófono requiere HTTPS o una conexión local segura.');
    }
    return navigator.mediaDevices.getUserMedia(constraints);
  };

  const startCall = async (contact) => {
    if (callRef.current || !connected) return;
    const active = { viaje_id: contact.viaje_id, llamada_id: crypto.randomUUID(), nombre: contact.nombre, status: 'outgoing', initiator: true };
    setCall(active);
    setMenuOpen(false);
    setError('');
    const generation = mediaGenerationRef.current;
    try {
      const stream = await captureMedia({ audio: true, video: false });
      if (generation !== mediaGenerationRef.current || callRef.current?.llamada_id !== active.llamada_id) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      localStreamRef.current = stream;
      newPeer(active);
      if (!send('invitar', active, { medio: 'audio' })) throw Error('No hay conexión para llamar.');
    } catch (reason) {
      if (generation !== mediaGenerationRef.current || callRef.current?.llamada_id !== active.llamada_id) return;
      endCall(false);
      setError(reason.message || 'No se pudo activar el micrófono.');
    }
  };

  const acceptCall = async () => {
    const active = callRef.current;
    if (!active || active.status !== 'incoming') return;
    setCall({ ...active, status: 'connecting' });
    const generation = mediaGenerationRef.current;
    try {
      const stream = await captureMedia({ audio: true, video: false });
      if (generation !== mediaGenerationRef.current || callRef.current?.llamada_id !== active.llamada_id) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      localStreamRef.current = stream;
      newPeer(active);
      if (!send('aceptar', active)) throw Error('No hay conexión para contestar.');
    } catch (reason) {
      if (generation !== mediaGenerationRef.current || callRef.current?.llamada_id !== active.llamada_id) return;
      send('rechazar', active);
      endCall(false);
      setError(reason.message || 'No se pudo activar el micrófono.');
    }
  };

  const toggleCamera = async () => {
    const active = callRef.current;
    const peer = peerRef.current;
    if (!active || !peer || cameraBusyRef.current) return;
    cameraBusyRef.current = true;
    const generation = mediaGenerationRef.current;
    try {
      let addedVideoSender = false;
      if (cameraStreamRef.current) {
        const stream = cameraStreamRef.current;
        await videoSenderRef.current?.replaceTrack(null);
        stream.getTracks().forEach((track) => track.stop());
        if (cameraStreamRef.current === stream) cameraStreamRef.current = null;
        if (generation !== mediaGenerationRef.current) return;
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        setCameraOn(false);
        send('video_apagado', active);
        return;
      } else {
        const stream = await captureMedia({ audio: false, video: true });
        if (generation !== mediaGenerationRef.current || peerRef.current !== peer || callRef.current?.llamada_id !== active.llamada_id) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        cameraStreamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        if (videoSenderRef.current) await videoSenderRef.current.replaceTrack(track);
        else {
          videoSenderRef.current = peer.addTrack(track, stream);
          addedVideoSender = true;
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        setCameraOn(true);
      }
      if (addedVideoSender && peer.remoteDescription && peer.signalingState === 'stable') {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        send('oferta', active, { sdp: offer.sdp, type: offer.type });
      }
    } catch (reason) {
      if (generation === mediaGenerationRef.current && peerRef.current === peer) {
        cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        setCameraOn(false);
        setError(reason.message || 'No se pudo activar la cámara.');
      }
    } finally {
      if (generation === mediaGenerationRef.current) cameraBusyRef.current = false;
    }
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
      <h2>{call.status === 'incoming' ? 'Llamada entrante' : call.status === 'outgoing' ? 'Llamando…' : 'Llamada en curso'}</h2>
      <p>{call.nombre}</p>
      <div className="cf-call-videos"><div className="cf-call-video"><video ref={remoteVideoRef} autoPlay playsInline muted />{!remoteCameraOn && <span>Cámara apagada</span>}</div><div className="cf-call-video"><video ref={localVideoRef} autoPlay playsInline muted />{!cameraOn && <span>Tu cámara apagada</span>}</div></div>
      <div className="cf-call-actions">
        {call.status === 'incoming' && <button type="button" className="accept" onClick={acceptCall}>Contestar</button>}
        {call.status !== 'incoming' && <><button type="button" onClick={toggleMic}>{muted ? 'Activar micrófono' : 'Silenciar micrófono'}</button><button type="button" onClick={toggleCamera}>{cameraOn ? 'Apagar cámara' : 'Compartir cámara'}</button></>}
        <button type="button" className="hangup" onClick={() => endCall()}>Terminar llamada</button>
      </div>
    </section>}
    {error && <div className="cf-call-error" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Cerrar aviso">×</button></div>}
  </div>;
}
