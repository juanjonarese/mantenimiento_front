import { useState } from 'react';

export function useGPS() {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [bloqueado, setBloqueado] = useState(false);

  async function obtenerUbicacion() {
    if (!navigator.geolocation) {
      setError('Tu dispositivo no soporta GPS');
      return null;
    }
    setCargando(true);
    setError(null);
    setBloqueado(false);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCargando(false);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          setCargando(false);
          if (err.code === 1) {
            setBloqueado(true);
            setError('Permiso de ubicación bloqueado');
          } else {
            setError('No se pudo obtener la ubicación: ' + err.message);
          }
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
      );
    });
  }

  return { obtenerUbicacion, cargando, error, bloqueado };
}
