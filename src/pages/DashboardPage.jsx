import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { obtenerTrabajos } from '../db/db';

export default function DashboardPage() {
  const email = localStorage.getItem('email') || '';
  const nombreCorto = email.split('@')[0];
  const [stats, setStats] = useState({
    total: 0,
    finalizados: 0,
    enProceso: 0,
    superficie: 0,
    pendientesSync: 0,
  });

  useEffect(() => {
    obtenerTrabajos().then((trabajos) => {
      setStats({
        total: trabajos.length,
        finalizados: trabajos.filter((t) => t.estadoOperativo === 'Finalizado').length,
        enProceso: trabajos.filter((t) => t.estadoOperativo === 'En proceso').length,
        superficie: trabajos.reduce((acc, t) => acc + (t.superficie || 0), 0),
        pendientesSync: trabajos.filter((t) => !t.sincronizado).length,
      });
    });
  }, []);

  return (
    <div className="container-fluid p-3">
      <div className="mb-3">
        <h5 className="fw-bold mb-0">Hola, {nombreCorto}</h5>
        <small className="text-muted">
          {new Date().toLocaleDateString('es-AR', {
            weekday: 'long', day: 'numeric', month: 'long',
          })}
        </small>
      </div>

      {stats.pendientesSync > 0 && (
        <div className="alert alert-warning d-flex align-items-center gap-2 py-2 small">
          <i className="bi bi-cloud-upload"></i>
          <span>
            {stats.pendientesSync} trabajo{stats.pendientesSync > 1 ? 's' : ''} pendiente
            {stats.pendientesSync > 1 ? 's' : ''} de sincronizar
          </span>
        </div>
      )}

      <div className="row g-3 mb-4">
        <div className="col-6">
          <div className="card text-center border-0 bg-primary bg-opacity-10">
            <div className="card-body py-3">
              <div className="display-6 fw-bold text-primary">{stats.total}</div>
              <div className="small text-muted">Total trabajos</div>
            </div>
          </div>
        </div>
        <div className="col-6">
          <div className="card text-center border-0 bg-success bg-opacity-10">
            <div className="card-body py-3">
              <div className="display-6 fw-bold text-success">{stats.finalizados}</div>
              <div className="small text-muted">Finalizados</div>
            </div>
          </div>
        </div>
        <div className="col-6">
          <div className="card text-center border-0 bg-warning bg-opacity-10">
            <div className="card-body py-3">
              <div className="display-6 fw-bold text-warning">{stats.enProceso}</div>
              <div className="small text-muted">En proceso</div>
            </div>
          </div>
        </div>
        <div className="col-6">
          <div className="card text-center border-0 bg-info bg-opacity-10">
            <div className="card-body py-3">
              <div className="display-6 fw-bold text-info">{stats.superficie.toFixed(1)}</div>
              <div className="small text-muted">m² total</div>
            </div>
          </div>
        </div>
      </div>

      <div className="d-flex flex-column flex-sm-row gap-2">
        <Link to="/nuevo" className="btn btn-primary btn-lg flex-sm-fill">
          <i className="bi bi-plus-circle me-2"></i>Cargar nuevo trabajo
        </Link>
        <Link to="/lista" className="btn btn-outline-secondary btn-lg flex-sm-fill">
          <i className="bi bi-list-ul me-2"></i>Ver trabajos
        </Link>
      </div>
    </div>
  );
}
