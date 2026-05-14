import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { obtenerTrabajoPorId, eliminarTrabajo } from '../db/db';
import { COLORES_ESTADO_OP, COLORES_ESTADO_ADMIN } from '../constants';

export default function DetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trabajo, setTrabajo] = useState(null);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);

  useEffect(() => {
    obtenerTrabajoPorId(Number(id)).then((t) => {
      if (!t) navigate('/lista');
      else setTrabajo(t);
    });
  }, [id]);

  async function handleEliminar() {
    if (!confirm('¿Eliminar este trabajo?')) return;
    await eliminarTrabajo(trabajo.id);
    navigate('/lista');
  }

  if (!trabajo) return (
    <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
      <div className="spinner-border text-primary"></div>
    </div>
  );

  return (
    <div className="container-fluid p-3 pb-5">
      <div className="d-flex align-items-center mb-3 gap-2">
        <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate(-1)}>
          <i className="bi bi-arrow-left"></i>
        </button>
        <h5 className="fw-bold mb-0 flex-grow-1">Detalle del trabajo</h5>
        <Link to={`/editar/${trabajo.id}`} className="btn btn-sm btn-outline-primary">
          <i className="bi bi-pencil me-1"></i>Editar
        </Link>
      </div>

      <div className="d-flex gap-2 mb-3 flex-wrap">
        <span className={`badge bg-${COLORES_ESTADO_OP[trabajo.estadoOperativo]} fs-6`}>
          {trabajo.estadoOperativo}
        </span>
        <span className={`badge bg-${COLORES_ESTADO_ADMIN[trabajo.estadoAdmin]} fs-6`}>
          {trabajo.estadoAdmin}
        </span>
        {!trabajo.sincronizado && (
          <span className="badge bg-secondary fs-6">
            <i className="bi bi-cloud-slash me-1"></i>No sincronizado
          </span>
        )}
      </div>

      <div className="card mb-3">
        <div className="card-header bg-light fw-semibold small">
          <i className="bi bi-pin-map me-1"></i> Ubicación
        </div>
        <div className="card-body">
          <div className="fw-bold fs-5 mb-1">{trabajo.calle1} y {trabajo.calle2}</div>
          <div className="text-muted small mb-2">{trabajo.lat}, {trabajo.lng}</div>
          <div className="text-muted small mb-3">
            <i className="bi bi-person me-1"></i>{trabajo.usuario} ·{' '}
            <i className="bi bi-clock me-1"></i>
            {new Date(trabajo.fechaCarga).toLocaleString('es-AR', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <a href={`https://maps.google.com/?q=${trabajo.lat},${trabajo.lng}`}
              target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-success">
              <i className="bi bi-map me-1"></i>Google Maps
            </a>
            {trabajo.linkMyMaps && (
              <a href={trabajo.linkMyMaps} target="_blank" rel="noreferrer"
                className="btn btn-sm btn-outline-info">
                <i className="bi bi-geo me-1"></i>My Maps
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-header bg-light fw-semibold small">
          <i className="bi bi-tools me-1"></i> Trabajo
        </div>
        <div className="card-body">
          {(trabajo.items || [{ tipoTrabajo: trabajo.tipoTrabajo, largo: trabajo.largo, ancho: trabajo.ancho, cantidad: trabajo.cantidad, superficie: trabajo.superficie }]).map((item, idx, arr) => (
            <div key={idx} className={idx > 0 ? 'border-top pt-2 mt-2' : ''}>
              <div className="mb-2">
                <span className="badge bg-primary">{item.tipoTrabajo}</span>
              </div>
              <div className="row text-center g-2 mb-1">
                <div className="col-4">
                  <div className="bg-light rounded p-2">
                    <div className="fw-bold">{item.largo} m</div>
                    <div className="small text-muted">Largo</div>
                  </div>
                </div>
                <div className="col-4">
                  <div className="bg-light rounded p-2">
                    <div className="fw-bold">{item.ancho} m</div>
                    <div className="small text-muted">Ancho</div>
                  </div>
                </div>
                <div className="col-4">
                  <div className="bg-light rounded p-2">
                    <div className="fw-bold">{item.cantidad}</div>
                    <div className="small text-muted">Cantidad</div>
                  </div>
                </div>
              </div>
              {arr.length > 1 && item.superficie > 0 && (
                <div className="text-end small text-muted">{item.superficie} m²</div>
              )}
            </div>
          ))}
          <div className="alert alert-info text-center py-2 mb-0 mt-2">
            <strong className="fs-4">{trabajo.superficie} m²</strong>
            <div className="small">superficie total</div>
          </div>
        </div>
      </div>

      {trabajo.materiales?.length > 0 && (
        <div className="card mb-3">
          <div className="card-header bg-light fw-semibold small">
            <i className="bi bi-box-seam me-1"></i> Material utilizado
          </div>
          <div className="card-body p-0">
            {trabajo.materiales.map((m, i) => (
              <div key={i} className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
                <span>{m.nombre}</span>
                <span className="fw-bold text-primary">{m.cantidad} {m.unidad}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {trabajo.fotos?.length > 0 && (
        <div className="card mb-3">
          <div className="card-header bg-light fw-semibold small">
            <i className="bi bi-camera me-1"></i> Fotos y videos ({trabajo.fotos.length})
          </div>
          <div className="card-body">
            <div className="d-flex flex-wrap gap-2">
              {trabajo.fotos.map((f, i) => (
                <div key={i}
                  onClick={() => f.tipo?.startsWith('image') && setFotoAmpliada(f.data)}
                  style={{ cursor: f.tipo?.startsWith('image') ? 'pointer' : 'default' }}>
                  {f.tipo?.startsWith('image') ? (
                    <img src={f.data} alt={f.nombre}
                      style={{ width: 80, height: 80, objectFit: 'cover' }}
                      className="rounded border" />
                  ) : (
                    <div className="bg-light border rounded d-flex flex-column align-items-center justify-content-center p-2"
                      style={{ width: 80, height: 80 }}>
                      <i className="bi bi-camera-video text-secondary fs-4"></i>
                      <div className="small text-muted text-center" style={{ fontSize: 9 }}>
                        {f.nombre}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {trabajo.linkDrive && (
        <div className="card mb-3">
          <div className="card-body py-2">
            <a href={trabajo.linkDrive} target="_blank" rel="noreferrer"
              className="btn btn-outline-warning w-100">
              <i className="bi bi-google me-2"></i>Abrir carpeta en Google Drive
            </a>
          </div>
        </div>
      )}

      {trabajo.observaciones && (
        <div className="card mb-3">
          <div className="card-header bg-light fw-semibold small">
            <i className="bi bi-chat-text me-1"></i> Observaciones
          </div>
          <div className="card-body">
            <p className="mb-0">{trabajo.observaciones}</p>
          </div>
        </div>
      )}

      <button className="btn btn-outline-danger w-100" onClick={handleEliminar}>
        <i className="bi bi-trash me-2"></i>Eliminar trabajo
      </button>

      {fotoAmpliada && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ background: 'rgba(0,0,0,0.9)', zIndex: 9999 }}
          onClick={() => setFotoAmpliada(null)}>
          <img src={fotoAmpliada} alt="ampliada"
            style={{ maxWidth: '95vw', maxHeight: '90vh', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  );
}
