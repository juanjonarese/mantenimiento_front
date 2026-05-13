import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { guardarTrabajo, obtenerTrabajoPorId } from '../db/db';
import { useGPS } from '../hooks/useGPS';
import { TIPOS_TRABAJO, ESTADOS_OPERATIVO, ESTADOS_ADMIN } from '../constants';

const FORM_VACIO = {
  calle1: '', calle2: '', lat: '', lng: '',
  tipoTrabajo: '', largo: '', ancho: '', cantidad: '',
  estadoOperativo: 'Sin iniciar', estadoAdmin: 'Sin certificar',
  observaciones: '', linkDrive: '', linkMyMaps: '',
};

export default function NuevoTrabajoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { obtenerUbicacion, cargando: cargandoGPS, error: errorGPS } = useGPS();
  const [form, setForm] = useState(FORM_VACIO);
  const [fotos, setFotos] = useState([]);
  const [fotosExistentes, setFotosExistentes] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');
  const fileRef = useRef();
  const esEdicion = Boolean(id);

  useEffect(() => {
    if (id) {
      obtenerTrabajoPorId(Number(id)).then((t) => {
        if (!t) return navigate('/lista');
        setForm({
          calle1: t.calle1, calle2: t.calle2,
          lat: t.lat, lng: t.lng,
          tipoTrabajo: t.tipoTrabajo, largo: t.largo,
          ancho: t.ancho, cantidad: t.cantidad,
          estadoOperativo: t.estadoOperativo, estadoAdmin: t.estadoAdmin,
          observaciones: t.observaciones || '',
          linkDrive: t.linkDrive || '', linkMyMaps: t.linkMyMaps || '',
        });
        setFotosExistentes(t.fotos || []);
      });
    }
  }, [id]);

  const superficie = (() => {
    const l = parseFloat(form.largo) || 0;
    const a = parseFloat(form.ancho) || 0;
    const c = parseFloat(form.cantidad) || 0;
    return (l * a * c).toFixed(2);
  })();

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleGPS() {
    const pos = await obtenerUbicacion();
    if (pos) setForm((prev) => ({ ...prev, lat: pos.lat.toFixed(6), lng: pos.lng.toFixed(6) }));
  }

  async function handleFotos(e) {
    const archivos = Array.from(e.target.files);
    const nuevas = await Promise.all(
      archivos.map((file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve({ nombre: file.name, tipo: file.type, data: reader.result, subido: false });
          reader.readAsDataURL(file);
        })
      )
    );
    setFotos((prev) => [...prev, ...nuevas]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorForm('');
    if (!form.calle1 || !form.calle2) return setErrorForm('Ingresá las dos calles de la intersección');
    if (!form.tipoTrabajo) return setErrorForm('Seleccioná el tipo de trabajo');
    if (!form.largo || !form.ancho || !form.cantidad) return setErrorForm('Completá las medidas');
    if (!form.lat || !form.lng) return setErrorForm('Tomá la ubicación GPS o ingresala manualmente');

    setGuardando(true);
    try {
      const trabajoBase = esEdicion ? await obtenerTrabajoPorId(Number(id)) : {};
      const trabajo = {
        id: esEdicion ? Number(id) : Date.now(),
        fechaCarga: esEdicion ? trabajoBase.fechaCarga : new Date().toISOString(),
        fechaModificacion: esEdicion ? new Date().toISOString() : undefined,
        usuario: localStorage.getItem('email') || '',
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        calle1: form.calle1.trim(),
        calle2: form.calle2.trim(),
        tipoTrabajo: form.tipoTrabajo,
        largo: parseFloat(form.largo),
        ancho: parseFloat(form.ancho),
        cantidad: parseFloat(form.cantidad),
        superficie: parseFloat(superficie),
        estadoOperativo: form.estadoOperativo,
        estadoAdmin: form.estadoAdmin,
        observaciones: form.observaciones,
        linkDrive: form.linkDrive,
        linkMyMaps: form.linkMyMaps,
        fotos: [...fotosExistentes, ...fotos],
        sincronizado: false,
      };
      await guardarTrabajo(trabajo);
      navigate('/lista');
    } catch {
      setErrorForm('Error al guardar. Intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="container-fluid p-3 pb-5">
      <h5 className="fw-bold mb-3">
        <i className="bi bi-geo-alt me-2 text-primary"></i>
        {esEdicion ? 'Editar trabajo' : 'Nuevo trabajo'}
      </h5>

      <form onSubmit={handleSubmit}>
        {/* UBICACIÓN */}
        <div className="card mb-3">
          <div className="card-header bg-light fw-semibold small">
            <i className="bi bi-pin-map me-1"></i> Ubicación
          </div>
          <div className="card-body">
            <button type="button" className="btn btn-outline-primary w-100 mb-3"
              onClick={handleGPS} disabled={cargandoGPS}>
              {cargandoGPS
                ? <><span className="spinner-border spinner-border-sm me-2"></span>Obteniendo GPS...</>
                : <><i className="bi bi-crosshair me-2"></i>Tomar ubicación GPS</>}
            </button>
            {errorGPS && <div className="alert alert-danger py-1 small">{errorGPS}</div>}
            <div className="row g-2 mb-3">
              <div className="col-6">
                <label className="form-label small fw-semibold">Latitud</label>
                <input type="number" step="any" className="form-control form-control-sm"
                  name="lat" value={form.lat} onChange={handleChange} placeholder="-34.6037" />
              </div>
              <div className="col-6">
                <label className="form-label small fw-semibold">Longitud</label>
                <input type="number" step="any" className="form-control form-control-sm"
                  name="lng" value={form.lng} onChange={handleChange} placeholder="-58.3816" />
              </div>
            </div>
            {form.lat && form.lng && (
              <a href={`https://maps.google.com/?q=${form.lat},${form.lng}`}
                target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-success w-100">
                <i className="bi bi-map me-1"></i>Ver en Google Maps
              </a>
            )}
            <div className="row g-2 mt-2">
              <div className="col-6">
                <label className="form-label small fw-semibold">Calle 1 *</label>
                <input type="text" className="form-control" name="calle1"
                  value={form.calle1} onChange={handleChange} placeholder="Av. Rivadavia" />
              </div>
              <div className="col-6">
                <label className="form-label small fw-semibold">Calle 2 *</label>
                <input type="text" className="form-control" name="calle2"
                  value={form.calle2} onChange={handleChange} placeholder="Pueyrredón" />
              </div>
            </div>
          </div>
        </div>

        {/* TRABAJO */}
        <div className="card mb-3">
          <div className="card-header bg-light fw-semibold small">
            <i className="bi bi-tools me-1"></i> Trabajo
          </div>
          <div className="card-body">
            <div className="mb-3">
              <label className="form-label small fw-semibold">Tipo de trabajo *</label>
              <select className="form-select" name="tipoTrabajo"
                value={form.tipoTrabajo} onChange={handleChange}>
                <option value="">Seleccioná...</option>
                {TIPOS_TRABAJO.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="row g-2 mb-2">
              <div className="col-4">
                <label className="form-label small fw-semibold">Largo (m) *</label>
                <input type="number" step="any" min="0" className="form-control"
                  name="largo" value={form.largo} onChange={handleChange} placeholder="0" />
              </div>
              <div className="col-4">
                <label className="form-label small fw-semibold">Ancho (m) *</label>
                <input type="number" step="any" min="0" className="form-control"
                  name="ancho" value={form.ancho} onChange={handleChange} placeholder="0" />
              </div>
              <div className="col-4">
                <label className="form-label small fw-semibold">Cantidad *</label>
                <input type="number" step="any" min="0" className="form-control"
                  name="cantidad" value={form.cantidad} onChange={handleChange} placeholder="0" />
              </div>
            </div>
            <div className="alert alert-info py-2 text-center">
              <strong className="fs-5">{superficie} m²</strong>
              <div className="small text-muted">superficie calculada</div>
            </div>
          </div>
        </div>

        {/* ESTADOS */}
        <div className="card mb-3">
          <div className="card-header bg-light fw-semibold small">
            <i className="bi bi-flag me-1"></i> Estados
          </div>
          <div className="card-body">
            <div className="mb-3">
              <label className="form-label small fw-semibold">Estado operativo</label>
              <div className="d-flex gap-2 flex-wrap">
                {ESTADOS_OPERATIVO.map((e) => (
                  <div key={e}>
                    <input type="radio" className="btn-check" name="estadoOperativo"
                      id={`op-${e}`} value={e}
                      checked={form.estadoOperativo === e} onChange={handleChange} />
                    <label className="btn btn-sm btn-outline-secondary" htmlFor={`op-${e}`}>{e}</label>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="form-label small fw-semibold">Certificación</label>
              <div className="d-flex gap-2 flex-wrap">
                {ESTADOS_ADMIN.map((e) => (
                  <div key={e}>
                    <input type="radio" className="btn-check" name="estadoAdmin"
                      id={`adm-${e}`} value={e}
                      checked={form.estadoAdmin === e} onChange={handleChange} />
                    <label className="btn btn-sm btn-outline-secondary" htmlFor={`adm-${e}`}>{e}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* FOTOS Y VIDEOS */}
        <div className="card mb-3">
          <div className="card-header bg-light fw-semibold small">
            <i className="bi bi-camera me-1"></i> Fotos y videos
          </div>
          <div className="card-body">
            <button type="button" className="btn btn-outline-secondary w-100 mb-3"
              onClick={() => fileRef.current.click()}>
              <i className="bi bi-upload me-2"></i>Adjuntar fotos / videos
            </button>
            <input ref={fileRef} type="file" multiple accept="image/*,video/*"
              capture="environment" className="d-none" onChange={handleFotos} />

            {fotosExistentes.length > 0 && (
              <div className="mb-2">
                <div className="small text-muted mb-1">Archivos guardados:</div>
                <div className="d-flex flex-wrap gap-2">
                  {fotosExistentes.map((f, i) => (
                    <div key={i} className="position-relative">
                      {f.tipo?.startsWith('image') ? (
                        <img src={f.data} alt={f.nombre}
                          style={{ width: 70, height: 70, objectFit: 'cover' }}
                          className="rounded border" />
                      ) : (
                        <div className="bg-light border rounded d-flex align-items-center justify-content-center"
                          style={{ width: 70, height: 70 }}>
                          <i className="bi bi-camera-video text-secondary fs-4"></i>
                        </div>
                      )}
                      <button type="button"
                        className="btn btn-danger btn-sm position-absolute top-0 end-0 p-0"
                        style={{ width: 18, height: 18, fontSize: 10, lineHeight: 1 }}
                        onClick={() => setFotosExistentes((prev) => prev.filter((_, j) => j !== i))}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {fotos.length > 0 && (
              <div>
                <div className="small text-muted mb-1">Nuevos ({fotos.length}):</div>
                <div className="d-flex flex-wrap gap-2">
                  {fotos.map((f, i) => (
                    <div key={i} className="position-relative">
                      {f.tipo?.startsWith('image') ? (
                        <img src={f.data} alt={f.nombre}
                          style={{ width: 70, height: 70, objectFit: 'cover' }}
                          className="rounded border" />
                      ) : (
                        <div className="bg-light border rounded d-flex align-items-center justify-content-center"
                          style={{ width: 70, height: 70 }}>
                          <i className="bi bi-camera-video text-secondary fs-4"></i>
                        </div>
                      )}
                      <button type="button"
                        className="btn btn-danger btn-sm position-absolute top-0 end-0 p-0"
                        style={{ width: 18, height: 18, fontSize: 10, lineHeight: 1 }}
                        onClick={() => setFotos((prev) => prev.filter((_, j) => j !== i))}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* LINKS Y OBSERVACIONES */}
        <div className="card mb-3">
          <div className="card-header bg-light fw-semibold small">
            <i className="bi bi-link-45deg me-1"></i> Links y observaciones
          </div>
          <div className="card-body">
            <div className="mb-2">
              <label className="form-label small fw-semibold">Link Google Drive</label>
              <input type="url" className="form-control" name="linkDrive"
                value={form.linkDrive} onChange={handleChange}
                placeholder="https://drive.google.com/..." />
            </div>
            <div className="mb-2">
              <label className="form-label small fw-semibold">Link My Maps</label>
              <input type="url" className="form-control" name="linkMyMaps"
                value={form.linkMyMaps} onChange={handleChange}
                placeholder="https://mymaps.google.com/..." />
            </div>
            <div>
              <label className="form-label small fw-semibold">Observaciones</label>
              <textarea className="form-control" name="observaciones" rows={3}
                value={form.observaciones} onChange={handleChange}
                placeholder="Notas adicionales..." />
            </div>
          </div>
        </div>

        {errorForm && <div className="alert alert-danger">{errorForm}</div>}

        <div className="d-flex flex-column flex-sm-row gap-2">
          <button type="submit" className="btn btn-primary btn-lg flex-sm-fill" disabled={guardando}>
            {guardando
              ? <><span className="spinner-border spinner-border-sm me-2"></span>Guardando...</>
              : <><i className="bi bi-check-circle me-2"></i>{esEdicion ? 'Guardar cambios' : 'Guardar trabajo'}</>}
          </button>
          <button type="button" className="btn btn-outline-secondary btn-lg" onClick={() => navigate(-1)}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
