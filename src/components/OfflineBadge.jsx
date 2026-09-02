import { useState, useEffect } from 'react';
import { useSync } from '../hooks/useSync';

export default function OfflineBadge() {
  const [online, setOnline] = useState(navigator.onLine);
  const { sincronizando, pendientes, ultimaSync, errorSync, sincronizar } = useSync();

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!online) {
    return (
      <div className="alert alert-warning text-center py-2 mb-0 rounded-0 small d-flex align-items-center justify-content-center gap-2">
        <i className="bi bi-wifi-off"></i>
        <span>Sin conexión — los datos se guardan localmente</span>
        {pendientes > 0 && (
          <span className="badge bg-warning text-dark">{pendientes} pendientes</span>
        )}
      </div>
    );
  }

  if (sincronizando) {
    return (
      <div className="alert alert-info text-center py-2 mb-0 rounded-0 small d-flex align-items-center justify-content-center gap-2">
        <span className="spinner-border spinner-border-sm"></span>
        <span>Sincronizando {pendientes} trabajo{pendientes !== 1 ? 's' : ''}...</span>
      </div>
    );
  }

  if (errorSync) {
    return (
      <div className="alert alert-danger text-center py-1 mb-0 rounded-0 small d-flex align-items-center justify-content-center gap-2">
        <i className="bi bi-exclamation-triangle"></i>
        <span>{errorSync}</span>
        <button className="btn btn-sm btn-danger py-0" onClick={sincronizar}>Reintentar</button>
      </div>
    );
  }

  if (pendientes > 0) {
    return (
      <div className="alert alert-warning text-center py-1 mb-0 rounded-0 small d-flex align-items-center justify-content-center gap-2">
        <i className="bi bi-cloud-upload"></i>
        <span>{pendientes} trabajo{pendientes !== 1 ? 's' : ''} sin sincronizar</span>
        <button className="btn btn-sm btn-warning py-0" onClick={sincronizar}>
          Sincronizar ahora
        </button>
      </div>
    );
  }

  if (ultimaSync) {
    return (
      <div className="alert alert-success text-center py-1 mb-0 rounded-0 small d-flex align-items-center justify-content-center gap-2" style={{ fontSize: 11 }}>
        <i className="bi bi-cloud-check"></i>
        <span>
          Sincronizado —{' '}
          {ultimaSync.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    );
  }

  return null;
}
