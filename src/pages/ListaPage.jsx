import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { obtenerTrabajos, eliminarTrabajo, importarDesdeBackend } from '../db/db';
import { obtenerTrabajosBackend, eliminarTrabajoBackend } from '../services/api';
import { COLORES_ESTADO_OP, COLORES_ESTADO_ADMIN } from '../constants';
import ImportarExcelModal from '../components/ImportarExcelModal';
import EditarTrabajoModal from '../components/EditarTrabajoModal';

export default function ListaPage() {
  const rol = localStorage.getItem('rol');
  const esAdmin = rol === 'admin';
  const esCliente = rol === 'cliente';
  const clientePropio = localStorage.getItem('clienteNombre') || '';

  const [trabajos, setTrabajos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroCertif, setFiltroCertif] = useState('');
  const [filtroCliente, setFiltroCliente] = useState(() =>
    localStorage.getItem('rol') === 'cliente' ? (localStorage.getItem('clienteNombre') || '') : ''
  );
  const [sincronizando, setSincronizando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [mostrarImportar, setMostrarImportar] = useState(false);
  const [trabajoEditar, setTrabajoEditar] = useState(null);

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
    const q = busqueda.toLowerCase().trim();
    const coincideBusqueda = !q ||
      (t.calle1 || '').toLowerCase().includes(q) ||
      (t.calle2 || '').toLowerCase().includes(q);
    const coincideEstado = !filtroEstado || t.estadoOperativo === filtroEstado;
    const coincideCertif = !filtroCertif || t.estadoAdmin === filtroCertif;
    const coincideCliente = !filtroCliente || t.clienteNombre === filtroCliente;
    return coincideBusqueda && coincideEstado && coincideCertif && coincideCliente;
  });

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const paginados = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => { setPagina(1); }, [busqueda, filtroEstado, filtroCertif, filtroCliente]);

  // Extrae la superficie de un tipo específico, soporta formato items[] y legacy
  const getSup = (t, tipo) => {
    if (t.items?.length) return t.items.find((i) => i.tipoTrabajo === tipo)?.superficie || 0;
    return t.tipoTrabajo === tipo ? (t.superficie || 0) : 0;
  };

  // Extrae cantidad de un material por nombre (búsqueda parcial, sin importar mayúsculas)
  const getMat = (t, nombre) => {
    const n = nombre.toLowerCase();
    return t.materiales?.find((m) => m.nombre?.toLowerCase().includes(n))?.cantidad || 0;
  };

  function exportarExcel() {
    const filas = filtrados.map((t) => ({
      'Fecha':              new Date(t.fechaCarga).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      'Calle 1':            t.calle1,
      'Calle 2':            t.calle2,
      'Sendas m²':          getSup(t, 'SENDAS')   || '',
      'Rampas m²':          getSup(t, 'RAMPAS')   || '',
      'Cordones m²':        getSup(t, 'CORDONES') || '',
      'Sup. total m²':      t.superficie || '',
      'B. Termoplástica':   getMat(t, 'termoplást') || '',
      'B. Microesferas':    getMat(t, 'microesfera') || '',
      'Imprimación (l)':    getMat(t, 'imprimac')    || '',
      'Pintura Acrílica (l)': getMat(t, 'acrílica') || '',
      'Estado operativo':   t.estadoOperativo,
      'Certificación':      t.estadoAdmin,
      'Usuario':            t.usuario || '',
      'Observaciones':      t.observaciones || '',
      'Latitud':            t.lat || '',
      'Longitud':           t.lng || '',
    }));
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Trabajos');
    XLSX.writeFile(wb, `trabajos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

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
                onClick={exportarExcel}
                disabled={filtrados.length === 0}
                title="Exportar lista actual a Excel"
              >
                <i className="bi bi-download"></i>
                <span className="d-none d-sm-inline">Exportar Excel</span>
              </button>
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
          {esCliente && clientePropio && (
            <span className="badge bg-primary fs-6 px-3 py-2">
              <i className="bi bi-person-vcard me-1"></i>{clientePropio}
            </span>
          )}
        </div>

        {/* Filtros */}
        <div className="row g-2">
          <div className="col-12 col-md-6">
            <div className="input-group input-group-sm">
              <span className="input-group-text"><i className="bi bi-search"></i></span>
              <input
                type="text"
                className="form-control"
                placeholder="Buscar por calle..."
                value={busqueda}
                onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
              />
              {busqueda && (
                <button className="btn btn-outline-secondary" onClick={() => setBusqueda('')}>
                  <i className="bi bi-x"></i>
                </button>
              )}
            </div>
          </div>
          <div className="col-6 col-md-2">
            <select className="form-select form-select-sm" value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              <option>Sin iniciar</option>
              <option>En proceso</option>
              <option>Terminado</option>
            </select>
          </div>
          <div className="col-6 col-md-2">
            <select className="form-select form-select-sm" value={filtroCertif}
              onChange={(e) => setFiltroCertif(e.target.value)}>
              <option value="">Toda certificación</option>
              <option>Sin certificar</option>
              <option>En revisión</option>
              <option>Certificado</option>
              <option>Rechazado</option>
            </select>
          </div>
          {!esCliente && (
            <div className="col-6 col-md-2">
              <select className="form-select form-select-sm" value={filtroCliente}
                onChange={(e) => { setFiltroCliente(e.target.value); setPagina(1); }}>
                <option value="">Todos los clientes</option>
                {[...new Set(trabajos.map((t) => t.clienteNombre).filter(Boolean))].sort().map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
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

            {/* ── CARDS (mobile) ── */}
            <div className="d-md-none row g-2">
              {paginados.map((t) => (
                <div key={t.id} className="col-12">
                  <div className="card">
                    <div className="card-body py-2 px-3">
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <div className="fw-semibold lh-sm">{t.calle1} y {t.calle2}</div>
                        <span className="small text-muted text-nowrap ms-2">
                          {new Date(t.fechaCarga).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </span>
                      </div>
                      <div className="d-flex gap-3 flex-wrap mb-2" style={{ fontSize: 12 }}>
                        {getSup(t, 'SENDAS')   > 0 && <span className="text-muted">Sendas <strong>{getSup(t, 'SENDAS').toFixed(1)}</strong> m²</span>}
                        {getSup(t, 'RAMPAS')   > 0 && <span className="text-muted">Rampas <strong>{getSup(t, 'RAMPAS').toFixed(1)}</strong> m²</span>}
                        {getSup(t, 'CORDONES') > 0 && <span className="text-muted">Cordones <strong>{getSup(t, 'CORDONES').toFixed(1)}</strong> m²</span>}
                      </div>
                      {/* Materiales: solo visible para admin/supervisor */}
                      <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                        <div className="d-flex gap-1 flex-wrap">
                          <span className={`badge bg-${COLORES_ESTADO_OP[t.estadoOperativo]}`}>{t.estadoOperativo}</span>
                          <span className={`badge bg-${COLORES_ESTADO_ADMIN[t.estadoAdmin]}`}>{t.estadoAdmin}</span>
                        </div>
                        <div className="d-flex gap-1">
                          <Link to={`/detalle/${t.id}`} className="btn btn-sm btn-outline-primary"><i className="bi bi-eye"></i></Link>
                          {esAdmin && (<>
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => setTrabajoEditar(t)}><i className="bi bi-pencil"></i></button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => handleEliminar(t)}><i className="bi bi-trash"></i></button>
                          </>)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── TABLA (desktop) ── */}
            <div className="d-none d-md-block">
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                  <thead className="table-light">
                    <tr>
                      <th>Fecha</th>
                      <th>Intersección</th>
                      <th className="text-end">Sendas m²</th>
                      <th className="text-end">Rampas m²</th>
                      <th className="text-end">Cordones m²</th>
                      {!esCliente && <><th className="text-end">B.Termo</th><th className="text-end">B.Micro</th><th className="text-end">Imprim. l</th><th className="text-end">P.Acrílica l</th></>}
                      <th>Estado</th>
                      <th>Certificación</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginados.map((t) => (
                      <tr key={t.id}>
                        <td className="text-nowrap text-muted" style={{ fontSize: 12 }}>
                          {new Date(t.fechaCarga).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </td>
                        <td className="fw-semibold">{t.calle1} y {t.calle2}</td>
                        <td className="text-end">{getSup(t, 'SENDAS') > 0 ? getSup(t, 'SENDAS').toFixed(1) : <span className="text-muted">—</span>}</td>
                        <td className="text-end">{getSup(t, 'RAMPAS') > 0 ? getSup(t, 'RAMPAS').toFixed(1) : <span className="text-muted">—</span>}</td>
                        <td className="text-end">{getSup(t, 'CORDONES') > 0 ? getSup(t, 'CORDONES').toFixed(1) : <span className="text-muted">—</span>}</td>
                        {!esCliente && <><td className="text-end">{getMat(t, 'termoplást') > 0 ? getMat(t, 'termoplást').toFixed(1) : <span className="text-muted">—</span>}</td><td className="text-end">{getMat(t, 'microesfera') > 0 ? getMat(t, 'microesfera').toFixed(1) : <span className="text-muted">—</span>}</td><td className="text-end">{getMat(t, 'imprimac') > 0 ? getMat(t, 'imprimac').toFixed(1) : <span className="text-muted">—</span>}</td><td className="text-end">{getMat(t, 'acrílica') > 0 ? getMat(t, 'acrílica').toFixed(1) : <span className="text-muted">—</span>}</td></>}
                        <td><span className={`badge bg-${COLORES_ESTADO_OP[t.estadoOperativo]}`}>{t.estadoOperativo}</span></td>
                        <td><span className={`badge bg-${COLORES_ESTADO_ADMIN[t.estadoAdmin]}`}>{t.estadoAdmin}</span></td>
                        <td>
                          <div className="d-flex gap-1 justify-content-end">
                            <Link to={`/detalle/${t.id}`} className="btn btn-sm btn-outline-primary"><i className="bi bi-eye"></i></Link>
                            {esAdmin && (<>
                              <button className="btn btn-sm btn-outline-secondary" onClick={() => setTrabajoEditar(t)}><i className="bi bi-pencil"></i></button>
                              <button className="btn btn-sm btn-outline-danger" onClick={() => handleEliminar(t)}><i className="bi bi-trash"></i></button>
                            </>)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="table-light fw-semibold" style={{ fontSize: 12 }}>
                    <tr>
                      <td colSpan={2}>Total ({filtrados.length})</td>
                      <td className="text-end">{filtrados.reduce((a, t) => a + getSup(t, 'SENDAS'), 0).toFixed(1)}</td>
                      <td className="text-end">{filtrados.reduce((a, t) => a + getSup(t, 'RAMPAS'), 0).toFixed(1)}</td>
                      <td className="text-end">{filtrados.reduce((a, t) => a + getSup(t, 'CORDONES'), 0).toFixed(1)}</td>
                      {!esCliente && <><td className="text-end">{filtrados.reduce((a, t) => a + getMat(t, 'termoplást'), 0).toFixed(1)}</td><td className="text-end">{filtrados.reduce((a, t) => a + getMat(t, 'microesfera'), 0).toFixed(1)}</td><td className="text-end">{filtrados.reduce((a, t) => a + getMat(t, 'imprimac'), 0).toFixed(1)}</td><td className="text-end">{filtrados.reduce((a, t) => a + getMat(t, 'acrílica'), 0).toFixed(1)}</td></>}
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
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
      {trabajoEditar && (
        <EditarTrabajoModal
          trabajo={trabajoEditar}
          onClose={() => setTrabajoEditar(null)}
          onGuardado={cargar}
        />
      )}
    </div>
  );
}
