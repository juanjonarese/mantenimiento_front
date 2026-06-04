import { useState, useEffect, useMemo, useRef } from 'react';
import Swal from 'sweetalert2';
import { obtenerTurnosConTrabajos, eliminarTurnos, obtenerTrabajosPorTurno } from '../services/api';

function fmtFecha(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function duracion(inicio, fin) {
  if (!inicio || !fin) return null;
  const ms = new Date(fin) - new Date(inicio);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const COLORES = [
  '#0d6efd','#198754','#6f42c1','#fd7e14','#20c997',
  '#0dcaf0','#d63384','#ffc107','#6c757d','#dc3545',
];

// ── MultiSelect con checkboxes ─────────────────────────────
function MultiSelect({ label, options, selected, onChange }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function cerrar(e) { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); }
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, []);

  const toggle = (opt) =>
    onChange(selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt]);

  const texto = selected.length === 0
    ? 'Todos'
    : selected.length === 1
    ? selected[0]
    : `${selected.length} seleccionados`;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className={`form-select form-select-sm text-start ${selected.length > 0 ? 'border-primary text-primary fw-semibold' : ''}`}
        style={{ cursor: 'pointer' }}
        onClick={() => setAbierto((p) => !p)}
      >
        <span className="me-1">{texto}</span>
      </button>
      {abierto && (
        <div
          className="card shadow-sm border position-absolute w-100 mt-1"
          style={{ zIndex: 1050, minWidth: 200 }}
        >
          <div style={{ maxHeight: 220, overflowY: 'auto' }} className="p-2">
            {options.length === 0 ? (
              <span className="text-muted small px-2">Sin opciones</span>
            ) : options.map((opt) => (
              <div
                key={opt}
                className="d-flex align-items-center gap-2 px-2 py-1 rounded"
                style={{ cursor: 'pointer', background: selected.includes(opt) ? '#e8f0fe' : 'transparent', minHeight: 32 }}
                onClick={() => toggle(opt)}
              >
                <input
                  type="checkbox"
                  readOnly
                  checked={selected.includes(opt)}
                  style={{ cursor: 'pointer', width: 15, height: 15, flexShrink: 0, accentColor: '#0d6efd' }}
                />
                <span className="small" style={{ cursor: 'pointer', lineHeight: 1.3 }}>{opt}</span>
              </div>
            ))}
          </div>
          {selected.length > 0 && (
            <div className="border-top px-3 py-2">
              <button className="btn btn-sm btn-link text-danger p-0 text-decoration-none"
                onClick={() => { onChange([]); setAbierto(false); }}>
                <i className="bi bi-x-circle me-1"></i>Limpiar selección
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Filtros iniciales ──────────────────────────────────────
const FILTROS_VACIO = {
  estado:       'todos',
  supervisores: [],
  clientes:     [],
  desde:        '',
  hasta:        '',
};

export default function TurnosAdminPage() {
  const [turnos, setTurnos]     = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState('');
  const [filtros, setFiltros]   = useState(FILTROS_VACIO);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [eliminando, setEliminando] = useState(false);
  const [modalTurno, setModalTurno] = useState(null);
  const [trabajosModal, setTrabajosModal] = useState([]);
  const [cargandoModal, setCargandoModal] = useState(false);
  const [expandidos, setExpandidos] = useState(new Set());

  useEffect(() => {
    obtenerTurnosConTrabajos()
      .then(({ turnos: t }) => setTurnos(t || []))
      .catch(() => setError('No se pudieron cargar los turnos'))
      .finally(() => setCargando(false));
  }, []);

  const opcionesSupervisores = useMemo(() =>
    [...new Set(turnos.map((t) => {
      const s = t.supervisor;
      return s ? `${s.nombre || ''} ${s.apellido || ''}`.trim() : '';
    }).filter(Boolean))].sort()
  , [turnos]);

  const opcionesClientes = useMemo(() =>
    [...new Set(turnos.flatMap((t) => t.clientes || []).filter(Boolean))].sort()
  , [turnos]);

  const lista = useMemo(() => turnos.filter((t) => {
    if (filtros.estado !== 'todos' && t.estado !== filtros.estado) return false;
    if (filtros.supervisores.length > 0) {
      const nombre = t.supervisor
        ? `${t.supervisor.nombre || ''} ${t.supervisor.apellido || ''}`.trim() : '';
      if (!filtros.supervisores.includes(nombre)) return false;
    }
    if (filtros.clientes.length > 0) {
      const tiene = (t.clientes || []).some((c) => filtros.clientes.includes(c));
      if (!tiene) return false;
    }
    if (filtros.desde && new Date(t.fechaInicio) < new Date(filtros.desde)) return false;
    if (filtros.hasta) {
      const hasta = new Date(filtros.hasta); hasta.setHours(23, 59, 59);
      if (new Date(t.fechaInicio) > hasta) return false;
    }
    return true;
  }), [turnos, filtros]);

  const hayFiltros = filtros.estado !== 'todos'
    || filtros.supervisores.length > 0
    || filtros.clientes.length > 0
    || filtros.desde !== ''
    || filtros.hasta !== '';

  const cantFiltros = (filtros.estado !== 'todos' ? 1 : 0)
    + (filtros.supervisores.length > 0 ? 1 : 0)
    + (filtros.clientes.length > 0 ? 1 : 0)
    + (filtros.desde ? 1 : 0)
    + (filtros.hasta ? 1 : 0);

  function set(k, v) { setFiltros((p) => ({ ...p, [k]: v })); }
  function limpiar() { setFiltros(FILTROS_VACIO); }

  const totalM2  = lista.reduce((s, t) => s + (t.totalM2 || 0), 0);
  const abiertos = lista.filter((t) => t.estado === 'abierto').length;

  function toggleSeleccion(id) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    if (seleccionados.size === lista.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(lista.map((t) => t._id)));
    }
  }

  async function abrirModalTrabajos(turno) {
    setModalTurno(turno);
    setTrabajosModal([]);
    setExpandidos(new Set());
    setCargandoModal(true);
    try {
      const { trabajos } = await obtenerTrabajosPorTurno(turno._id);
      setTrabajosModal(trabajos || []);
    } catch {
      setTrabajosModal([]);
    } finally {
      setCargandoModal(false);
    }
  }

  function toggleExpandido(id) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleEliminar() {
    const cant = seleccionados.size;
    const { isConfirmed } = await Swal.fire({
      title: `¿Eliminar ${cant} turno${cant > 1 ? 's' : ''}?`,
      text: 'Los trabajos asociados quedarán sin turno asignado. Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonText: 'Cancelar',
      confirmButtonText: `Sí, eliminar ${cant > 1 ? 'todos' : ''}`,
    });
    if (!isConfirmed) return;
    setEliminando(true);
    try {
      await eliminarTurnos([...seleccionados]);
      setTurnos((prev) => prev.filter((t) => !seleccionados.has(t._id)));
      setSeleccionados(new Set());
    } catch (err) {
      Swal.fire('Error', err.message || 'No se pudieron eliminar los turnos', 'error');
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div>
      {/* HEADER */}
      <div className="page-header bg-white border-bottom px-3 px-lg-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h4 className="fw-bold mb-0">
            <i className="bi bi-clock-history me-2 text-primary"></i>Turnos
          </h4>
          <small className="text-muted">
            {lista.length} de {turnos.length} turno{turnos.length !== 1 ? 's' : ''}
            {abiertos > 0 && <span className="ms-2 badge bg-success">{abiertos} abierto{abiertos > 1 ? 's' : ''}</span>}
          </small>
        </div>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          {seleccionados.size > 0 && (
            <>
              <span className="text-muted small">{seleccionados.size} seleccionado{seleccionados.size > 1 ? 's' : ''}</span>
              <button className="btn btn-sm btn-danger d-flex align-items-center gap-1"
                onClick={handleEliminar} disabled={eliminando}>
                {eliminando
                  ? <span className="spinner-border spinner-border-sm"></span>
                  : <><i className="bi bi-trash"></i>Eliminar</>}
              </button>
              <button className="btn btn-sm btn-outline-secondary"
                onClick={() => setSeleccionados(new Set())}>
                Cancelar
              </button>
            </>
          )}
          {lista.length > 0 && seleccionados.size === 0 && (
            <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
              onClick={toggleTodos}>
              <i className="bi bi-check2-square"></i>
              <span className="d-none d-sm-inline">Seleccionar todo</span>
            </button>
          )}
          {seleccionados.size > 0 && seleccionados.size < lista.length && (
            <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
              onClick={toggleTodos}>
              <i className="bi bi-check2-square"></i>
              <span className="d-none d-sm-inline">Seleccionar todo</span>
            </button>
          )}
          <button
            className={`btn btn-sm d-flex align-items-center gap-1 ${hayFiltros ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setPanelAbierto((p) => !p)}
          >
            <i className="bi bi-funnel"></i>
            Filtros
            {cantFiltros > 0 && (
              <span className="badge bg-white text-primary ms-1" style={{ fontSize: 11 }}>{cantFiltros}</span>
            )}
          </button>
        </div>
      </div>

      {/* PANEL DE FILTROS */}
      {panelAbierto && (
        <div className="bg-light border-bottom px-3 px-lg-4 py-3">
          <div className="row g-2 align-items-end">

            <div className="col-12 col-sm-6 col-md-4 col-lg-2">
              <label className="form-label small fw-semibold mb-1">Estado</label>
              <select className="form-select form-select-sm" value={filtros.estado}
                onChange={(e) => set('estado', e.target.value)}>
                <option value="todos">Todos</option>
                <option value="abierto">Abiertos</option>
                <option value="cerrado">Cerrados</option>
              </select>
            </div>

            <div className="col-12 col-sm-6 col-md-4 col-lg-3">
              <label className="form-label small fw-semibold mb-1">
                Supervisor
                {filtros.supervisores.length > 0 && (
                  <span className="badge bg-primary ms-1" style={{ fontSize: 10 }}>{filtros.supervisores.length}</span>
                )}
              </label>
              <MultiSelect
                options={opcionesSupervisores}
                selected={filtros.supervisores}
                onChange={(v) => set('supervisores', v)}
              />
            </div>

            <div className="col-12 col-sm-6 col-md-4 col-lg-3">
              <label className="form-label small fw-semibold mb-1">
                Cliente
                {filtros.clientes.length > 0 && (
                  <span className="badge bg-primary ms-1" style={{ fontSize: 10 }}>{filtros.clientes.length}</span>
                )}
              </label>
              <MultiSelect
                options={opcionesClientes}
                selected={filtros.clientes}
                onChange={(v) => set('clientes', v)}
              />
            </div>

            <div className="col-6 col-md-3 col-lg-1">
              <label className="form-label small fw-semibold mb-1">Desde</label>
              <input type="date" className="form-control form-control-sm"
                value={filtros.desde} onChange={(e) => set('desde', e.target.value)} />
            </div>

            <div className="col-6 col-md-3 col-lg-1">
              <label className="form-label small fw-semibold mb-1">Hasta</label>
              <input type="date" className="form-control form-control-sm"
                value={filtros.hasta} onChange={(e) => set('hasta', e.target.value)} />
            </div>

            {hayFiltros && (
              <div className="col-auto">
                <button className="btn btn-sm btn-outline-danger" onClick={limpiar}>
                  <i className="bi bi-x-circle me-1"></i>Limpiar
                </button>
              </div>
            )}
          </div>

          {/* Chips de filtros activos */}
          {hayFiltros && (
            <div className="d-flex flex-wrap gap-1 mt-2">
              {filtros.supervisores.map((s) => (
                <span key={s} className="badge bg-primary d-flex align-items-center gap-1">
                  <i className="bi bi-person"></i>{s}
                  <button type="button" className="btn-close btn-close-white ms-1"
                    style={{ fontSize: 9 }}
                    onClick={() => set('supervisores', filtros.supervisores.filter((x) => x !== s))} />
                </span>
              ))}
              {filtros.clientes.map((c) => (
                <span key={c} className="badge bg-info text-dark d-flex align-items-center gap-1">
                  <i className="bi bi-building"></i>{c}
                  <button type="button" className="btn-close ms-1"
                    style={{ fontSize: 9 }}
                    onClick={() => set('clientes', filtros.clientes.filter((x) => x !== c))} />
                </span>
              ))}
              {filtros.estado !== 'todos' && (
                <span className="badge bg-secondary d-flex align-items-center gap-1">
                  {filtros.estado}
                  <button type="button" className="btn-close btn-close-white ms-1"
                    style={{ fontSize: 9 }} onClick={() => set('estado', 'todos')} />
                </span>
              )}
              {filtros.desde && (
                <span className="badge bg-secondary d-flex align-items-center gap-1">
                  Desde {filtros.desde}
                  <button type="button" className="btn-close btn-close-white ms-1"
                    style={{ fontSize: 9 }} onClick={() => set('desde', '')} />
                </span>
              )}
              {filtros.hasta && (
                <span className="badge bg-secondary d-flex align-items-center gap-1">
                  Hasta {filtros.hasta}
                  <button type="button" className="btn-close btn-close-white ms-1"
                    style={{ fontSize: 9 }} onClick={() => set('hasta', '')} />
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="container py-3" style={{ maxWidth: 1400 }}>

        {/* RESUMEN */}
        {!cargando && lista.length > 0 && (
          <div className="row g-3 mb-4">
            {[
              { label: 'Turnos',     value: lista.length,                                                    color: 'primary', icon: 'clock-history' },
              { label: 'Abiertos',   value: abiertos,                                                        color: 'success', icon: 'play-circle'   },
              { label: 'Trabajos',   value: lista.reduce((s, t) => s + (t.cantidadTrabajos || 0), 0),        color: 'info',    icon: 'tools'          },
              { label: 'm² totales', value: totalM2.toFixed(1),                                              color: 'warning', icon: 'rulers'         },
            ].map(({ label, value, color, icon }) => (
              <div key={label} className="col-6 col-md-3">
                <div className="card border-0 shadow-sm text-center py-3">
                  <i className={`bi bi-${icon} text-${color} mb-1`} style={{ fontSize: 22 }}></i>
                  <div className={`fs-4 fw-bold text-${color}`}>{value}</div>
                  <div className="text-muted small">{label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <div className="alert alert-danger">{error}</div>}

        {cargando ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-primary"></div>
          </div>
        ) : lista.length === 0 ? (
          <div className="card text-center py-5 text-muted border-0 shadow-sm">
            <i className="bi bi-clock display-4 mb-3 d-block"></i>
            <p>No hay turnos con los filtros seleccionados</p>
            {hayFiltros && (
              <button className="btn btn-sm btn-outline-secondary mx-auto" onClick={limpiar}>
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {lista.map((turno) => {
              const sup  = turno.supervisor;
              const nombre = sup ? `${sup.nombre || ''} ${sup.apellido || ''}`.trim() : 'Sin asignar';
              const dur  = duracion(turno.fechaInicio, turno.fechaFin);
              return (
                <div
                  key={turno._id}
                  className={`card border-0 shadow-sm ${seleccionados.has(turno._id) ? 'border-danger border-2' : ''}`}
                  style={seleccionados.has(turno._id) ? { outline: '2px solid #dc3545' } : {}}
                >
                  <div className="card-body">
                    {/* Fila superior: checkbox + info + métricas */}
                    <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
                      {/* Checkbox + info */}
                      <div className="d-flex align-items-start gap-3">
                        <input
                          type="checkbox"
                          checked={seleccionados.has(turno._id)}
                          onChange={() => toggleSeleccion(turno._id)}
                          style={{ width: 18, height: 18, marginTop: 3, cursor: 'pointer', accentColor: '#dc3545', flexShrink: 0 }}
                        />
                        <div>
                          <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                            <span className={`badge ${turno.estado === 'abierto' ? 'bg-success' : 'bg-secondary'}`}>
                              {turno.estado === 'abierto' ? 'Abierto' : 'Cerrado'}
                            </span>
                            <span className="fw-semibold">
                              <i className="bi bi-person me-1 text-muted"></i>{nombre}
                            </span>
                            {turno.clientes?.length > 0 && (
                              <span className="text-muted small">
                                <i className="bi bi-building me-1"></i>
                                {turno.clientes.join(', ')}
                              </span>
                            )}
                          </div>
                          <div className="text-muted small d-flex flex-wrap gap-3">
                            <span><i className="bi bi-play-circle me-1"></i><strong>Inicio:</strong> {fmtFecha(turno.fechaInicio)}</span>
                            {turno.fechaFin && <span><i className="bi bi-stop-circle me-1"></i><strong>Cierre:</strong> {fmtFecha(turno.fechaFin)}</span>}
                            {dur && <span><i className="bi bi-hourglass-split me-1"></i><strong>Duración:</strong> {dur}</span>}
                          </div>
                        </div>
                      </div>
                      {/* Métricas */}
                      <div className="d-flex gap-3 text-center">
                        <div>
                          {turno.cantidadTrabajos > 0 ? (
                            <button
                              type="button"
                              className="btn btn-link p-0 fw-bold fs-5 text-primary text-decoration-none"
                              style={{ lineHeight: 1 }}
                              title="Ver detalle de trabajos"
                              onClick={() => abrirModalTrabajos(turno)}
                            >
                              {turno.cantidadTrabajos}
                            </button>
                          ) : (
                            <div className="fw-bold fs-5 text-primary">{turno.cantidadTrabajos}</div>
                          )}
                          <div className="text-muted" style={{ fontSize: 11 }}>trabajos</div>
                        </div>
                        <div>
                          <div className="fw-bold fs-5 text-warning">{(turno.totalM2 || 0).toFixed(1)}</div>
                          <div className="text-muted" style={{ fontSize: 11 }}>m² total</div>
                        </div>
                      </div>
                    </div>

                    {/* m² por tipo */}
                    {turno.m2PorTipo?.length > 0 && (
                      <div>
                        <p className="text-muted small fw-semibold mb-2">
                          <i className="bi bi-bar-chart-steps me-1"></i>m² por tipo de trabajo
                        </p>
                        <div className="d-flex flex-wrap gap-2">
                          {turno.m2PorTipo.map(({ tipo, m2 }, i) => (
                            <div key={tipo} className="rounded px-3 py-2 d-flex flex-column align-items-center"
                              style={{ background: COLORES[i % COLORES.length] + '18', border: `1.5px solid ${COLORES[i % COLORES.length]}40`, minWidth: 110 }}>
                              <span className="fw-bold" style={{ color: COLORES[i % COLORES.length], fontSize: 18 }}>{m2.toFixed(1)}</span>
                              <span className="text-muted" style={{ fontSize: 11 }}>m²</span>
                              <span className="text-center" style={{ fontSize: 11, color: COLORES[i % COLORES.length], fontWeight: 600, lineHeight: 1.2, marginTop: 2 }}>{tipo}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {turno.observaciones && (
                      <p className="text-muted small mt-2 mb-0">
                        <i className="bi bi-chat-left-text me-1"></i>{turno.observaciones}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL TRABAJOS DEL TURNO */}
      {modalTurno && (
        <>
          <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-lg modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <div>
                    <h5 className="modal-title mb-0">
                      <i className="bi bi-tools me-2 text-primary"></i>
                      Trabajos del turno
                    </h5>
                    <small className="text-muted">
                      {modalTurno.supervisor
                        ? `${modalTurno.supervisor.nombre} ${modalTurno.supervisor.apellido}`.trim()
                        : 'Sin supervisor'}
                      {' · '}
                      {fmtFecha(modalTurno.fechaInicio)}
                      {modalTurno.fechaFin && ` → ${fmtFecha(modalTurno.fechaFin)}`}
                    </small>
                  </div>
                  <button type="button" className="btn-close" onClick={() => setModalTurno(null)}></button>
                </div>
                <div className="modal-body p-0">
                  {cargandoModal ? (
                    <div className="d-flex justify-content-center py-5">
                      <div className="spinner-border text-primary"></div>
                    </div>
                  ) : trabajosModal.length === 0 ? (
                    <div className="text-center text-muted py-5">
                      <i className="bi bi-inbox display-5 d-block mb-2"></i>
                      Sin trabajos registrados
                    </div>
                  ) : (
                    <div className="list-group list-group-flush">
                      {trabajosModal.map((t, i) => {
                        const abierto = expandidos.has(t._id);
                        const tipos = t.items?.length > 0
                          ? t.items.map((it) => it.tipoTrabajo).filter(Boolean)
                          : t.tipoTrabajo ? [t.tipoTrabajo] : [];
                        const m2 = t.superficie || 0;
                        return (
                          <div key={t._id} className="list-group-item p-0">
                            {/* Fila resumen — clickeable */}
                            <button
                              type="button"
                              className="w-100 text-start px-4 py-3 border-0 bg-transparent"
                              style={{ cursor: 'pointer' }}
                              onClick={() => toggleExpandido(t._id)}
                            >
                              <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                                <div>
                                  <div className="fw-semibold mb-1">
                                    <span className="text-muted me-2" style={{ fontSize: 12 }}>#{i + 1}</span>
                                    <i className="bi bi-signpost-2 me-1 text-muted"></i>
                                    {t.calle1}{t.calle2 ? ` y ${t.calle2}` : ''}
                                  </div>
                                  <div className="d-flex flex-wrap gap-2 align-items-center">
                                    {tipos.map((tipo) => (
                                      <span key={tipo} className="badge bg-primary bg-opacity-10 text-primary" style={{ fontSize: 11 }}>
                                        {tipo}
                                      </span>
                                    ))}
                                    {t.clienteNombre && (
                                      <span className="text-muted small">
                                        <i className="bi bi-building me-1"></i>{t.clienteNombre}
                                      </span>
                                    )}
                                    <span className="text-muted small">
                                      <i className="bi bi-calendar3 me-1"></i>
                                      {t.fechaCarga ? new Date(t.fechaCarga).toLocaleDateString('es-AR') : '—'}
                                    </span>
                                  </div>
                                </div>
                                <div className="d-flex align-items-center gap-3 flex-shrink-0">
                                  <div className="text-end">
                                    <div className="fw-bold text-warning">{m2.toFixed(1)} m²</div>
                                    <span className={`badge ${
                                      t.estadoOperativo === 'Finalizado' || t.estadoOperativo === 'Terminado'
                                        ? 'bg-success'
                                        : t.estadoOperativo === 'En proceso'
                                        ? 'bg-warning text-dark'
                                        : 'bg-secondary'
                                    }`} style={{ fontSize: 10 }}>
                                      {t.estadoOperativo || 'Sin estado'}
                                    </span>
                                  </div>
                                  <i className={`bi bi-chevron-${abierto ? 'up' : 'down'} text-muted`}></i>
                                </div>
                              </div>
                            </button>

                            {/* Detalle expandido */}
                            {abierto && (
                              <div className="px-4 pb-3 border-top" style={{ background: '#f8f9fa' }}>
                                <div className="row g-3 pt-3">

                                  {/* Items / medidas */}
                                  {t.items?.length > 0 && (
                                    <div className="col-12">
                                      <p className="text-muted small fw-semibold mb-2">
                                        <i className="bi bi-list-ul me-1"></i>Items
                                      </p>
                                      <div className="table-responsive">
                                        <table className="table table-sm table-bordered mb-0" style={{ fontSize: 12 }}>
                                          <thead className="table-light">
                                            <tr>
                                              <th>Tipo</th>
                                              <th>Largo</th>
                                              <th>Ancho</th>
                                              <th>Cant.</th>
                                              <th>m²</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {t.items.map((it, j) => (
                                              <tr key={j}>
                                                <td>{it.tipoTrabajo || '—'}</td>
                                                <td>{it.largo ?? '—'}</td>
                                                <td>{it.ancho ?? '—'}</td>
                                                <td>{it.cantidad ?? '—'}</td>
                                                <td className="fw-semibold">{(it.superficie || 0).toFixed(2)}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}

                                  {/* Campos legacy si no hay items */}
                                  {(!t.items || t.items.length === 0) && (t.tipoTrabajo || t.largo || t.ancho) && (
                                    <div className="col-12 col-sm-6">
                                      <p className="text-muted small fw-semibold mb-2">
                                        <i className="bi bi-rulers me-1"></i>Medidas
                                      </p>
                                      <div className="d-flex flex-wrap gap-3 small">
                                        {t.tipoTrabajo && <span><strong>Tipo:</strong> {t.tipoTrabajo}</span>}
                                        {t.largo != null && <span><strong>Largo:</strong> {t.largo} m</span>}
                                        {t.ancho != null && <span><strong>Ancho:</strong> {t.ancho} m</span>}
                                        {t.cantidad != null && <span><strong>Cant.:</strong> {t.cantidad}</span>}
                                      </div>
                                    </div>
                                  )}

                                  {/* Materiales */}
                                  {t.materiales?.length > 0 && (
                                    <div className="col-12 col-sm-6">
                                      <p className="text-muted small fw-semibold mb-2">
                                        <i className="bi bi-droplet me-1"></i>Materiales
                                      </p>
                                      <div className="d-flex flex-wrap gap-2">
                                        {t.materiales.map((m, j) => (
                                          <span key={j} className="badge bg-secondary bg-opacity-10 text-dark border" style={{ fontSize: 11 }}>
                                            {m.nombre} — {m.cantidad} {m.unidad || ''}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Estado admin */}
                                  <div className="col-12 col-sm-6">
                                    <p className="text-muted small fw-semibold mb-2">
                                      <i className="bi bi-clipboard-check me-1"></i>Estado administrativo
                                    </p>
                                    <span className={`badge ${
                                      t.estadoAdmin === 'Certificado' ? 'bg-success'
                                      : t.estadoAdmin === 'Facturado' ? 'bg-primary'
                                      : t.estadoAdmin === 'Rechazado' ? 'bg-danger'
                                      : t.estadoAdmin === 'En revisión' ? 'bg-warning text-dark'
                                      : 'bg-secondary'
                                    }`}>
                                      {t.estadoAdmin || 'Sin certificar'}
                                    </span>
                                    {t.motivoRechazo && (
                                      <p className="text-danger small mt-1 mb-0">
                                        <i className="bi bi-x-circle me-1"></i>{t.motivoRechazo}
                                      </p>
                                    )}
                                  </div>

                                  {/* Usuario / fotos */}
                                  <div className="col-12 col-sm-6">
                                    <p className="text-muted small fw-semibold mb-2">
                                      <i className="bi bi-info-circle me-1"></i>Datos adicionales
                                    </p>
                                    <div className="small d-flex flex-wrap gap-3">
                                      {t.usuario && <span><i className="bi bi-person me-1 text-muted"></i>{t.usuario}</span>}
                                      {t.cantFotos > 0 && <span><i className="bi bi-images me-1 text-muted"></i>{t.cantFotos} foto{t.cantFotos !== 1 ? 's' : ''}</span>}
                                      {t.expedienteMunicipal && <span><i className="bi bi-file-earmark-text me-1 text-muted"></i>{t.expedienteMunicipal}</span>}
                                      {t.nroFactura && <span><i className="bi bi-receipt me-1 text-muted"></i>Fact. {t.nroFactura}</span>}
                                    </div>
                                  </div>

                                  {/* Observaciones */}
                                  {t.observaciones && (
                                    <div className="col-12">
                                      <p className="text-muted small fw-semibold mb-1">
                                        <i className="bi bi-chat-left-text me-1"></i>Observaciones
                                      </p>
                                      <p className="small mb-0">{t.observaciones}</p>
                                    </div>
                                  )}

                                  {/* Links */}
                                  {(t.linkDrive || t.linkMyMaps) && (
                                    <div className="col-12">
                                      <div className="d-flex gap-2 flex-wrap">
                                        {t.linkDrive && (
                                          <a href={t.linkDrive} target="_blank" rel="noopener noreferrer"
                                            className="btn btn-sm btn-outline-secondary" style={{ fontSize: 12 }}>
                                            <i className="bi bi-cloud me-1"></i>Drive
                                          </a>
                                        )}
                                        {t.linkMyMaps && (
                                          <a href={t.linkMyMaps} target="_blank" rel="noopener noreferrer"
                                            className="btn btn-sm btn-outline-secondary" style={{ fontSize: 12 }}>
                                            <i className="bi bi-map me-1"></i>MyMaps
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <span className="text-muted small me-auto">
                    {trabajosModal.length} trabajo{trabajosModal.length !== 1 ? 's' : ''}
                    {trabajosModal.length > 0 && ` · ${trabajosModal.reduce((s, t) => s + (t.superficie || 0), 0).toFixed(1)} m² total`}
                  </span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModalTurno(null)}>
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
