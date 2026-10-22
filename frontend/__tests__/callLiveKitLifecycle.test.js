/** @jest-environment jsdom */
import React from 'react';
import { act, create } from 'react-test-renderer';

import LlamadasRuta from '../src/componentes/llamadas/LlamadasRutaLiveKit.web';

jest.mock('../src/componentes/llamadas/LlamadasRuta.css', () => ({}));
jest.mock('../src/configuracion', () => ({
  API_BASE_URL: 'https://test.example',
  fetchApi: jest.fn(async (url) => ({
    ok: true,
    json: async () => url.endsWith('/contactos')
      ? [{ viaje_id: 'trip-1', nombre: 'Conductor Pruebas', rol: 'conductor' }]
      : { server_url: 'wss://test.livekit.cloud', participant_token: 'test-token' },
  })),
}));
jest.mock('livekit-client', () => {
  const rooms = [];
  class Room {
    constructor() {
      rooms.push(this);
      this.localParticipant = {
        setMicrophoneEnabled: jest.fn(async () => {}),
        setCameraEnabled: jest.fn(async () => {}),
      };
    }
    on = jest.fn();
    connect = jest.fn(async () => {});
    disconnect = jest.fn();
  }
  return { Room, RoomEvent: {}, Track: { Kind: { Audio: 'audio', Video: 'video' } }, __rooms: rooms };
});

const rooms = require('livekit-client').__rooms;
let sockets;

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(global, 'URL', { configurable: true, value: require('url').URL });
  Object.defineProperty(global, 'crypto', { configurable: true, value: { randomUUID: jest.fn(() => `call-${Math.random()}`) } });
  HTMLMediaElement.prototype.play = jest.fn(async () => {});
  HTMLMediaElement.prototype.pause = jest.fn();
  sockets = [];
  rooms.length = 0;
  global.WebSocket = class {
    static OPEN = 1;
    readyState = 1;
    send = jest.fn();
    close = jest.fn();
    constructor() { sockets.push(this); }
  };
});

afterEach(() => { delete global.WebSocket; });

test('consecutive calls use distinct rooms and release the previous room', async () => {
  let view;
  await act(async () => { view = create(<LlamadasRuta token="token" user={{ id: 1, rol: 'coordinador' }} />); });
  await act(async () => { sockets[0].onmessage({ data: JSON.stringify({ tipo: 'listo' }) }); });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await act(async () => { view.root.findByProps({ className: 'cf-call-launch' }).props.onClick(); });
    await act(async () => { await view.root.findByProps({ className: 'cf-call-menu' }).findByType('button').props.onClick(); });
    expect(rooms[attempt].connect).toHaveBeenCalledWith('wss://test.livekit.cloud', 'test-token');
    expect(rooms[attempt].localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
    await act(async () => { view.root.findByProps({ className: 'hangup' }).props.onClick(); });
    expect(rooms[attempt].disconnect).toHaveBeenCalledTimes(1);
  }
  expect(rooms).toHaveLength(2);
  await act(async () => { view.unmount(); });
});
