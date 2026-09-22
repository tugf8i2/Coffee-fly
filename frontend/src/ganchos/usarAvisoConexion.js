import { useEffect, useRef, useState } from 'react';

const availability = (status) => status === 'online' ? 'online'
  : status === 'offline' || status === 'server_unreachable' ? 'offline' : null;

export default function usarAvisoConexion(status) {
  const previous = useRef(null);
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    const next = availability(status);
    if (!next) return;
    if (next !== previous.current && (previous.current || next === 'offline')) {
      setNotice({ kind: next, seconds: 3 });
    }
    previous.current = next;
  }, [status]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => {
      setNotice((current) => current?.seconds > 1
        ? { ...current, seconds: current.seconds - 1 }
        : null);
    }, 1000);
    return () => clearTimeout(timer);
  }, [notice]);
  return notice;
}
