import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { obtenerTrabajos, eliminarTrabajo } from '../db/db';
import { COLORES_ESTADO_OP, COLORES_ESTADO_ADMIN } from '../constants';

export default function ListaPage() {
  const [trabajos, setTrabajos] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroCertif, setFiltroCertif] = useState('');

  async function cargar() {
    setTrabajos(await obtenerTrabajos());
  }

  useEffect(() => { cargar(); }, []);

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar este trabajo?')) return;
    await eliminarTrabajo(id);
    cargar();
  }

  const filtrados = trabajos.filter((t) => {
    const coincideEstado = !filtroEstado || t.estadoOperativo === filtroEstado;
    const coincideCertif = !filtroCertif || t.estadoAdmin === filtroCertif;
    return coincideEstado && coincideCertif;
  });

  return (
    <div className="container-fluid p-3 pb-5">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold mb-0">
          <i className="bi bi-list-ul me-2 text-primary"></i>Trabajos
        </h5>
        <span className="badge bg-secondary">{filtrados.length} / {trabajos.length}</span>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-6">
          <select className="form-select form-select-sm" value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option>Sin iniciar</option>
            <option>En proceso</option>
            <option>Finalizado</option>
          </select>
        </div>
        <div className="col-6">
          <select className="form-select form-select-sm" value={filtroCertif}
            onChange={(e) => setFiltroCertif(e.target.value)}>
            <option value="">Toda certificación</option>
            <option>Sin certificar</option>
            <option>Certificado</option>
          </select>
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="text-center text-muted py-5">
          <i className="bi bi-inbox display-4"></i>
          <p className="mt-2">No hay trabajos cargados</p>
          <Link to="/nuevo" className="btn btn-primary">Cargar el primero</Link>
        </div>
      ) : (
        <div className="d-flex flex-column gap-2">
          {filtrados.map((t) => (
            <div key={t.id} className="card">
              <div className="card-body py-2 px-3">
                <div className="d-flex justify-content-between align-items-start">
                  <div className="flex-grow-1 me-2">
                    <div className="fw-semibold">{t.calle1} y {t.calle2}</div>
                    <div className="small text-muted mb-1">
                      {t.items ? t.items.map((i) => i.tipoTrabajo).join(' + ') : t.tipoTrabajo} · {t.superficie} m²
                    </div>
                    <div className="small text-muted mb-2">
                      {new Date(t.fechaCarga).toLocaleString('es-AR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                    <div className="d-flex gap-1 flex-wrap">
                      <span className={`badge bg-${COLORES_ESTADO_OP[t.estadoOperativo]}`}>
                        {t.estadoOperativo}
                      </span>
                      <span className={`badge bg-${COLORES_ESTADO_ADMIN[t.estadoAdmin]}`}>
                        {t.estadoAdmin}
                      </span>
                      {!t.sincronizado && (
                        <span className="badge bg-secondary">
                          <i className="bi bi-cloud-slash me-1"></i>local
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="d-flex flex-column gap-1">
                    <Link to={`/detalle/${t.id}`} className="btn btn-sm btn-outline-primary">
                      <i className="bi bi-eye"></i>
                    </Link>
                    <Link to={`/editar/${t.id}`} className="btn btn-sm btn-outline-secondary">
                      <i className="bi bi-pencil"></i>
                    </Link>
                    <button className="btn btn-sm btn-outline-danger"
                      onClick={() => handleEliminar(t.id)}>
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
