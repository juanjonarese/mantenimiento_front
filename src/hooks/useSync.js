import { useState, useEffect, useCallback } from 'react';
import { obtenerNoSincronizados, marcarTodosSincronizados } from '../db/db';
import { sincronizarTrabajos } from '../services/api';

export function useSync() {
  const [sincronizando, setSincronizando] = useState(false);
  const [pendientes, setPendientes] = useState(0);
  const [ultimaSync, setUltimaSync] = useState(null);
  const [errorSync, setErrorSync] = useState(null);

  const contarPendientes = useCallback(async () => {
    const items = await obtenerNoSincronizados();
    setPendientes(items.length);
  }, []);

  const sincronizar = useCallback(async () => {
    if (!navigator.onLine || sincronizando) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    const pendientesData = await obtenerNoSincronizados();
    if (pendientesData.length === 0) return;

    setSincronizando(true);
    setErrorSync(null);

    try {
      const usuarioEmail = localStorage.getItem("email") || "";
      const payload = pendientesData.map((t) => ({
        idLocal: t.id,
        fechaCarga: t.fechaCarga,
        fechaModificacion: t.fechaModificacion,
        usuario: t.usuario || usuarioEmail,
        lat: t.lat,
        lng: t.lng,
        calle1: t.calle1,
        calle2: t.calle2,
        items: t.items || [],
        materiales: t.materiales || [],
        superficie: t.superficie,
        estadoOperativo: t.estadoOperativo,
        estadoAdmin: t.estadoAdmin,
        motivoRechazo: t.motivoRechazo,
        documentacionCertificacion: t.documentacionCertificacion,
        notasCertificacion: t.notasCertificacion,
        fechaCertificacion: t.fechaCertificacion,
        observaciones: t.observaciones,
        linkDrive: t.linkDrive,
        linkMyMaps: t.linkMyMaps,
        fotos: (t.fotos || []).map(({ nombre, tipo, driveUrl, subido }) => ({
          nombre, tipo, driveUrl: driveUrl || null, subido: subido || false,
        })),
        cantFotos: t.fotos?.length || 0,
      }));

      await sincronizarTrabajos(payload);
      await marcarTodosSincronizados(pendientesData.map((t) => t.id));
      setPendientes(0);
      setUltimaSync(new Date());
    } catch (err) {
      setErrorSync('Error al sincronizar. Se reintentará automáticamente.');
      console.error('Error sync:', err);
    } finally {
      setSincronizando(false);
    }
  }, [sincronizando]);

  // Sync automático cuando vuelve la conexión
  useEffect(() => {
    contarPendientes();
    window.addEventListener('online', sincronizar);
    return () => window.removeEventListener('online', sincronizar);
  }, [sincronizar, contarPendientes]);

  // Sync al iniciar si hay conexión y hay pendientes
  useEffect(() => {
    if (navigator.onLine) {
      sincronizar();
    }
  }, []);

  return { sincronizando, pendientes, ultimaSync, errorSync, sincronizar, contarPendientes };
}
