import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import * as XLSX from 'xlsx';
import { obtenerTrabajosBackend, obtenerEstadisticas } from '../services/api';
import { TIPOS_TRABAJO, COLORES_ESTADO_OP, COLORES_ESTADO_ADMIN } from '../constants';

const COLOR_PIN = {
  'Certificado': '#0d6efd',
  'Terminado':   '#198754',
  'En proceso':  '#ffc107',
  'Sin iniciar': '#dc3545',
};

const COLORES_PIE = ['#0d6efd','#198754','#ffc107','#dc3545','#6f42c1','#0dcaf0','#fd7e14','#6c757d'];

function getPinColor(t) {
  if (t.estadoAdmin === 'Certificado') return COLOR_PIN['Certificado'];
  if (t.estadoOperativo === 'Terminado' || t.estadoOperativo === 'Finalizado') return COLOR_PIN['Terminado'];
  if (t.estadoOperativo === 'En proceso') return COLOR_PIN['En proceso'];
  return COLOR_PIN['Sin iniciar'];
}

function StatCard({ label, value, sub, color = 'primary', icon }) {
  return (
    <div className="col-6 col-md-4 col-lg-2">
      <div className={`card border-0 h-100`} style={{ borderLeft: `4px solid var(--bs-${color})` }}>
        <div className="card-body py-3 px-3">
          <div className="d-flex align-items-center gap-2 mb-1">
            <i className={`bi bi-${icon} text-${color}`}></i>
            <span className="small text-muted">{label}</span>
          </div>
          <div className={`fw-bold fs-4 text-${color}`}>{value}</div>
          {sub && <div className="small text-muted">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

export default function PanelPage() {
  const [trabajos, setTrabajos] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [pagina, setPagina] = useState(1);
  const POR_PAGINA = 15;

  const [filtros, setFiltros] = useState({
    desde: '', hasta: '', usuario: '', tipoTrabajo: '',
    estadoOperativo: '', estadoAdmin: '',
  });

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== ''));
      const [{ trabajos: t }, { estadisticas: e }] = await Promise.all([
        obtenerTrabajosBackend(params),
        obtenerEstadisticas(),
      ]);
      setTrabajos(t || []);
      setEstadisticas(e || null);
      setPagina(1);
    } catch {
      setError('No se pudo conectar con el servidor. Verificá que el backend esté activo.');
    } finally {
      setCargando(false);
    }
  }, [filtros]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Datos para gráficos ──
  const porDia = (() => {
    const mapa = {};
    trabajos.forEach((t) => {
      const dia = new Date(t.fechaCarga).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
      mapa[dia] = (mapa[dia] || 0) + 1;
    });
    return Object.entries(mapa).slice(-20).map(([fecha, cantidad]) => ({ fecha, cantidad }));
  })();

  const porTipo = TIPOS_TRABAJO.map((tipo) => ({
    name: tipo,
    value: trabajos.filter((t) =>
      t.items ? t.items.some((i) => i.tipoTrabajo === tipo) : t.tipoTrabajo === tipo
    ).length,
  })).filter((d) => d.value > 0);

  const porEstado = [
    { name: 'Sin iniciar', value: trabajos.filter((t) => t.estadoOperativo === 'Sin iniciar').length, color: '#dc3545' },
    { name: 'En proceso',  value: trabajos.filter((t) => t.estadoOperativo === 'En proceso').length,  color: '#ffc107' },
    { name: 'Finalizado',  value: trabajos.filter((t) => t.estadoOperativo === 'Finalizado').length,  color: '#198754' },
  ].filter((d) => d.value > 0);

  // ── Paginación ──
  const totalPaginas = Math.ceil(trabajos.length / POR_PAGINA);
  const trabajosPagina = trabajos.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  // ── Usuarios únicos para filtro ──
  const usuarios = [...new Set(trabajos.map((t) => t.usuario))].sort();

  // ── Export Excel ──
  function exportarExcel() {
    const filas = trabajos.map((t) => ({
      Fecha: new Date(t.fechaCarga).toLocaleString('es-AR'),
      Usuario: t.usuario,
      'Calle 1': t.calle1,
      'Calle 2': t.calle2,
      Tipos: t.items ? t.items.map((i) => i.tipoTrabajo).join(', ') : (t.tipoTrabajo || ''),
      'Superficie (m²)': t.superficie,
      'Estado operativo': t.estadoOperativo,
      Certificación: t.estadoAdmin,
      Materiales: t.materiales?.map((m) => `${m.nombre}: ${m.cantidad} ${m.unidad}`).join(' | ') || '',
      Latitud: t.lat,
      Longitud: t.lng,
      Observaciones: t.observaciones || '',
      'Link Drive': t.linkDrive || '',
      'Link MyMaps': t.linkMyMaps || '',
    }));
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Trabajos');
    XLSX.writeFile(wb, `trabajos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function handleFiltro(e) {
    setFiltros((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function limpiarFiltros() {
    setFiltros({ desde: '', hasta: '', usuario: '', tipoTrabajo: '', estadoOperativo: '', estadoAdmin: '' });
  }

  const hayFiltros = Object.values(filtros).some((v) => v !== '');
  const superficieTotal = trabajos.reduce((acc, t) => acc + (t.superficie || 0), 0);

  return (
    <div className="panel-page">

      {/* ── HEADER ── */}
      <div className="panel-header border-bottom bg-white px-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h4 className="fw-bold mb-0">
            <i className="bi bi-bar-chart-line me-2 text-primary"></i>Panel de gestión
          </h4>
          <small className="text-muted">Vista de administración y supervisión</small>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-success btn-sm" onClick={exportarExcel} disabled={trabajos.length === 0}>
            <i className="bi bi-file-earmark-excel me-1"></i>Exportar Excel
          </button>
          <button className="btn btn-outline-secondary btn-sm" onClick={() => window.print()}>
            <i className="bi bi-printer me-1"></i>Imprimir / PDF
          </button>
          <button className="btn btn-outline-primary btn-sm" onClick={cargar} disabled={cargando}>
            <i className={`bi bi-arrow-clockwise me-1 ${cargando ? 'spin' : ''}`}></i>Actualizar
          </button>
        </div>
      </div>

      <div className="container-fluid px-3 px-lg-4 py-3">

        {error && (
          <div className="alert alert-warning d-flex align-items-center gap-2">
            <i className="bi bi-info-circle-fill"></i>
            <div>
              <strong>Panel no disponible sin sesión activa.</strong>
              <span className="ms-1 small">Iniciá sesión para ver los datos del servidor.</span>
            </div>
          </div>
        )}

        {/* ── FILTROS ── */}
        <div className="card mb-4">
          <div className="card-header fw-semibold small d-flex justify-content-between align-items-center">
            <span><i className="bi bi-funnel me-1"></i>Filtros</span>
            {hayFiltros && (
              <button className="btn btn-sm btn-outline-secondary py-0" onClick={limpiarFiltros}>
                <i className="bi bi-x me-1"></i>Limpiar
              </button>
            )}
          </div>
          <div className="card-body">
            <div className="row g-2">
              <div className="col-6 col-md-3 col-lg-2">
                <label className="form-label small fw-semibold mb-1">Desde</label>
                <input type="date" className="form-control form-control-sm" name="desde"
                  value={filtros.desde} onChange={handleFiltro} />
              </div>
              <div className="col-6 col-md-3 col-lg-2">
                <label className="form-label small fw-semibold mb-1">Hasta</label>
                <input type="date" className="form-control form-control-sm" name="hasta"
                  value={filtros.hasta} onChange={handleFiltro} />
              </div>
              <div className="col-6 col-md-3 col-lg-2">
                <label className="form-label small fw-semibold mb-1">Usuario</label>
                <select className="form-select form-select-sm" name="usuario"
                  value={filtros.usuario} onChange={handleFiltro}>
                  <option value="">Todos</option>
                  {usuarios.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="col-6 col-md-3 col-lg-2">
                <label className="form-label small fw-semibold mb-1">Tipo</label>
                <select className="form-select form-select-sm" name="tipoTrabajo"
                  value={filtros.tipoTrabajo} onChange={handleFiltro}>
                  <option value="">Todos</option>
                  {TIPOS_TRABAJO.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-6 col-md-3 col-lg-2">
                <label className="form-label small fw-semibold mb-1">Estado op.</label>
                <select className="form-select form-select-sm" name="estadoOperativo"
                  value={filtros.estadoOperativo} onChange={handleFiltro}>
                  <option value="">Todos</option>
                  <option>Sin iniciar</option>
                  <option>En proceso</option>
                  <option>Finalizado</option>
                </select>
              </div>
              <div className="col-6 col-md-3 col-lg-2">
                <label className="form-label small fw-semibold mb-1">Certificación</label>
                <select className="form-select form-select-sm" name="estadoAdmin"
                  value={filtros.estadoAdmin} onChange={handleFiltro}>
                  <option value="">Todas</option>
                  <option>Sin certificar</option>
                  <option>Certificado</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── STATS ── */}
        <div className="row g-3 mb-4">
          <StatCard label="Total trabajos" value={trabajos.length} icon="collection" color="primary" />
          <StatCard label="Superficie total" value={`${superficieTotal.toFixed(0)} m²`} icon="rulers" color="info" />
          <StatCard label="Finalizados" value={trabajos.filter((t) => t.estadoOperativo === 'Finalizado').length} icon="check-circle" color="success" />
          <StatCard label="En proceso" value={trabajos.filter((t) => t.estadoOperativo === 'En proceso').length} icon="hourglass-split" color="warning" />
          <StatCard label="Sin iniciar" value={trabajos.filter((t) => t.estadoOperativo === 'Sin iniciar').length} icon="pause-circle" color="danger" />
          <StatCard label="Certificados" value={trabajos.filter((t) => t.estadoAdmin === 'Certificado').length} icon="patch-check" color="primary"
            sub={`${trabajos.filter((t) => t.estadoAdmin !== 'Certificado').length} sin certificar`} />
        </div>

        {/* ── GRÁFICOS ── */}
        <div className="row g-3 mb-4">
          <div className="col-12 col-lg-6">
            <div className="card h-100">
              <div className="card-header fw-semibold small">
                <i className="bi bi-bar-chart me-1"></i>Trabajos por día (últimos registros)
              </div>
              <div className="card-body">
                {porDia.length === 0
                  ? <div className="text-center text-muted py-4">Sin datos</div>
                  : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={porDia} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="cantidad" fill="#0d6efd" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-6 col-lg-3">
            <div className="card h-100">
              <div className="card-header fw-semibold small">
                <i className="bi bi-pie-chart me-1"></i>Por tipo
              </div>
              <div className="card-body d-flex align-items-center justify-content-center">
                {porTipo.length === 0
                  ? <div className="text-center text-muted">Sin datos</div>
                  : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={porTipo} dataKey="value" nameKey="name" cx="50%" cy="50%"
                          outerRadius={70} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                          labelLine={false}>
                          {porTipo.map((_, i) => <Cell key={i} fill={COLORES_PIE[i % COLORES_PIE.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v, n) => [v, n]} />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-6 col-lg-3">
            <div className="card h-100">
              <div className="card-header fw-semibold small">
                <i className="bi bi-pie-chart me-1"></i>Por estado
              </div>
              <div className="card-body d-flex align-items-center justify-content-center">
                {porEstado.length === 0
                  ? <div className="text-center text-muted">Sin datos</div>
                  : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={porEstado} dataKey="value" nameKey="name" cx="50%" cy="50%"
                          outerRadius={70} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                          labelLine={false}>
                          {porEstado.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
              </div>
            </div>
          </div>
        </div>

        {/* ── MAPA ── */}
        <div className="card mb-4">
          <div className="card-header fw-semibold small d-flex justify-content-between align-items-center">
            <span><i className="bi bi-map me-1"></i>Mapa de trabajos ({trabajos.filter(t => t.lat && t.lng).length} puntos)</span>
            <div className="d-flex gap-2 small">
              {[
                { label: 'Sin iniciar', color: '#dc3545' },
                { label: 'En proceso',  color: '#ffc107' },
                { label: 'Finalizado',  color: '#198754' },
                { label: 'Certificado', color: '#0d6efd' },
              ].map(({ label, color }) => (
                <span key={label} className="d-flex align-items-center gap-1">
                  <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color, display: 'inline-block' }}></span>
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="card-body p-0" style={{ height: 320 }}>
            {trabajos.filter(t => t.lat && t.lng).length === 0
              ? (
                <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                  <div className="text-center"><i className="bi bi-map display-4"></i><p className="mt-2">Sin puntos con ubicación</p></div>
                </div>
              ) : (
                <MapContainer
                  center={[trabajos.find(t => t.lat)?.lat || -34.6, trabajos.find(t => t.lng)?.lng || -58.38]}
                  zoom={12}
                  style={{ height: '100%', width: '100%', borderRadius: '0 0 12px 12px' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap'
                  />
                  {trabajos.filter(t => t.lat && t.lng).map((t) => (
                    <CircleMarker key={t._id} center={[t.lat, t.lng]} radius={8}
                      pathOptions={{ color: getPinColor(t), fillColor: getPinColor(t), fillOpacity: 0.85, weight: 2 }}>
                      <Popup maxWidth={220}>
                        <div className="fw-semibold">{t.calle1} y {t.calle2}</div>
                        <div className="small text-muted">{t.tipoTrabajo} · {t.superficie} m²</div>
                        <div className="small">{t.estadoOperativo} · {t.estadoAdmin}</div>
                        <div className="small text-muted">{t.usuario}</div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              )}
          </div>
        </div>

        {/* ── TABLA ── */}
        <div className="card">
          <div className="card-header fw-semibold small d-flex justify-content-between align-items-center">
            <span>
              <i className="bi bi-table me-1"></i>
              {trabajos.length} trabajo{trabajos.length !== 1 ? 's' : ''}
              {hayFiltros && ' (filtrado)'}
            </span>
            <span className="text-muted small">
              Página {pagina} de {totalPaginas || 1}
            </span>
          </div>

          {cargando ? (
            <div className="card-body text-center py-5">
              <div className="spinner-border text-primary"></div>
              <p className="mt-2 text-muted">Cargando datos...</p>
            </div>
          ) : trabajos.length === 0 ? (
            <div className="card-body text-center py-5 text-muted">
              <i className="bi bi-inbox display-4"></i>
              <p className="mt-2">No hay trabajos con los filtros seleccionados</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover table-sm mb-0 align-middle">
                  <thead className="table-light">
                    <tr>
                      <th className="small">Fecha</th>
                      <th className="small">Intersección</th>
                      <th className="small">Tipo</th>
                      <th className="small text-end">m²</th>
                      <th className="small">Estado</th>
                      <th className="small">Certif.</th>
                      <th className="small">Usuario</th>
                      <th className="small">Fotos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trabajosPagina.map((t) => (
                      <tr key={t._id}>
                        <td className="small text-nowrap">
                          {new Date(t.fechaCarga).toLocaleDateString('es-AR', {
                            day: '2-digit', month: '2-digit', year: '2-digit',
                          })}
                        </td>
                        <td className="small fw-semibold">{t.calle1} y {t.calle2}</td>
                        <td className="small">{t.items ? t.items.map((i) => i.tipoTrabajo).join(', ') : t.tipoTrabajo}</td>
                        <td className="small text-end fw-bold text-primary">{t.superficie}</td>
                        <td>
                          <span className={`badge bg-${COLORES_ESTADO_OP[t.estadoOperativo]}`} style={{ fontSize: 11 }}>
                            {t.estadoOperativo}
                          </span>
                        </td>
                        <td>
                          <span className={`badge bg-${COLORES_ESTADO_ADMIN[t.estadoAdmin]}`} style={{ fontSize: 11 }}>
                            {t.estadoAdmin === 'Certificado' ? '✓ Cert.' : 'Sin cert.'}
                          </span>
                        </td>
                        <td className="small text-muted text-truncate" style={{ maxWidth: 120 }}>
                          {t.usuario}
                        </td>
                        <td className="small text-center text-muted">
                          {t.cantFotos > 0
                            ? <><i className="bi bi-camera me-1"></i>{t.cantFotos}</>
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="table-light">
                    <tr>
                      <td colSpan={3} className="small fw-semibold">Total página</td>
                      <td className="small text-end fw-bold text-primary">
                        {trabajosPagina.reduce((a, t) => a + (t.superficie || 0), 0).toFixed(1)} m²
                      </td>
                      <td colSpan={4}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Paginación */}
              {totalPaginas > 1 && (
                <div className="card-footer d-flex justify-content-center gap-1 py-2">
                  <button className="btn btn-sm btn-outline-secondary" disabled={pagina === 1}
                    onClick={() => setPagina(1)}>«</button>
                  <button className="btn btn-sm btn-outline-secondary" disabled={pagina === 1}
                    onClick={() => setPagina((p) => p - 1)}>‹</button>
                  {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                    const p = Math.max(1, Math.min(pagina - 2, totalPaginas - 4)) + i;
                    return (
                      <button key={p}
                        className={`btn btn-sm ${p === pagina ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setPagina(p)}>{p}</button>
                    );
                  })}
                  <button className="btn btn-sm btn-outline-secondary" disabled={pagina === totalPaginas}
                    onClick={() => setPagina((p) => p + 1)}>›</button>
                  <button className="btn btn-sm btn-outline-secondary" disabled={pagina === totalPaginas}
                    onClick={() => setPagina(totalPaginas)}>»</button>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
