import { useState } from 'react';

export function useGPS() {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  async function obtenerUbicacion() {
    if (!navigator.geolocation) {
      setError('Tu dispositivo no soporta GPS');
      return null;
    }
    setCargando(true);
    setError(null);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCargando(false);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          setCargando(false);
          setError('No se pudo obtener la ubicación: ' + err.message);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  return { obtenerUbicacion, cargando, error };
}
