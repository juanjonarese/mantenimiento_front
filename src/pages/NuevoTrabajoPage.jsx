import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { guardarTrabajo, obtenerTrabajoPorId } from '../db/db';
import { useGPS } from '../hooks/useGPS';
import { comprimirMedia } from '../utils/comprimirMedia';
import { TIPOS_TRABAJO, ESTADOS_OPERATIVO, ESTADOS_ADMIN } from '../constants';

const iconoMarcador = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function MoverMapa({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng && !isNaN(lat) && !isNaN(lng)) map.setView([lat, lng], 17);
  }, [lat, lng]);
  return null;
}

const MATERIAL_VACIO = { nombre: '', cantidad: '', unidad: 'litros' };
const NOMBRES_MATERIAL = ['Pintura blanca', 'Pintura amarilla', 'Microesferas', 'Diluyente', 'Termoplástico', 'Otros'];
const UNIDADES_MATERIAL = ['litros', 'kg', 'unidades', 'm²'];
const TRABAJO_VACIO = { tipoTrabajo: '', largo: '', ancho: '', cantidad: '', materiales: [] };

const FORM_VACIO = {
  calle1: '', calle2: '', lat: '', lng: '',
  trabajos: [],
  estadoOperativo: 'Sin iniciar', estadoAdmin: 'Sin certificar',
  observaciones: '', linkDrive: '', linkMyMaps: '',
};

export default function NuevoTrabajoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { obtenerUbicacion, cargando: cargandoGPS, error: errorGPS, bloqueado: gpsBloqueado } = useGPS();

  const [form, setForm] = useState(FORM_VACIO);
  const [fotos, setFotos] = useState([]);
  const [fotosExistentes, setFotosExistentes] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');
  const [comprimiendo, setComprimiendo] = useState(false);
  const [mapaListo, setMapaListo] = useState(false);
  const [gpsFallo, setGpsFallo] = useState(false);

  // Modal
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [modalForm, setModalForm] = useState({ ...TRABAJO_VACIO });
  const [errorModal, setErrorModal] = useState('');

  const mapaKeyRef = useRef('default');
  const fileRef = useRef();
  const esEdicion = Boolean(id);
  const esAdmin = true;

  useEffect(() => {
    if (id) {
      obtenerTrabajoPorId(Number(id)).then((t) => {
        if (!t) return navigate('/lista');
        // Convertir formato viejo (items + materiales compartidos) al nuevo (trabajos con materiales propios)
        const trabajos = (t.items || []).map((item, idx) => ({
          tipoTrabajo: item.tipoTrabajo || '',
          largo: String(item.largo || ''),
          ancho: String(item.ancho || ''),
          cantidad: String(item.cantidad || ''),
          materiales: item.materiales || (idx === 0 ? (t.materiales || []) : []),
        }));
        setForm({
          calle1: t.calle1, calle2: t.calle2,
          lat: t.lat, lng: t.lng,
          trabajos,
          estadoOperativo: t.estadoOperativo, estadoAdmin: t.estadoAdmin,
          observaciones: t.observaciones || '',
          linkDrive: t.linkDrive || '', linkMyMaps: t.linkMyMaps || '',
        });
        setFotosExistentes(t.fotos || []);
        setMapaListo(true);
      });
    } else {
      obtenerUbicacion().then((pos) => {
        if (pos) {
          const lat = pos.lat.toFixed(6);
          const lng = pos.lng.toFixed(6);
          mapaKeyRef.current = `${lat},${lng}`;
          setForm((prev) => ({ ...prev, lat, lng }));
        } else {
          setGpsFallo(true);
        }
        setMapaListo(true);
      });
    }
  }, [id]);

  const superficieTotal = form.trabajos.reduce((sum, t) => {
    return sum + (parseFloat(t.largo) || 0) * (parseFloat(t.ancho) || 0) * (parseFloat(t.cantidad) || 0);
  }, 0).toFixed(2);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleGPS() {
    const pos = await obtenerUbicacion();
    if (pos) {
      setGpsFallo(false);
      setForm((prev) => ({ ...prev, lat: pos.lat.toFixed(6), lng: pos.lng.toFixed(6) }));
    }
  }

  // ── Modal ──────────────────────────────────────────────
  function abrirModalNuevo() {
    setEditIdx(null);
    setModalForm({ ...TRABAJO_VACIO });
    setErrorModal('');
    setModalAbierto(true);
  }

  function abrirModalEditar(idx) {
    setEditIdx(idx);
    setModalForm({ ...form.trabajos[idx] });
    setErrorModal('');
    setModalAbierto(true);
  }

  function eliminarTrabajo(idx) {
    setForm((prev) => ({ ...prev, trabajos: prev.trabajos.filter((_, i) => i !== idx) }));
  }

  function handleModalChange(e) {
    setModalForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function agregarMaterialModal() {
    setModalForm((prev) => ({ ...prev, materiales: [...prev.materiales, { ...MATERIAL_VACIO }] }));
  }

  function handleMaterialModal(idx, e) {
    const { name, value } = e.target;
    setModalForm((prev) => ({
      ...prev,
      materiales: prev.materiales.map((m, i) => i === idx ? { ...m, [name]: value } : m),
    }));
  }

  function eliminarMaterialModal(idx) {
    setModalForm((prev) => ({ ...prev, materiales: prev.materiales.filter((_, i) => i !== idx) }));
  }

  function guardarModal() {
    if (!modalForm.tipoTrabajo) return setErrorModal('Seleccioná el tipo de trabajo');
    if (!modalForm.largo || !modalForm.ancho || !modalForm.cantidad) return setErrorModal('Completá las medidas');
    setErrorModal('');
    setForm((prev) => {
      const trabajos = [...prev.trabajos];
      if (editIdx === null) {
        trabajos.push({ ...modalForm });
      } else {
        trabajos[editIdx] = { ...modalForm };
      }
      return { ...prev, trabajos };
    });
    setModalAbierto(false);
  }
  // ──────────────────────────────────────────────────────

  async function handleFotos(e) {
    const archivos = Array.from(e.target.files);
    if (!archivos.length) return;
    setComprimiendo(true);
    setErrorForm('');
    try {
      const nuevas = await Promise.all(archivos.map(comprimirMedia));
      setFotos((prev) => [...prev, ...nuevas]);
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setComprimiendo(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorForm('');
    if (!form.calle1 || !form.calle2) return setErrorForm('Ingresá las dos calles de la intersección');
    if (form.trabajos.length === 0) return setErrorForm('Agregá al menos un trabajo');
    if (!form.lat || !form.lng) return setErrorForm('Tomá la ubicación GPS o ajustá el marcador en el mapa');

    setGuardando(true);
    try {
      const trabajoBase = esEdicion ? await obtenerTrabajoPorId(Number(id)) : {};
      const itemsCalculados = form.trabajos.map((t) => {
        const l = parseFloat(t.largo) || 0;
        const a = parseFloat(t.ancho) || 0;
        const c = parseFloat(t.cantidad) || 0;
        return {
          tipoTrabajo: t.tipoTrabajo, largo: l, ancho: a, cantidad: c,
          superficie: parseFloat((l * a * c).toFixed(2)),
          materiales: t.materiales,
        };
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
        materiales: form.trabajos.flatMap((t) => t.materiales),
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

  const superficieModal = (
    (parseFloat(modalForm.largo) || 0) *
    (parseFloat(modalForm.ancho) || 0) *
    (parseFloat(modalForm.cantidad) || 0)
  ).toFixed(2);

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
            {errorGPS && !gpsBloqueado && (
              <div className="alert alert-danger py-1 small mb-3">{errorGPS}</div>
            )}
            <div style={{ position: 'relative', height: 260, borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
              {!mapaListo ? (
                <div className="d-flex flex-column align-items-center justify-content-center h-100 bg-light">
                  <span className="spinner-border text-primary mb-2"></span>
                  <span className="small text-muted">Obteniendo ubicación GPS...</span>
                </div>
              ) : (
                <MapContainer
                  key={mapaKeyRef.current}
                  center={[parseFloat(form.lat) || -38, parseFloat(form.lng) || -63]}
                  zoom={form.lat ? 17 : 5}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={false}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                  <Marker
                    position={[parseFloat(form.lat) || -38, parseFloat(form.lng) || -63]}
                    draggable={true}
                    icon={iconoMarcador}
                    eventHandlers={{
                      dragend: (e) => {
                        const pos = e.target.getLatLng();
                        setForm((prev) => ({ ...prev, lat: pos.lat.toFixed(6), lng: pos.lng.toFixed(6) }));
                      },
                    }}
                  />
                  <MoverMapa lat={parseFloat(form.lat)} lng={parseFloat(form.lng)} />
                </MapContainer>
              )}
            </div>
            {gpsFallo && (
              <div className="d-flex align-items-center gap-2 mb-2 p-2 rounded bg-warning bg-opacity-10 border border-warning">
                <i className="bi bi-geo-alt-slash text-warning"></i>
                <span className="small flex-grow-1">GPS no disponible — navegá el mapa y arrastrá el marcador</span>
                <button type="button" className="btn btn-sm btn-warning py-0 px-2" onClick={handleGPS}>
                  <i className="bi bi-arrow-clockwise"></i>
                </button>
              </div>
            )}
            <div className="text-muted small text-center mb-3">
              <i className="bi bi-arrows-move me-1"></i>Arrastrá el marcador para ajustar la posición exacta
            </div>
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

        {/* TRABAJOS */}
        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="fw-semibold small">
              <i className="bi bi-tools me-1"></i> Trabajos
              {form.trabajos.length > 0 && (
                <span className="ms-2 badge bg-primary">{form.trabajos.length}</span>
              )}
            </span>
            <button type="button" className="btn btn-primary btn-sm" onClick={abrirModalNuevo}>
              <i className="bi bi-plus-lg me-1"></i>Crear trabajo
            </button>
          </div>

          {form.trabajos.length === 0 ? (
            <div className="card border-dashed text-center py-4 text-muted small">
              <i className="bi bi-clipboard-plus fs-3 mb-2 d-block"></i>
              Todavía no hay trabajos — tocá "Crear trabajo"
            </div>
          ) : (
            form.trabajos.map((t, idx) => {
              const sup = ((parseFloat(t.largo) || 0) * (parseFloat(t.ancho) || 0) * (parseFloat(t.cantidad) || 0)).toFixed(2);
              return (
                <div key={idx} className="card mb-2">
                  <div className="card-header bg-primary bg-opacity-10 d-flex justify-content-between align-items-center py-2">
                    <span className="fw-semibold small">
                      <i className="bi bi-tools me-1 text-primary"></i>{t.tipoTrabajo}
                    </span>
                    <span className="badge bg-primary">{sup} m²</span>
                  </div>
                  <div className="card-body py-2 small">
                    <div className="text-muted">
                      {t.largo}m × {t.ancho}m × {t.cantidad} unid.
                    </div>
                    {t.materiales.length > 0 && (
                      <div className="mt-1">
                        {t.materiales.map((m, i) => (
                          <span key={i} className="badge bg-secondary me-1 fw-normal">
                            {m.nombre} {m.cantidad} {m.unidad}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="card-footer d-flex gap-2 py-2 bg-transparent">
                    <button type="button" className="btn btn-sm flex-fill fw-semibold"
                      style={{ backgroundColor: '#ffc107', color: '#000', borderColor: '#ffc107' }}
                      onClick={() => abrirModalEditar(idx)}>
                      <i className="bi bi-pencil me-1"></i>Editar
                    </button>
                    <button type="button" className="btn btn-danger btn-sm flex-fill"
                      onClick={() => eliminarTrabajo(idx)}>
                      <i className="bi bi-trash me-1"></i>Eliminar
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {form.trabajos.length > 0 && (
            <div className="alert alert-info py-2 text-center mb-0">
              <strong className="fs-5">{superficieTotal} m²</strong>
              <div className="small text-muted">superficie total</div>
            </div>
          )}
        </div>

        {/* ESTADO OPERATIVO */}
        <div className="card mb-3">
          <div className="card-header bg-light fw-semibold small">
            <i className="bi bi-flag me-1"></i> Estado del trabajo
          </div>
          <div className="card-body">
            <div className="d-flex gap-2 flex-wrap">
              {ESTADOS_OPERATIVO.map((e) => (
                <div key={e}>
                  <input type="radio" className="btn-check" name="estadoOperativo"
                    id={`op-${e}`} value={e} checked={form.estadoOperativo === e} onChange={handleChange} />
                  <label className="btn btn-sm btn-outline-secondary" htmlFor={`op-${e}`}>{e}</label>
                </div>
              ))}
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
              onClick={() => fileRef.current.click()} disabled={comprimiendo}>
              {comprimiendo
                ? <><span className="spinner-border spinner-border-sm me-2"></span>Comprimiendo...</>
                : <><i className="bi bi-upload me-2"></i>Adjuntar fotos / videos</>}
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
                        <img src={f.data} alt={f.nombre} style={{ width: 70, height: 70, objectFit: 'cover' }} className="rounded border" />
                      ) : (
                        <div className="bg-light border rounded d-flex align-items-center justify-content-center" style={{ width: 70, height: 70 }}>
                          <i className="bi bi-camera-video text-secondary fs-4"></i>
                        </div>
                      )}
                      <button type="button" className="btn btn-danger btn-sm position-absolute top-0 end-0 p-0"
                        style={{ width: 18, height: 18, fontSize: 10, lineHeight: 1 }}
                        onClick={() => setFotosExistentes((prev) => prev.filter((_, j) => j !== i))}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {fotos.length > 0 && (
              <div>
                <div className="small text-muted mb-1">Nuevos ({fotos.length}) — comprimidos:</div>
                <div className="d-flex flex-wrap gap-2">
                  {fotos.map((f, i) => (
                    <div key={i} className="position-relative">
                      {f.tipo?.startsWith('image') ? (
                        <img src={f.data} alt={f.nombre} style={{ width: 70, height: 70, objectFit: 'cover' }} className="rounded border" />
                      ) : (
                        <div className="bg-light border rounded d-flex align-items-center justify-content-center" style={{ width: 70, height: 70 }}>
                          <i className="bi bi-camera-video text-secondary fs-4"></i>
                        </div>
                      )}
                      {f.pesoFinalKB && (
                        <div className="position-absolute bottom-0 start-0 end-0 text-center"
                          style={{ fontSize: 9, background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: '0 0 4px 4px' }}>
                          {f.pesoFinalKB < 1024 ? `${f.pesoFinalKB}KB` : `${(f.pesoFinalKB/1024).toFixed(1)}MB`}
                        </div>
                      )}
                      <button type="button" className="btn btn-danger btn-sm position-absolute top-0 end-0 p-0"
                        style={{ width: 18, height: 18, fontSize: 10, lineHeight: 1 }}
                        onClick={() => setFotos((prev) => prev.filter((_, j) => j !== i))}>×</button>
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
                value={form.linkDrive} onChange={handleChange} placeholder="https://drive.google.com/..." />
            </div>
            <div className="mb-2">
              <label className="form-label small fw-semibold">Link My Maps</label>
              <input type="url" className="form-control" name="linkMyMaps"
                value={form.linkMyMaps} onChange={handleChange} placeholder="https://mymaps.google.com/..." />
            </div>
            <div>
              <label className="form-label small fw-semibold">Observaciones</label>
              <textarea className="form-control" name="observaciones" rows={3}
                value={form.observaciones} onChange={handleChange} placeholder="Notas adicionales..." />
            </div>
          </div>
        </div>

        {errorForm && <div className="alert alert-danger">{errorForm}</div>}

        <div className="d-flex flex-column flex-sm-row gap-2">
          <button type="submit" className="btn btn-success btn-lg flex-sm-fill" disabled={guardando}>
            {guardando
              ? <><span className="spinner-border spinner-border-sm me-2"></span>Guardando...</>
              : <><i className="bi bi-check-circle me-2"></i>{esEdicion ? 'Guardar cambios' : 'Guardar'}</>}
          </button>
          <button type="button" className="btn btn-outline-secondary btn-lg" onClick={() => navigate(-1)}>
            Cancelar
          </button>
        </div>
      </form>

      {/* MODAL TRABAJO */}
      {modalAbierto && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h6 className="modal-title">
                  <i className="bi bi-tools me-2"></i>
                  {editIdx === null ? 'Nuevo trabajo' : 'Editar trabajo'}
                </h6>
                <button type="button" className="btn-close btn-close-white" onClick={() => setModalAbierto(false)} />
              </div>
              <div className="modal-body">
                {/* Tipo */}
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Tipo de trabajo *</label>
                  <select className="form-select" name="tipoTrabajo"
                    value={modalForm.tipoTrabajo} onChange={handleModalChange}>
                    <option value="">Seleccioná...</option>
                    {TIPOS_TRABAJO.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>

                {/* Medidas */}
                <div className="row g-2 mb-2">
                  <div className="col-4">
                    <label className="form-label small fw-semibold">Largo (m) *</label>
                    <input type="number" step="any" min="0" className="form-control"
                      name="largo" value={modalForm.largo} onChange={handleModalChange} placeholder="0" />
                  </div>
                  <div className="col-4">
                    <label className="form-label small fw-semibold">Ancho (m) *</label>
                    <input type="number" step="any" min="0" className="form-control"
                      name="ancho" value={modalForm.ancho} onChange={handleModalChange} placeholder="0" />
                  </div>
                  <div className="col-4">
                    <label className="form-label small fw-semibold">Cantidad *</label>
                    <input type="number" step="any" min="0" className="form-control"
                      name="cantidad" value={modalForm.cantidad} onChange={handleModalChange} placeholder="0" />
                  </div>
                </div>

                {parseFloat(superficieModal) > 0 && (
                  <div className="alert alert-info py-2 text-center mb-3">
                    <strong>{superficieModal} m²</strong>
                    <span className="text-muted small ms-1">superficie</span>
                  </div>
                )}

                {/* Materiales */}
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="small fw-semibold"><i className="bi bi-box-seam me-1"></i>Materiales</span>
                  <button type="button" className="btn btn-outline-primary btn-sm py-0 px-2"
                    onClick={agregarMaterialModal}>
                    <i className="bi bi-plus-lg me-1"></i>Agregar material
                  </button>
                </div>
                {modalForm.materiales.length === 0 ? (
                  <div className="text-muted small text-center py-2">Sin materiales</div>
                ) : (
                  modalForm.materiales.map((mat, idx) => (
                    <div key={idx} className="d-flex gap-2 align-items-center mb-2">
                      <select className="form-select form-select-sm flex-grow-1"
                        name="nombre" value={mat.nombre} onChange={(e) => handleMaterialModal(idx, e)}>
                        <option value="">Material...</option>
                        {NOMBRES_MATERIAL.map((n) => <option key={n}>{n}</option>)}
                      </select>
                      <input type="number" step="any" min="0" className="form-control form-control-sm"
                        style={{ width: 70 }} name="cantidad" value={mat.cantidad}
                        onChange={(e) => handleMaterialModal(idx, e)} placeholder="Cant." />
                      <select className="form-select form-select-sm" style={{ width: 85 }}
                        name="unidad" value={mat.unidad} onChange={(e) => handleMaterialModal(idx, e)}>
                        {UNIDADES_MATERIAL.map((u) => <option key={u}>{u}</option>)}
                      </select>
                      <button type="button" className="btn btn-sm btn-outline-danger py-0 px-2"
                        onClick={() => eliminarMaterialModal(idx)}>
                        <i className="bi bi-x-lg"></i>
                      </button>
                    </div>
                  ))
                )}

                {errorModal && <div className="alert alert-danger py-2 small mt-3">{errorModal}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setModalAbierto(false)}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-primary" onClick={guardarModal}>
                  <i className="bi bi-check-lg me-1"></i>
                  {editIdx === null ? 'Agregar trabajo' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
