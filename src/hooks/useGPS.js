import { useState } from 'react';

function pedirPosicion(opciones) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, opciones);
  });
}

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

    try {
      // Primero intenta con ubicación de red (rápido: 1-2 segundos)
      const pos = await pedirPosicion({
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 300000,
      });
      setCargando(false);
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch (errRed) {
      if (errRed.code === 1) {
        // Permiso denegado — no vale la pena intentar alta precisión
        setCargando(false);
        setBloqueado(true);
        setError('Permiso de ubicación bloqueado');
        return null;
      }
      // Si falla la red, intenta GPS de alta precisión como fallback
      try {
        const pos = await pedirPosicion({
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        });
        setCargando(false);
        return { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch (errGPS) {
        setCargando(false);
        if (errGPS.code === 1) {
          setBloqueado(true);
          setError('Permiso de ubicación bloqueado');
        } else {
          setError('No se pudo obtener la ubicación');
        }
        return null;
      }
    }
  }

  return { obtenerUbicacion, cargando, error, bloqueado };
}
