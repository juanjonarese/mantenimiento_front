import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { obtenerTrabajos, eliminarTrabajo } from '../db/db';
import { COLORES_ESTADO_OP, COLORES_ESTADO_ADMIN } from '../constants';

export default function ListaPage() {
  const [trabajos, setTrabajos] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroCertif, setFiltroCertif] = useState('');

  const cargar = async () => setTrabajos(await obtenerTrabajos());
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

  const tiposLabel = (t) =>
    t.items?.length ? t.items.map((i) => i.tipoTrabajo).join(' + ') : (t.tipoTrabajo || '—');

  return (
    <div className="lista-page">

      {/* ── HEADER ── */}
      <div className="page-header bg-white border-bottom px-3 px-lg-4 py-3">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
          <div>
            <h4 className="fw-bold mb-0">
              <i className="bi bi-list-ul me-2 text-primary"></i>Trabajos
            </h4>
            <small className="text-muted">
              {filtrados.length} de {trabajos.length} trabajo{trabajos.length !== 1 ? 's' : ''}
            </small>
          </div>
          <Link to="/nuevo" className="btn btn-primary d-flex align-items-center gap-2">
            <i className="bi bi-plus-lg"></i>
            <span>Nuevo trabajo</span>
          </Link>
        </div>

        {/* Filtros */}
        <div className="row g-2">
          <div className="col-6 col-md-3">
            <select className="form-select form-select-sm" value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              <option>Sin iniciar</option>
              <option>En proceso</option>
              <option>Terminado</option>
            </select>
          </div>
          <div className="col-6 col-md-3">
            <select className="form-select form-select-sm" value={filtroCertif}
              onChange={(e) => setFiltroCertif(e.target.value)}>
              <option value="">Toda certificación</option>
              <option>Sin certificar</option>
              <option>Certificado</option>
              <option>Rechazado</option>
            </select>
          </div>
        </div>
      </div>

      <div className="container py-3" style={{ maxWidth: 1400 }}>
        {filtrados.length === 0 ? (
          <div className="text-center text-muted py-5">
            <i className="bi bi-inbox display-4"></i>
            <p className="mt-2">No hay trabajos cargados</p>
            <Link to="/nuevo" className="btn btn-primary">Cargar el primero</Link>
          </div>
        ) : (
          <>
            {/* ── MOBILE: cards (oculto en md+) ── */}
            <div className="d-flex flex-column gap-2 d-md-none">
              {filtrados.map((t) => (
                <div key={t.id} className="card">
                  <div className="card-body py-2 px-3">
                    <div className="d-flex justify-content-between align-items-start">
                      <div className="flex-grow-1 me-2">
                        <div className="fw-semibold">{t.calle1} y {t.calle2}</div>
                        <div className="small text-muted mb-1">
                          {tiposLabel(t)} · {t.superficie} m²
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
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleEliminar(t.id)}>
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── DESKTOP: tabla (oculto en mobile) ── */}
            <div className="d-none d-md-block">
              <div className="card border-0 shadow-sm">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Fecha</th>
                        <th>Intersección</th>
                        <th>Tipo</th>
                        <th className="text-end">m²</th>
                        <th>Estado</th>
                        <th>Certif.</th>
                        <th>Sync</th>
                        <th className="text-end">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtrados.map((t) => (
                        <tr key={t.id}>
                          <td className="small text-nowrap text-muted">
                            {new Date(t.fechaCarga).toLocaleString('es-AR', {
                              day: '2-digit', month: '2-digit', year: '2-digit',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </td>
                          <td className="fw-semibold">{t.calle1} y {t.calle2}</td>
                          <td className="small text-muted">{tiposLabel(t)}</td>
                          <td className="text-end fw-bold text-primary">{t.superficie}</td>
                          <td>
                            <span className={`badge bg-${COLORES_ESTADO_OP[t.estadoOperativo]}`}>
                              {t.estadoOperativo}
                            </span>
                          </td>
                          <td>
                            <span className={`badge bg-${COLORES_ESTADO_ADMIN[t.estadoAdmin]}`}>
                              {t.estadoAdmin}
                            </span>
                          </td>
                          <td>
                            {t.sincronizado
                              ? <i className="bi bi-cloud-check text-success"></i>
                              : <i className="bi bi-cloud-slash text-secondary"></i>}
                          </td>
                          <td className="text-end">
                            <div className="d-flex gap-2 justify-content-end">
                              <Link to={`/detalle/${t.id}`} className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1">
                                <i className="bi bi-eye"></i>
                                <span>Ver</span>
                              </Link>
                              <Link to={`/editar/${t.id}`} className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1">
                                <i className="bi bi-pencil"></i>
                                <span>Editar</span>
                              </Link>
                              <button className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
                                onClick={() => handleEliminar(t.id)}>
                                <i className="bi bi-trash"></i>
                                <span>Eliminar</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="table-light">
                      <tr>
                        <td colSpan={3} className="small fw-semibold">Total</td>
                        <td className="text-end fw-bold text-primary">
                          {filtrados.reduce((a, t) => a + (t.superficie || 0), 0).toFixed(1)} m²
                        </td>
                        <td colSpan={4}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
