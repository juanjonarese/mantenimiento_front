import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { guardarTrabajo, obtenerTrabajoPorId } from '../db/db';
import { useGPS } from '../hooks/useGPS';
import { TIPOS_TRABAJO, ESTADOS_OPERATIVO, ESTADOS_ADMIN } from '../constants';

const ITEM_VACIO = { tipoTrabajo: '', largo: '', ancho: '', cantidad: '' };
const MATERIAL_VACIO = { nombre: '', cantidad: '', unidad: 'litros' };
const NOMBRES_MATERIAL = ['Pintura blanca', 'Pintura amarilla', 'Microesferas', 'Diluyente', 'Termoplástico', 'Otros'];
const UNIDADES_MATERIAL = ['litros', 'kg', 'unidades', 'm²'];

const FORM_VACIO = {
  calle1: '', calle2: '', lat: '', lng: '',
  items: [{ ...ITEM_VACIO }],
  estadoOperativo: 'Sin iniciar', estadoAdmin: 'Sin certificar',
  observaciones: '', linkDrive: '', linkMyMaps: '',
  materiales: [],
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
  const esAdmin = true;

  useEffect(() => {
    if (id) {
      obtenerTrabajoPorId(Number(id)).then((t) => {
        if (!t) return navigate('/lista');
        setForm({
          calle1: t.calle1, calle2: t.calle2,
          lat: t.lat, lng: t.lng,
          items: t.items || [{ tipoTrabajo: t.tipoTrabajo || '', largo: String(t.largo || ''), ancho: String(t.ancho || ''), cantidad: String(t.cantidad || '') }],
          estadoOperativo: t.estadoOperativo, estadoAdmin: t.estadoAdmin,
          observaciones: t.observaciones || '',
          linkDrive: t.linkDrive || '', linkMyMaps: t.linkMyMaps || '',
          materiales: t.materiales || [],
        });
        setFotosExistentes(t.fotos || []);
      });
    } else {
      obtenerUbicacion().then((pos) => {
        if (pos) setForm((prev) => ({ ...prev, lat: pos.lat.toFixed(6), lng: pos.lng.toFixed(6) }));
      });
    }
  }, [id]);

  const superficieTotal = form.items.reduce((sum, item) => {
    const l = parseFloat(item.largo) || 0;
    const a = parseFloat(item.ancho) || 0;
    const c = parseFloat(item.cantidad) || 0;
    return sum + l * a * c;
  }, 0).toFixed(2);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleItemChange(idx, e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? { ...item, [name]: value } : item),
    }));
  }

  function agregarItem() {
    setForm((prev) => ({ ...prev, items: [...prev.items, { ...ITEM_VACIO }] }));
  }

  function eliminarItem(idx) {
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  }

  function handleMaterialChange(idx, e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      materiales: prev.materiales.map((m, i) => i === idx ? { ...m, [name]: value } : m),
    }));
  }

  function agregarMaterial() {
    setForm((prev) => ({ ...prev, materiales: [...prev.materiales, { ...MATERIAL_VACIO }] }));
  }

  function eliminarMaterial(idx) {
    setForm((prev) => ({ ...prev, materiales: prev.materiales.filter((_, i) => i !== idx) }));
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
    if (form.items.length === 0) return setErrorForm('Agregá al menos un tipo de trabajo');
    if (form.items.some((i) => !i.tipoTrabajo)) return setErrorForm('Seleccioná el tipo para cada trabajo');
    if (form.items.some((i) => !i.largo || !i.ancho || !i.cantidad)) return setErrorForm('Completá las medidas de cada trabajo');
    if (!form.lat || !form.lng) return setErrorForm('Tomá la ubicación GPS o ingresala manualmente');

    setGuardando(true);
    try {
      const trabajoBase = esEdicion ? await obtenerTrabajoPorId(Number(id)) : {};
      const itemsCalculados = form.items.map((item) => {
        const l = parseFloat(item.largo) || 0;
        const a = parseFloat(item.ancho) || 0;
        const c = parseFloat(item.cantidad) || 0;
        return { tipoTrabajo: item.tipoTrabajo, largo: l, ancho: a, cantidad: c, superficie: parseFloat((l * a * c).toFixed(2)) };
      });
      const trabajo = {
        id: esEdicion ? Number(id) : Date.now(),
        fechaCarga: esEdicion ? trabajoBase.fechaCarga : new Date().toISOString(),
        fechaModificacion: esEdicion ? new Date().toISOString() : undefined,
        usuario: '',
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        calle1: form.calle1.trim(),
        calle2: form.calle2.trim(),
        items: itemsCalculados,
        superficie: parseFloat(superficieTotal),
        estadoOperativo: form.estadoOperativo,
        estadoAdmin: form.estadoAdmin,
        observaciones: form.observaciones,
        linkDrive: form.linkDrive,
        linkMyMaps: form.linkMyMaps,
        materiales: form.materiales.map((m) => ({ nombre: m.nombre, cantidad: parseFloat(m.cantidad) || 0, unidad: m.unidad })),
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
                : <><i className="bi bi-crosshair me-2"></i>Actualizar GPS</>}
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
          <div className="card-header bg-light fw-semibold small d-flex justify-content-between align-items-center">
            <span><i className="bi bi-tools me-1"></i> Trabajo</span>
            <button type="button" className="btn btn-sm btn-outline-primary py-0 px-2"
              onClick={agregarItem}>
              <i className="bi bi-plus-lg me-1"></i>Agregar tipo
            </button>
          </div>
          <div className="card-body">
            {form.items.map((item, idx) => (
              <div key={idx} className={idx > 0 ? 'border-top pt-3 mt-3' : ''}>
                {form.items.length > 1 && (
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="small fw-semibold text-muted">Tipo {idx + 1}</span>
                    <button type="button" className="btn btn-sm btn-outline-danger py-0 px-2"
                      onClick={() => eliminarItem(idx)}>
                      <i className="bi bi-x-lg"></i>
                    </button>
                  </div>
                )}
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Tipo de trabajo *</label>
                  <select className="form-select" name="tipoTrabajo"
                    value={item.tipoTrabajo} onChange={(e) => handleItemChange(idx, e)}>
                    <option value="">Seleccioná...</option>
                    {TIPOS_TRABAJO.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="row g-2 mb-1">
                  <div className="col-4">
                    <label className="form-label small fw-semibold">Largo (m) *</label>
                    <input type="number" step="any" min="0" className="form-control"
                      name="largo" value={item.largo} onChange={(e) => handleItemChange(idx, e)} placeholder="0" />
                  </div>
                  <div className="col-4">
                    <label className="form-label small fw-semibold">Ancho (m) *</label>
                    <input type="number" step="any" min="0" className="form-control"
                      name="ancho" value={item.ancho} onChange={(e) => handleItemChange(idx, e)} placeholder="0" />
                  </div>
                  <div className="col-4">
                    <label className="form-label small fw-semibold">Cantidad *</label>
                    <input type="number" step="any" min="0" className="form-control"
                      name="cantidad" value={item.cantidad} onChange={(e) => handleItemChange(idx, e)} placeholder="0" />
                  </div>
                </div>
                {form.items.length > 1 && (() => {
                  const s = (parseFloat(item.largo) || 0) * (parseFloat(item.ancho) || 0) * (parseFloat(item.cantidad) || 0);
                  return s > 0 ? <div className="text-end small text-muted mt-1">{s.toFixed(2)} m²</div> : null;
                })()}
              </div>
            ))}
            <div className="alert alert-info py-2 text-center mt-3 mb-0">
              <strong className="fs-5">{superficieTotal} m²</strong>
              <div className="small text-muted">superficie total</div>
            </div>
          </div>
        </div>

        {/* MATERIAL UTILIZADO */}
        <div className="card mb-3">
          <div className="card-header bg-light fw-semibold small d-flex justify-content-between align-items-center">
            <span><i className="bi bi-box-seam me-1"></i> Material utilizado</span>
            <button type="button" className="btn btn-sm btn-outline-primary py-0 px-2"
              onClick={agregarMaterial}>
              <i className="bi bi-plus-lg me-1"></i>Agregar
            </button>
          </div>
          <div className="card-body">
            {form.materiales.length === 0 ? (
              <div className="text-center text-muted small py-2">
                Sin materiales — usá "Agregar" para registrar
              </div>
            ) : (
              form.materiales.map((mat, idx) => (
                <div key={idx} className="d-flex gap-2 align-items-center mb-2">
                  <select className="form-select form-select-sm flex-grow-1"
                    name="nombre" value={mat.nombre} onChange={(e) => handleMaterialChange(idx, e)}>
                    <option value="">Material...</option>
                    {NOMBRES_MATERIAL.map((n) => <option key={n}>{n}</option>)}
                  </select>
                  <input type="number" step="any" min="0" className="form-control form-control-sm"
                    style={{ width: 75 }} name="cantidad" value={mat.cantidad}
                    onChange={(e) => handleMaterialChange(idx, e)} placeholder="Cant." />
                  <select className="form-select form-select-sm" style={{ width: 90 }}
                    name="unidad" value={mat.unidad} onChange={(e) => handleMaterialChange(idx, e)}>
                    {UNIDADES_MATERIAL.map((u) => <option key={u}>{u}</option>)}
                  </select>
                  <button type="button" className="btn btn-sm btn-outline-danger py-0 px-2"
                    onClick={() => eliminarMaterial(idx)}>
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ESTADOS */}
        <div className="card mb-3">
          <div className="card-header bg-light fw-semibold small">
            <i className="bi bi-flag me-1"></i> Estados
          </div>
          <div className="card-body">
            <div className={esAdmin ? 'mb-3' : ''}>
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
            {esAdmin && (
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
            )}
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
