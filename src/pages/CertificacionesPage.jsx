import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { obtenerTrabajos, guardarTrabajo } from '../db/db';

// ─── Helpers ───────────────────────────────────────────────────────────────

const ESTADOS_PENDIENTE = ['Terminado', 'Finalizado'];

const ESTADO_CONFIG = {
  'Sin certificar': {
    color: 'secondary',
    bg: '',
    icon: 'hourglass-split',
    label: 'Sin certificar',
  },
  'En revisión': {
    color: 'warning',
    bg: 'bg-warning bg-opacity-10',
    icon: 'send',
    label: 'En revisión',
  },
  'Certificado': {
    color: 'success',
    bg: 'bg-success bg-opacity-10',
    icon: 'patch-check-fill',
    label: 'Certificado',
  },
  'Rechazado': {
    color: 'danger',
    bg: 'bg-danger bg-opacity-10',
    icon: 'x-circle-fill',
    label: 'Rechazado',
  },
};

function formatFecha(f) {
  if (!f) return '—';
  return new Date(f).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function superficieDe(t) {
  return (t.items || []).reduce((s, i) => s + (i.superficie || 0), 0).toFixed(2);
}

function buildMailto(emailTo, trabajo, mensaje, docLink) {
  const sup = superficieDe(trabajo);
  const tareas = (trabajo.items || [])
    .map((i) => `  - ${i.tipoTrabajo}: ${i.superficie} m²`)
    .join('\n');
  const subject = `Solicitud de certificación — ${trabajo.calle1} y ${trabajo.calle2}`;
  const body = [
    'Estimado/a,',
    '',
    'Se solicita la certificación del siguiente trabajo de pintura vial:',
    '',
    `Ubicación: ${trabajo.calle1} y ${trabajo.calle2}`,
    `Fecha de ejecución: ${formatFecha(trabajo.fechaCarga)}`,
    `Superficie total: ${sup} m²`,
    '',
    'Detalle de tareas:',
    tareas,
    trabajo.observaciones ? `\nObservaciones: ${trabajo.observaciones}` : '',
    docLink ? `\nDocumentación: ${docLink}` : '',
    mensaje ? `\nMensaje: ${mensaje}` : '',
    '',
    'Quedo a disposición para cualquier consulta.',
  ]
    .filter((l) => l !== null)
    .join('\n');

  return `mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ─── Componente ────────────────────────────────────────────────────────────

const FILTROS = [
  { key: 'pendientes', label: 'Sin certificar', estados: ['Sin certificar', undefined, null] },
  { key: 'revision',   label: 'En revisión',   estados: ['En revisión'] },
  { key: 'aprobados',  label: 'Certificados',  estados: ['Certificado'] },
  { key: 'rechazados', label: 'Rechazados',    estados: ['Rechazado'] },
  { key: 'todos',      label: 'Todos',         estados: null },
];

export default function CertificacionesPage() {
  const [trabajos, setTrabajos] = useState([]);
  const [filtro, setFiltro] = useState('pendientes');
  const [expandido, setExpandido] = useState(null);
  const [modal, setModal] = useState(null); // { tipo, trabajo }
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState('');

  // Campos del modal
  const [emailTo, setEmailTo] = useState('');
  const [docLink, setDocLink] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [notas, setNotas] = useState('');
  const [motivo, setMotivo] = useState('');

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const todos = await obtenerTrabajos();
    const terminados = todos.filter((t) => ESTADOS_PENDIENTE.includes(t.estadoOperativo));
    setTrabajos(terminados);
  }

  // ── Filtrado ──────────────────────────────────────────────────────────────
  function contarFiltro(key) {
    const cfg = FILTROS.find((f) => f.key === key);
    if (!cfg || cfg.estados === null) return trabajos.length;
    return trabajos.filter((t) => {
      const e = t.estadoAdmin || 'Sin certificar';
      return cfg.estados.includes(e) || cfg.estados.includes(null);
    }).length;
  }

  const filtrados = trabajos.filter((t) => {
    const e = t.estadoAdmin || 'Sin certificar';
    const cfg = FILTROS.find((f) => f.key === filtro);
    if (!cfg || cfg.estados === null) return true;
    return cfg.estados.includes(e) || cfg.estados.includes(undefined) || cfg.estados.includes(null);
  });

  // ── Acciones ──────────────────────────────────────────────────────────────
  function abrirModal(tipo, trabajo) {
    setModal({ tipo, trabajo });
    setEmailTo('');
    setDocLink('');
    setMensaje('');
    setNotas('');
    setMotivo('');
    setErrorModal('');
  }

  async function actualizarEstado(trabajo, nuevoEstado, extras = {}) {
    const actualizado = {
      ...trabajo,
      estadoAdmin: nuevoEstado,
      fechaCertificacion: new Date().toISOString(),
      ...extras,
      sincronizado: false,
    };
    await guardarTrabajo(actualizado);
    await cargar();
  }

  async function handleEnviarRevision() {
    if (!emailTo.trim()) return setErrorModal('Ingresá el email del destinatario');
    setGuardando(true);
    try {
      const url = buildMailto(emailTo.trim(), modal.trabajo, mensaje, docLink);
      window.location.href = url;
      await actualizarEstado(modal.trabajo, 'En revisión', {
        emailRevision: emailTo.trim(),
        docRevision: docLink.trim(),
      });
      setModal(null);
    } finally {
      setGuardando(false);
    }
  }

  async function handleCertificar() {
    setGuardando(true);
    try {
      await actualizarEstado(modal.trabajo, 'Certificado', {
        documentacionCertificacion: docLink.trim(),
        notasCertificacion: notas.trim(),
      });
      setModal(null);
    } finally {
      setGuardando(false);
    }
  }

  async function handleRechazar() {
    if (!motivo.trim()) return setErrorModal('Ingresá el motivo del rechazo');
    setGuardando(true);
    try {
      await actualizarEstado(modal.trabajo, 'Rechazado', { motivoRechazo: motivo.trim() });
      setModal(null);
    } finally {
      setGuardando(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="certificaciones-page">

      {/* ── HEADER ── */}
      <div className="page-header bg-white border-bottom px-3 px-lg-4 py-3">
        <h4 className="fw-bold mb-0">
          <i className="bi bi-patch-check me-2 text-success"></i>Certificaciones
        </h4>
        <small className="text-muted">{trabajos.length} trabajo{trabajos.length !== 1 ? 's' : ''} con estado operativo Terminado</small>
      </div>

      {/* ── FILTROS ── */}
      <div className="px-3 px-lg-4 py-2 bg-white border-bottom d-flex gap-2 flex-wrap">
        {FILTROS.map(({ key, label }) => {
          const count = contarFiltro(key);
          const cfg = ESTADO_CONFIG[key === 'pendientes' ? 'Sin certificar' : key === 'revision' ? 'En revisión' : key === 'aprobados' ? 'Certificado' : key === 'rechazados' ? 'Rechazado' : 'Sin certificar'];
          const active = filtro === key;
          return (
            <button
              key={key}
              className={`btn btn-sm ${active ? `btn-${key === 'todos' ? 'dark' : cfg?.color || 'secondary'}` : `btn-outline-${key === 'todos' ? 'dark' : cfg?.color || 'secondary'}`}`}
              onClick={() => { setFiltro(key); setExpandido(null); }}
            >
              {label}
              {count > 0 && (
                <span className={`ms-1 badge ${active ? 'bg-white text-dark' : `bg-${key === 'todos' ? 'dark' : cfg?.color || 'secondary'} text-white`}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── CONTENIDO ── */}
      <div className="container-fluid px-3 px-lg-4 py-3" style={{ maxWidth: 1400 }}>
        {filtrados.length === 0 ? (
          <div className="text-center text-muted py-5">
            <i className="bi bi-inbox display-4 d-block mb-3 opacity-50"></i>
            <div className="fw-semibold">No hay trabajos en este estado</div>
          </div>
        ) : (
          <div className="row g-3">
            {filtrados.map((t) => {
              const estadoAdmin = t.estadoAdmin || 'Sin certificar';
              const cfg = ESTADO_CONFIG[estadoAdmin] || ESTADO_CONFIG['Sin certificar'];
              const sup = superficieDe(t);
              const abierto = expandido === t.id;

              return (
                <div key={t.id} className="col-12 col-md-6 col-xl-4">
                  <div
                    className={`card h-100 border-${cfg.color} border-2 ${cfg.bg} shadow-sm`}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* ── Cabecera de la tarjeta (click para expandir) ── */}
                    <div
                      className={`card-header border-${cfg.color} d-flex justify-content-between align-items-start gap-2 py-3`}
                      onClick={() => setExpandido(abierto ? null : t.id)}
                    >
                      <div className="flex-grow-1 min-w-0">
                        <div className="fw-bold text-truncate">
                          <i className="bi bi-geo-alt me-1 text-primary"></i>
                          {t.calle1} y {t.calle2}
                        </div>
                        <div className="text-muted small mt-1">
                          {formatFecha(t.fechaCarga)}
                          {t.usuario ? ` · ${t.usuario}` : ''}
                        </div>
                        <div className="mt-1 d-flex align-items-center gap-2 flex-wrap">
                          <span className={`badge bg-${cfg.color} text-${cfg.color === 'warning' ? 'dark' : 'white'}`}>
                            <i className={`bi bi-${cfg.icon} me-1`}></i>
                            {cfg.label}
                          </span>
                          <span className="badge bg-primary bg-opacity-75">{sup} m²</span>
                        </div>
                      </div>
                      <i className={`bi bi-chevron-${abierto ? 'up' : 'down'} text-muted flex-shrink-0 mt-1`}></i>
                    </div>

                    {/* ── Detalle expandido ── */}
                    {abierto && (
                      <div className="card-body py-2">
                        {/* Tareas */}
                        <div className="small mb-2">
                          {(t.items || []).map((item, i) => (
                            <div key={i} className="d-flex justify-content-between py-1 border-bottom">
                              <span className="text-muted">{item.tipoTrabajo}</span>
                              <span className="fw-semibold">{item.superficie} m²</span>
                            </div>
                          ))}
                          <div className="d-flex justify-content-between pt-2 fw-bold">
                            <span>Total</span>
                            <span>{sup} m²</span>
                          </div>
                        </div>

                        {/* Observaciones */}
                        {t.observaciones && (
                          <div className="small text-muted fst-italic border-top pt-2 mb-2">
                            <i className="bi bi-chat-left-text me-1"></i>
                            "{t.observaciones}"
                          </div>
                        )}

                        {/* Info según estado */}
                        {estadoAdmin === 'En revisión' && t.emailRevision && (
                          <div className="alert alert-warning py-2 small mb-2">
                            <i className="bi bi-send me-1"></i>
                            Enviado a <strong>{t.emailRevision}</strong>
                          </div>
                        )}
                        {estadoAdmin === 'Certificado' && (
                          <div className="alert alert-success py-2 small mb-2">
                            <i className="bi bi-check-circle me-1"></i>
                            Certificado el {formatFecha(t.fechaCertificacion)}
                            {t.documentacionCertificacion && (
                              <> · <a href={t.documentacionCertificacion} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Ver doc</a></>
                            )}
                            {t.notasCertificacion && <div className="text-muted mt-1">{t.notasCertificacion}</div>}
                          </div>
                        )}
                        {estadoAdmin === 'Rechazado' && (
                          <div className="alert alert-danger py-2 small mb-2">
                            <i className="bi bi-x-circle me-1"></i>
                            <strong>Motivo:</strong> {t.motivoRechazo}
                          </div>
                        )}

                        {/* Acciones */}
                        <div className="d-flex flex-column gap-2 pt-1">
                          <Link
                            to={`/detalle/${t.id}`}
                            className="btn btn-outline-secondary btn-sm w-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <i className="bi bi-eye me-1"></i>Ver detalle completo
                          </Link>

                          {(estadoAdmin === 'Sin certificar' || estadoAdmin === 'Rechazado') && (
                            <button
                              className="btn btn-warning btn-sm w-100"
                              onClick={(e) => { e.stopPropagation(); abrirModal('revision', t); }}
                            >
                              <i className="bi bi-send me-1"></i>Enviar a revisión
                            </button>
                          )}

                          {(estadoAdmin === 'En revisión' || estadoAdmin === 'Sin certificar') && (
                            <button
                              className="btn btn-success btn-sm w-100"
                              onClick={(e) => { e.stopPropagation(); abrirModal('certificar', t); }}
                            >
                              <i className="bi bi-patch-check me-1"></i>Certificar
                            </button>
                          )}

                          {estadoAdmin !== 'Rechazado' && (
                            <button
                              className="btn btn-outline-danger btn-sm w-100"
                              onClick={(e) => { e.stopPropagation(); abrirModal('rechazar', t); }}
                            >
                              <i className="bi bi-x-circle me-1"></i>Rechazar
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════
          MODALES
      ══════════════════════════════════════ */}
      {modal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1050 }}
          onClick={() => setModal(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-dialog-scrollable"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">

              {/* ── MODAL ENVIAR A REVISIÓN ── */}
              {modal.tipo === 'revision' && (
                <>
                  <div className="modal-header bg-warning text-dark">
                    <h6 className="modal-title">
                      <i className="bi bi-send me-2"></i>Enviar a revisión
                    </h6>
                    <button className="btn-close" onClick={() => setModal(null)} />
                  </div>
                  <div className="modal-body">
                    <div className="fw-semibold mb-3">
                      <i className="bi bi-geo-alt me-1 text-primary"></i>
                      {modal.trabajo.calle1} y {modal.trabajo.calle2}
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Email del cliente *</label>
                      <input
                        type="email"
                        className="form-control"
                        placeholder="cliente@empresa.com"
                        value={emailTo}
                        onChange={(e) => setEmailTo(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Link de documentación (opcional)</label>
                      <input
                        type="url"
                        className="form-control"
                        placeholder="https://drive.google.com/..."
                        value={docLink}
                        onChange={(e) => setDocLink(e.target.value)}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Mensaje adicional (opcional)</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        placeholder="Texto adicional para incluir en el mail..."
                        value={mensaje}
                        onChange={(e) => setMensaje(e.target.value)}
                      />
                    </div>
                    {errorModal && <div className="alert alert-danger py-2 small">{errorModal}</div>}
                    <div className="alert alert-info py-2 small">
                      <i className="bi bi-info-circle me-1"></i>
                      Al confirmar se abrirá tu cliente de mail con el contenido pre-armado.
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-outline-secondary" onClick={() => setModal(null)}>Cancelar</button>
                    <button className="btn btn-warning text-dark" onClick={handleEnviarRevision} disabled={guardando}>
                      {guardando
                        ? <span className="spinner-border spinner-border-sm"></span>
                        : <><i className="bi bi-send me-1"></i>Abrir mail y enviar a revisión</>}
                    </button>
                  </div>
                </>
              )}

              {/* ── MODAL CERTIFICAR ── */}
              {modal.tipo === 'certificar' && (
                <>
                  <div className="modal-header bg-success text-white">
                    <h6 className="modal-title">
                      <i className="bi bi-patch-check me-2"></i>Certificar trabajo
                    </h6>
                    <button className="btn-close btn-close-white" onClick={() => setModal(null)} />
                  </div>
                  <div className="modal-body">
                    <div className="fw-semibold mb-3">
                      <i className="bi bi-geo-alt me-1 text-primary"></i>
                      {modal.trabajo.calle1} y {modal.trabajo.calle2}
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Link documentación (opcional)</label>
                      <input
                        type="url"
                        className="form-control"
                        placeholder="https://drive.google.com/..."
                        value={docLink}
                        onChange={(e) => setDocLink(e.target.value)}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Notas de certificación (opcional)</label>
                      <textarea
                        className="form-control"
                        rows={2}
                        placeholder="Observaciones..."
                        value={notas}
                        onChange={(e) => setNotas(e.target.value)}
                      />
                    </div>
                    {errorModal && <div className="alert alert-danger py-2 small">{errorModal}</div>}
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-outline-secondary" onClick={() => setModal(null)}>Cancelar</button>
                    <button className="btn btn-success" onClick={handleCertificar} disabled={guardando}>
                      {guardando
                        ? <span className="spinner-border spinner-border-sm"></span>
                        : <><i className="bi bi-patch-check me-1"></i>Confirmar certificación</>}
                    </button>
                  </div>
                </>
              )}

              {/* ── MODAL RECHAZAR ── */}
              {modal.tipo === 'rechazar' && (
                <>
                  <div className="modal-header bg-danger text-white">
                    <h6 className="modal-title">
                      <i className="bi bi-x-circle me-2"></i>Rechazar trabajo
                    </h6>
                    <button className="btn-close btn-close-white" onClick={() => setModal(null)} />
                  </div>
                  <div className="modal-body">
                    <div className="fw-semibold mb-3">
                      <i className="bi bi-geo-alt me-1 text-primary"></i>
                      {modal.trabajo.calle1} y {modal.trabajo.calle2}
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Motivo del rechazo *</label>
                      <textarea
                        className="form-control"
                        rows={4}
                        placeholder="Describí el motivo del rechazo..."
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        autoFocus
                      />
                    </div>
                    {errorModal && <div className="alert alert-danger py-2 small">{errorModal}</div>}
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-outline-secondary" onClick={() => setModal(null)}>Cancelar</button>
                    <button className="btn btn-danger" onClick={handleRechazar} disabled={guardando}>
                      {guardando
                        ? <span className="spinner-border spinner-border-sm"></span>
                        : <><i className="bi bi-x-circle me-1"></i>Confirmar rechazo</>}
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
