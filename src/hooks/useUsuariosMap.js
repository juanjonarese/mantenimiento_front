import { useState, useEffect } from 'react';
import { obtenerUsuarios } from '../services/api';

let _cache = null;

export function useUsuariosMap() {
  const [map, setMap] = useState(_cache || new Map());

  useEffect(() => {
    if (_cache) return;
    obtenerUsuarios()
      .then(({ usuarios }) => {
        const m = new Map();
        (usuarios || []).forEach((u) => {
          if (u.email) m.set(u.email, `${u.nombre || ''} ${u.apellido || ''}`.trim());
        });
        _cache = m;
        setMap(m);
      })
      .catch(() => {});
  }, []);

  return (value) => {
    if (!value) return value;
    if (value.includes('@') && map.has(value)) return map.get(value);
    return value;
  };
}
