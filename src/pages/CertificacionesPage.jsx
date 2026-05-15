import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { obtenerTrabajos, guardarTrabajo } from '../db/db';

const ESTADOS_PENDIENTE = ['Terminado', 'Finalizado'];

export default function CertificacionesPage() {
  const [trabajos, setTrabajos] = useState([]);
  const [filtro, setFiltro] = useState('pendientes');

  // Modal
  const [modal, setModal] = useState(null); // { tipo: 'certificar'|'rechazar', trabajo }
  const [docLink, setDocLink] = useState('');
  const [notas, setNotas] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errorModal, setErrorModal] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    const todos = await obtenerTrabajos();
    const terminados = todos.filter((t) => ESTADOS_PENDIENTE.includes(t.estadoOperativo));
    setTrabajos(terminados);
  }

  const filtrados = trabajos.filter((t) => {
    if (filtro === 'pendientes') return t.estadoAdmin === 'Sin certificar' || !t.estadoAdmin;
    if (filtro === 'certificados') return t.estadoAdmin === 'Certificado';
    if (filtro === 'rechazados') return t.estadoAdmin === 'Rechazado';
    return true;
  });

  function abrirModal(tipo, trabajo) {
    setModal({ tipo, trabajo });
    setDocLink('');
    setNotas('');
    setMotivo('');
    setErrorModal('');
  }

  async function confirmar() {
    if (modal.tipo === 'rechazar' && !motivo.trim()) {
      return setErrorModal('Ingresá el motivo del rechazo');
    }
    setGuardando(true);
    try {
      const actualizado = {
        ...modal.trabajo,
        estadoAdmin: modal.tipo === 'certificar' ? 'Certificado' : 'Rechazado',
        fechaCertificacion: new Date().toISOString(),
        ...(modal.tipo === 'certificar'
          ? { documentacionCertificacion: docLink.trim(), notasCertificacion: notas.trim() }
          : { motivoRechazo: motivo.trim() }),
        sincronizado: false,
      };
      await guardarTrabajo(actualizado);
      setModal(null);
      await cargar();
    } finally {
      setGuardando(false);
    }
  }

  function badgeAdmin(estado) {
    if (estado === 'Certificado') return 'bg-success';
    if (estado === 'Rechazado') return 'bg-danger';
    return 'bg-secondary';
  }

  return (
    <div className="container-fluid p-3 pb-5">
      <h5 className="fw-bold mb-3">
        <i className="bi bi-patch-check me-2 text-success"></i>Certificaciones
      </h5>

      {/* Filtros */}
      <div className="d-flex gap-2 mb-3 flex-wrap">
        {[
          { key: 'pendientes', label: 'Pendientes' },
          { key: 'certificados', label: 'Certificados' },
          { key: 'rechazados', label: 'Rechazados' },
          { key: 'todos', label: 'Todos' },
        ].map(({ key, label }) => (
          <button key={key}
            className={`btn btn-sm ${filtro === key ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setFiltro(key)}>
            {label}
            {key === 'pendientes' && (
              <span className="ms-1 badge bg-white text-primary">
                {trabajos.filter((t) => t.estadoAdmin === 'Sin certificar' || !t.estadoAdmin).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <div className="text-center text-muted py-5">
          <i className="bi bi-inbox fs-1 d-block mb-2"></i>
          No hay trabajos {filtro === 'pendientes' ? 'pendientes de certificación' : `en estado "${filtro}"`}
        </div>
      ) : (
        filtrados.map((t) => {
          const superficieTotal = (t.items || []).reduce((s, i) => s + (i.superficie || 0), 0).toFixed(2);
          const estadoAdmin = t.estadoAdmin || 'Sin certificar';
          return (
            <div key={t.id} className="card mb-3">
              <div className="card-header d-flex justify-content-between align-items-center py-2">
                <div>
                  <span className="fw-semibold">
                    <i className="bi bi-geo-alt me-1 text-primary"></i>
                    {t.calle1} y {t.calle2}
                  </span>
                  <div className="text-muted small">
                    {new Date(t.fechaCarga).toLocaleDateString('es-AR')}
                    {t.usuario ? ` · ${t.usuario}` : ''}
                  </div>
                </div>
                <span className={`badge ${badgeAdmin(estadoAdmin)}`}>{estadoAdmin}</span>
              </div>

              <div className="card-body py-2 small">
                {(t.items || []).map((item, i) => (
                  <div key={i} className="d-flex justify-content-between">
                    <span>{item.tipoTrabajo}</span>
                    <span className="text-muted">{item.superficie} m²</span>
                  </div>
                ))}
                <div className="border-top mt-1 pt-1 d-flex justify-content-between fw-semibold">
                  <span>Total</span>
                  <span>{superficieTotal} m²</span>
                </div>

                {t.observaciones && (
                  <div className="mt-2 text-muted fst-italic">"{t.observaciones}"</div>
                )}

                {estadoAdmin === 'Certificado' && (
                  <div className="mt-2 text-success small">
                    <i className="bi bi-check-circle me-1"></i>
                    Certificado el {new Date(t.fechaCertificacion).toLocaleDateString('es-AR')}
                    {t.documentacionCertificacion && (
                      <> · <a href={t.documentacionCertificacion} target="_blank" rel="noreferrer">Ver doc</a></>
                    )}
                    {t.notasCertificacion && <div className="text-muted">{t.notasCertificacion}</div>}
                  </div>
                )}

                {estadoAdmin === 'Rechazado' && (
                  <div className="mt-2 text-danger small">
                    <i className="bi bi-x-circle me-1"></i>
                    Rechazado: {t.motivoRechazo}
                  </div>
                )}
              </div>

              <div className="card-footer d-flex gap-2 py-2 bg-transparent">
                <Link to={`/detalle/${t.id}`} className="btn btn-outline-secondary btn-sm">
                  <i className="bi bi-eye me-1"></i>Ver
                </Link>
                {estadoAdmin !== 'Certificado' && (
                  <button className="btn btn-success btn-sm flex-fill"
                    onClick={() => abrirModal('certificar', t)}>
                    <i className="bi bi-patch-check me-1"></i>Certificar
                  </button>
                )}
                {estadoAdmin !== 'Rechazado' && (
                  <button className="btn btn-danger btn-sm flex-fill"
                    onClick={() => abrirModal('rechazar', t)}>
                    <i className="bi bi-x-circle me-1"></i>Rechazar
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* MODAL */}
      {modal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className={`modal-header text-white ${modal.tipo === 'certificar' ? 'bg-success' : 'bg-danger'}`}>
                <h6 className="modal-title">
                  <i className={`bi ${modal.tipo === 'certificar' ? 'bi-patch-check' : 'bi-x-circle'} me-2`}></i>
                  {modal.tipo === 'certificar' ? 'Certificar trabajo' : 'Rechazar trabajo'}
                </h6>
                <button className="btn-close btn-close-white" onClick={() => setModal(null)} />
              </div>
              <div className="modal-body">
                <div className="fw-semibold mb-3">
                  {modal.trabajo.calle1} y {modal.trabajo.calle2}
                </div>

                {modal.tipo === 'certificar' ? (
                  <>
                    <div className="mb-3">
                      <label className="form-label small fw-semibold">Link documentación (opcional)</label>
                      <input type="url" className="form-control" placeholder="https://drive.google.com/..."
                        value={docLink} onChange={(e) => setDocLink(e.target.value)} />
                    </div>
                    <div className="mb-3">
                      <label className="form-label small fw-semibold">Notas (opcional)</label>
                      <textarea className="form-control" rows={2} placeholder="Observaciones de la certificación..."
                        value={notas} onChange={(e) => setNotas(e.target.value)} />
                    </div>
                  </>
                ) : (
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Motivo del rechazo *</label>
                    <textarea className="form-control" rows={3} placeholder="Describí el motivo del rechazo..."
                      value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                  </div>
                )}

                {errorModal && <div className="alert alert-danger py-2 small">{errorModal}</div>}
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setModal(null)}>Cancelar</button>
                <button
                  className={`btn ${modal.tipo === 'certificar' ? 'btn-success' : 'btn-danger'}`}
                  onClick={confirmar} disabled={guardando}>
                  {guardando
                    ? <span className="spinner-border spinner-border-sm"></span>
                    : modal.tipo === 'certificar' ? 'Confirmar certificación' : 'Confirmar rechazo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
