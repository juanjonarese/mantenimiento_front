import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { obtenerTrabajos, eliminarTrabajo, importarDesdeBackend } from '../db/db';
import { obtenerTrabajosBackend, eliminarTrabajoBackend } from '../services/api';
import { COLORES_ESTADO_OP, COLORES_ESTADO_ADMIN } from '../constants';
import ImportarExcelModal from '../components/ImportarExcelModal';

export default function ListaPage() {
  const esAdmin = localStorage.getItem('rol') === 'admin';

  const [trabajos, setTrabajos] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroCertif, setFiltroCertif] = useState('');
  const [sincronizando, setSincronizando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [mostrarImportar, setMostrarImportar] = useState(false);

  const cargar = async () => {
    setCargando(true);
    if (navigator.onLine) {
      setSincronizando(true);
      try {
        const { trabajos: backendData } = await obtenerTrabajosBackend();
        if (backendData?.length) await importarDesdeBackend(backendData);
      } catch {
        // Sin conexión o error — usa solo el IndexedDB local
      } finally {
        setSincronizando(false);
      }
    }
    setTrabajos(await obtenerTrabajos());
    setCargando(false);
  };

  useEffect(() => { cargar(); }, []);

  async function handleEliminar(t) {
    const { isConfirmed } = await Swal.fire({
      title: '¿Eliminar trabajo?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });
    if (!isConfirmed) return;
    // Borrar del backend primero (usa _id de MongoDB)
    if (t._id) {
      try { await eliminarTrabajoBackend(t._id); } catch { /* sin conexión, solo borra local */ }
    }
    // Borrar del IndexedDB local (usa id = idLocal)
    await eliminarTrabajo(t.id);
    cargar();
  }

  const [pagina, setPagina] = useState(1);
  const POR_PAGINA = 30;

  const filtrados = trabajos.filter((t) => {
    const coincideEstado = !filtroEstado || t.estadoOperativo === filtroEstado;
    const coincideCertif = !filtroCertif || t.estadoAdmin === filtroCertif;
    return coincideEstado && coincideCertif;
  });

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const paginados = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => { setPagina(1); }, [filtroEstado, filtroCertif]);

  // Extrae la superficie de un tipo específico, soporta formato items[] y legacy
  const getSup = (t, tipo) => {
    if (t.items?.length) return t.items.find((i) => i.tipoTrabajo === tipo)?.superficie || 0;
    return t.tipoTrabajo === tipo ? (t.superficie || 0) : 0;
  };

  return (
    <div className="lista-page">

      {/* ── HEADER ── */}
      <div className="page-header bg-white border-bottom px-3 px-lg-4 py-3">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
          <div>
            <h4 className="fw-bold mb-0">
              <i className="bi bi-list-ul me-2 text-primary"></i>Trabajos
              {sincronizando && (
                <span className="spinner-border spinner-border-sm text-primary ms-2" style={{ width: 16, height: 16, borderWidth: 2 }}></span>
              )}
            </h4>
            <small className="text-muted">
              {filtrados.length} de {trabajos.length} trabajo{trabajos.length !== 1 ? 's' : ''}
            </small>
          </div>
          {esAdmin && (
            <div className="d-flex gap-2">
              <button
                className="btn btn-outline-success d-flex align-items-center gap-2"
                onClick={() => setMostrarImportar(true)}
              >
                <i className="bi bi-file-earmark-excel"></i>
                <span className="d-none d-sm-inline">Importar Excel</span>
              </button>
              <Link to="/nuevo" className="btn btn-primary d-flex align-items-center gap-2">
                <i className="bi bi-plus-lg"></i>
                <span>Nuevo trabajo</span>
              </Link>
            </div>
          )}
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
              <option>En revisión</option>
              <option>Certificado</option>
              <option>Rechazado</option>
            </select>
          </div>
        </div>
      </div>

      <div className="container py-3" style={{ maxWidth: 1400 }}>
        {cargando ? (
          <div className="text-center text-muted py-5">
            <div className="spinner-border text-primary mb-3" style={{ width: 40, height: 40 }}></div>
            <p>Cargando trabajos...</p>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center text-muted py-5">
            <i className="bi bi-inbox display-4"></i>
            <p className="mt-2">No hay trabajos cargados</p>
            <Link to="/nuevo" className="btn btn-primary">Cargar el primero</Link>
          </div>
        ) : (
          <>
            {/* ── TOTALES ── */}
            <div className="d-flex gap-3 flex-wrap mb-3 px-1 small text-muted fw-semibold">
              <span>Sendas: <span className="text-primary">{filtrados.reduce((a, t) => a + getSup(t, 'SENDAS'), 0).toFixed(1)} m²</span></span>
              <span>Rampas: <span className="text-primary">{filtrados.reduce((a, t) => a + getSup(t, 'RAMPAS'), 0).toFixed(1)} m²</span></span>
              <span>Cordones: <span className="text-primary">{filtrados.reduce((a, t) => a + getSup(t, 'CORDONES'), 0).toFixed(1)} m²</span></span>
            </div>

            {/* ── CARDS ── */}
            <div className="row g-2">
              {paginados.map((t) => (
                <div key={t.id} className="col-12 col-md-6 col-xl-4">
                  <div className="card h-100">
                    <div className="card-body py-2 px-3">

                      {/* Intersección + fecha */}
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <div className="fw-semibold lh-sm">{t.calle1} y {t.calle2}</div>
                        <span className="small text-muted text-nowrap ms-2">
                          {new Date(t.fechaCarga).toLocaleDateString('es-AR', {
                            day: '2-digit', month: '2-digit', year: '2-digit',
                          })}
                        </span>
                      </div>

                      {/* Superficies */}
                      <div className="d-flex gap-3 flex-wrap mb-2" style={{ fontSize: 12 }}>
                        {getSup(t, 'SENDAS') > 0 && (
                          <span className="text-muted">Sendas <strong>{getSup(t, 'SENDAS').toFixed(1)}</strong> m²</span>
                        )}
                        {getSup(t, 'RAMPAS') > 0 && (
                          <span className="text-muted">Rampas <strong>{getSup(t, 'RAMPAS').toFixed(1)}</strong> m²</span>
                        )}
                        {getSup(t, 'CORDONES') > 0 && (
                          <span className="text-muted">Cordones <strong>{getSup(t, 'CORDONES').toFixed(1)}</strong> m²</span>
                        )}
                      </div>

                      {/* Badges + acciones */}
                      <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
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
                        <div className="d-flex gap-1">
                          <Link to={`/detalle/${t.id}`} className="btn btn-sm btn-outline-primary">
                            <i className="bi bi-eye"></i>
                          </Link>
                          {esAdmin && (<>
                            <Link to={`/editar/${t.id}`} className="btn btn-sm btn-outline-secondary">
                              <i className="bi bi-pencil"></i>
                            </Link>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => handleEliminar(t)}>
                              <i className="bi bi-trash"></i>
                            </button>
                          </>)}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── PAGINADOR ── */}
            {totalPaginas > 1 && (
              <div className="d-flex align-items-center justify-content-between mt-3 px-1 flex-wrap gap-2">
                <span className="small text-muted">
                  Mostrando {(paginaActual - 1) * POR_PAGINA + 1}–{Math.min(paginaActual * POR_PAGINA, filtrados.length)} de {filtrados.length}
                </span>
                <nav>
                  <ul className="pagination pagination-sm mb-0">
                    <li className={`page-item ${paginaActual === 1 ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={() => setPagina(p => p - 1)}>
                        <i className="bi bi-chevron-left"></i>
                      </button>
                    </li>
                    {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                      .filter(n => n === 1 || n === totalPaginas || Math.abs(n - paginaActual) <= 1)
                      .reduce((acc, n, idx, arr) => {
                        if (idx > 0 && n - arr[idx - 1] > 1) acc.push('…');
                        acc.push(n);
                        return acc;
                      }, [])
                      .map((n, i) =>
                        n === '…'
                          ? <li key={`ellipsis-${i}`} className="page-item disabled"><span className="page-link">…</span></li>
                          : <li key={n} className={`page-item ${n === paginaActual ? 'active' : ''}`}>
                              <button className="page-link" onClick={() => setPagina(n)}>{n}</button>
                            </li>
                      )}
                    <li className={`page-item ${paginaActual === totalPaginas ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={() => setPagina(p => p + 1)}>
                        <i className="bi bi-chevron-right"></i>
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            )}
          </>
        )}
      </div>
      {mostrarImportar && (
        <ImportarExcelModal
          onClose={() => setMostrarImportar(false)}
          onImportado={cargar}
        />
      )}
    </div>
  );
}
