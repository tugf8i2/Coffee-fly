/** @jest-environment jsdom */
import React from 'react';
import { act, create } from 'react-test-renderer';

import LlamadasRuta from '../src/componentes/llamadas/LlamadasRutaLegacy.web';

jest.mock('../src/componentes/llamadas/LlamadasRuta.css', () => ({}));
jest.mock('../src/configuracion', () => ({
  API_BASE_URL: 'https://test.example',
  fetchApi: jest.fn(async () => ({ ok: true, json: async () => [{ viaje_id: 'trip-1', nombre: 'Conductor Pruebas', rol: 'conductor' }] })),
}));

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

const stream = (kind = 'audio') => {
  const track = { stop: jest.fn(), kind };
  return { track, getTracks: () => [track], getAudioTracks: () => kind === 'audio' ? [track] : [], getVideoTracks: () => kind === 'video' ? [track] : [] };
};

let sockets;
let peers;

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(global, 'URL', { configurable: true, value: require('url').URL });
  sockets = [];
  peers = [];
  global.WebSocket = class {
    static OPEN = 1;
    readyState = 1;
    send = jest.fn();
    close = jest.fn();
    constructor() { sockets.push(this); }
  };
  global.RTCPeerConnection = class {
    close = jest.fn();
    addTrack = jest.fn();
    constructor(config) { this.config = config; peers.push(this); }
  };
  Object.defineProperty(global.navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: jest.fn() } });
  Object.defineProperty(global, 'crypto', { configurable: true, value: { randomUUID: jest.fn(() => `call-${Math.random()}`) } });
  HTMLMediaElement.prototype.play = jest.fn(async () => {});
  HTMLMediaElement.prototype.pause = jest.fn();
});

afterEach(() => {
  delete global.WebSocket;
  delete global.RTCPeerConnection;
});

test('a late microphone permission result cannot reopen a hung-up call', async () => {
  const capture = deferred();
  navigator.mediaDevices.getUserMedia.mockReturnValue(capture.promise);
  let view;
  await act(async () => { view = create(<LlamadasRuta token="token" user={{ id: 1, rol: 'coordinador' }} />); });
  await act(async () => { sockets[0].onmessage({ data: JSON.stringify({ tipo: 'listo' }) }); });
  await act(async () => { view.root.findByProps({ className: 'cf-call-launch' }).props.onClick(); });
  await act(async () => { view.root.findByProps({ className: 'cf-call-menu' }).findByType('button').props.onClick(); });
  await act(async () => { view.root.findByProps({ className: 'hangup' }).props.onClick(); });
  const lateStream = stream();
  await act(async () => { capture.resolve(lateStream); await capture.promise; });
  expect(lateStream.track.stop).toHaveBeenCalledTimes(1);
  expect(peers).toHaveLength(0);
  expect(view.root.findAllByProps({ className: 'cf-call-dialog' })).toHaveLength(0);
  await act(async () => { view.unmount(); });
});

test('a late camera permission result is released after hanging up', async () => {
  const cameraCapture = deferred();
  navigator.mediaDevices.getUserMedia
    .mockResolvedValueOnce(stream())
    .mockReturnValueOnce(cameraCapture.promise);
  let view;
  await act(async () => { view = create(<LlamadasRuta token="token" user={{ id: 1, rol: 'coordinador' }} />); });
  await act(async () => { sockets[0].onmessage({ data: JSON.stringify({ tipo: 'listo' }) }); });
  await act(async () => { view.root.findByProps({ className: 'cf-call-launch' }).props.onClick(); });
  await act(async () => { view.root.findByProps({ className: 'cf-call-menu' }).findByType('button').props.onClick(); });
  expect(peers).toHaveLength(1);
  expect(peers[0].config.iceServers).toContainEqual({ urls: 'stun:stun.cloudflare.com:3478' });
  await act(async () => {
    view.root.findAllByType('button').find((button) => button.props.children === 'Compartir cámara').props.onClick();
  });
  await act(async () => { view.root.findByProps({ className: 'hangup' }).props.onClick(); });
  const lateStream = stream('video');
  await act(async () => { cameraCapture.resolve(lateStream); await cameraCapture.promise; });
  expect(lateStream.track.stop).toHaveBeenCalledTimes(1);
  expect(peers[0].close).toHaveBeenCalledTimes(1);
  await act(async () => { view.unmount(); });
});

test('a delayed duplicate answer is ignored after signaling becomes stable', async () => {
  navigator.mediaDevices.getUserMedia.mockResolvedValue(stream());
  let view;
  await act(async () => { view = create(<LlamadasRuta token="token" user={{ id: 1, rol: 'coordinador' }} />); });
  await act(async () => { sockets[0].onmessage({ data: JSON.stringify({ tipo: 'listo' }) }); });
  await act(async () => { view.root.findByProps({ className: 'cf-call-launch' }).props.onClick(); });
  await act(async () => { view.root.findByProps({ className: 'cf-call-menu' }).findByType('button').props.onClick(); });
  const invitation = sockets[0].send.mock.calls.map(([value]) => JSON.parse(value)).find((value) => value.tipo === 'invitar');
  const peer = peers[0];
  peer.signalingState = 'have-local-offer';
  peer.setRemoteDescription = jest.fn(async () => { peer.signalingState = 'stable'; });
  const answer = { tipo: 'respuesta', viaje_id: invitation.viaje_id, llamada_id: invitation.llamada_id, contenido: { sdp: 'answer' } };
  await act(async () => {
    sockets[0].onmessage({ data: JSON.stringify(answer) });
    sockets[0].onmessage({ data: JSON.stringify(answer) });
    await Promise.resolve();
  });
  expect(peer.setRemoteDescription).toHaveBeenCalledTimes(1);
  expect(view.root.findAllByProps({ className: 'cf-call-error' })).toHaveLength(0);
  await act(async () => { view.unmount(); });
});
