import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { actualizarTrabajoBackend, obtenerMaterialesCatalogo, obtenerClientes } from '../services/api';
import { guardarTrabajo } from '../db/db';
import { ESTADOS_OPERATIVO, ESTADOS_ADMIN } from '../constants';

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

function numVal(v) {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function getSup(items, tipo) {
  return items?.find((i) => i.tipoTrabajo === tipo)?.superficie ?? 0;
}

const normStr = (s) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

function matchMat(catalogName, jobName) {
  const na = normStr(catalogName);
  const nb = normStr(jobName);
  if (na === nb) return true;
  const key = na.split(/\s+/).filter((w) => w.length >= 6).sort((x, y) => y.length - x.length)[0];
  return key ? nb.includes(key) : false;
}

function initCantidades(catalogo, materiales) {
  const result = {};
  const pool = [...(materiales || [])];
  // Pase 1: matches exactos (se reservan primero para no ser robados por matches aproximados)
  catalogo.forEach((cat) => {
    const idx = pool.findIndex((m) => normStr(m.nombre) === normStr(cat.nombre));
    if (idx !== -1) {
      result[cat._id] = String(pool[idx].cantidad);
      pool.splice(idx, 1);
    }
  });
  // Pase 2: matches aproximados sobre lo que quedó sin asignar
  catalogo.forEach((cat) => {
    if (result[cat._id] !== undefined) return;
    const idx = pool.findIndex((m) => matchMat(cat.nombre, m.nombre));
    result[cat._id] = idx !== -1 ? String(pool.splice(idx, 1)[0].cantidad) : '';
  });
  return result;
}

const DEFAULT_LAT = -26.8241;
const DEFAULT_LNG = -65.2226;

export default function EditarTrabajoModal({ trabajo, onClose, onGuardado }) {
  const lat0 = trabajo.lat || DEFAULT_LAT;
  const lng0 = trabajo.lng || DEFAULT_LNG;

  const [form, setForm] = useState({
    fechaCarga:      trabajo.fechaCarga ? new Date(trabajo.fechaCarga).toISOString().split('T')[0] : '',
    clienteId:       trabajo.clienteId     || '',
    clienteNombre:   trabajo.clienteNombre || '',
    calle1:          trabajo.calle1 || '',
    calle2:          trabajo.calle2 || '',
    lat:             lat0,
    lng:             lng0,
    sendas:          getSup(trabajo.items, 'SENDAS'),
    rampas:          getSup(trabajo.items, 'RAMPAS'),
    cordones:        getSup(trabajo.items, 'CORDONES'),
    estadoOperativo: trabajo.estadoOperativo || 'Sin iniciar',
    estadoAdmin:     trabajo.estadoAdmin     || 'Sin certificar',
    observaciones:   trabajo.observaciones   || '',
  });

  const [catalogo, setCatalogo]         = useState([]);
  const [cantidades, setCantidades]     = useState({});
  const [clientes, setClientes]         = useState([]);
  const [cargandoCat, setCargandoCat]   = useState(true);
  const [cargandoClientes, setCargandoClientes] = useState(true);
  const [guardando, setGuardando]       = useState(false);
  const [error, setError]               = useState('');
  const mapaKey = useRef(`${lat0},${lng0}`);

  useEffect(() => {
    obtenerMaterialesCatalogo()
      .then(({ materiales: cats }) => {
        const lista = cats || [];
        setCatalogo(lista);
        setCantidades(initCantidades(lista, trabajo.materiales));
      })
      .catch(() => {})
      .finally(() => setCargandoCat(false));

    obtenerClientes()
      .then(({ clientes: c }) => setClientes(c || []))
      .catch(() => {})
      .finally(() => setCargandoClientes(false));
  }, []);

  function set(field, val) {
    setForm((prev) => ({ ...prev, [field]: val }));
  }

  function handleClienteChange(e) {
    const clienteId = e.target.value;
    const cliente = clientes.find((c) => c._id === clienteId);
    setForm((prev) => ({ ...prev, clienteId, clienteNombre: cliente?.nombre || '' }));
  }

  function handleLatLngInput(field, val) {
    const n = parseFloat(val.replace(',', '.'));
    set(field, isNaN(n) ? val : n);
  }

  async function handleGuardar() {
    if (!form.calle1.trim()) return setError('Ingresá la calle 1');
    setGuardando(true);
    setError('');
    try {
      const items = [];
      if (numVal(form.sendas)   > 0) items.push({ tipoTrabajo: 'SENDAS',   superficie: numVal(form.sendas) });
      if (numVal(form.rampas)   > 0) items.push({ tipoTrabajo: 'RAMPAS',   superficie: numVal(form.rampas) });
      if (numVal(form.cordones) > 0) items.push({ tipoTrabajo: 'CORDONES', superficie: numVal(form.cordones) });

      const materiales = catalogo
        .filter((cat) => numVal(cantidades[cat._id]) > 0)
        .map((cat) => ({
          nombre:   cat.nombre,
          cantidad: numVal(cantidades[cat._id]),
          unidad:   cat.unidad,
        }));

      const datos = {
        fechaCarga:        form.fechaCarga ? new Date(form.fechaCarga) : trabajo.fechaCarga,
        clienteId:         form.clienteId,
        clienteNombre:     form.clienteNombre,
        calle1:            form.calle1.trim(),
        calle2:            form.calle2.trim(),
        lat:               numVal(form.lat),
        lng:               numVal(form.lng),
        items,
        materiales,
        superficie:        numVal(form.sendas) + numVal(form.rampas) + numVal(form.cordones),
        estadoOperativo:   form.estadoOperativo,
        estadoAdmin:       form.estadoAdmin,
        observaciones:     form.observaciones,
        fechaModificacion: new Date(),
      };

      await actualizarTrabajoBackend(trabajo._id, datos);
      await guardarTrabajo({ ...trabajo, ...datos, id: trabajo.id || trabajo._id });
      await onGuardado();
      onClose();
    } catch (e) {
      setError(e.message || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  const latNum = parseFloat(form.lat) || DEFAULT_LAT;
  const lngNum = parseFloat(form.lng) || DEFAULT_LNG;

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}
      onClick={(e) => { if (e.target === e.currentTarget && !guardando) onClose(); }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-centered">
        <div className="modal-content">

          <div className="modal-header">
            <h5 className="modal-title">
              <i className="bi bi-pencil-square me-2 text-primary"></i>Editar trabajo
            </h5>
            {!guardando && <button className="btn-close" onClick={onClose} />}
          </div>

          <div className="modal-body">

            {/* Cliente */}
            <div className="mb-3">
              <label className="form-label small fw-semibold">
                <i className="bi bi-person-vcard me-1"></i>Cliente
              </label>
              {cargandoClientes ? (
                <div className="d-flex align-items-center gap-2 text-muted small">
                  <span className="spinner-border spinner-border-sm"></span>Cargando clientes...
                </div>
              ) : (
                <select className="form-select form-select-sm"
                  value={form.clienteId} onChange={handleClienteChange}>
                  <option value="">Sin cliente asignado</option>
                  {clientes.map((c) => (
                    <option key={c._id} value={c._id}>{c.nombre}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Fecha + Intersección */}
            <div className="row g-2 mb-3">
              <div className="col-12 col-md-3">
                <label className="form-label small fw-semibold">Fecha</label>
                <input type="date" className="form-control form-control-sm"
                  value={form.fechaCarga} onChange={(e) => set('fechaCarga', e.target.value)} />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small fw-semibold">Calle 1 *</label>
                <input type="text" className="form-control form-control-sm"
                  value={form.calle1} onChange={(e) => set('calle1', e.target.value)} />
              </div>
              <div className="col-12 col-md-5">
                <label className="form-label small fw-semibold">Calle 2</label>
                <input type="text" className="form-control form-control-sm"
                  value={form.calle2} onChange={(e) => set('calle2', e.target.value)} />
              </div>
            </div>

            {/* Mapa */}
            <p className="fw-semibold small text-muted mb-1">
              <i className="bi bi-geo-alt me-1"></i>Ubicación — arrastrá el marcador para corregir
            </p>
            <div style={{ height: 280, borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
              <MapContainer
                key={mapaKey.current}
                center={[latNum, lngNum]}
                zoom={17}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap'
                />
                <Marker
                  position={[latNum, lngNum]}
                  draggable={true}
                  icon={iconoMarcador}
                  eventHandlers={{
                    dragend: (e) => {
                      const pos = e.target.getLatLng();
                      set('lat', parseFloat(pos.lat.toFixed(7)));
                      set('lng', parseFloat(pos.lng.toFixed(7)));
                    },
                  }}
                />
                <MoverMapa lat={latNum} lng={lngNum} />
              </MapContainer>
            </div>

            {/* Inputs lat/lng manuales */}
            <div className="row g-2 mb-3">
              <div className="col-6">
                <label className="form-label small fw-semibold">Latitud</label>
                <input type="text" className="form-control form-control-sm font-monospace"
                  value={form.lat} onChange={(e) => handleLatLngInput('lat', e.target.value)}
                  placeholder="-26.8286" />
              </div>
              <div className="col-6">
                <label className="form-label small fw-semibold">Longitud</label>
                <input type="text" className="form-control form-control-sm font-monospace"
                  value={form.lng} onChange={(e) => handleLatLngInput('lng', e.target.value)}
                  placeholder="-65.2026" />
              </div>
            </div>

            {/* Superficies */}
            <p className="fw-semibold small text-muted mb-1">Superficies (m²)</p>
            <div className="row g-2 mb-3">
              {[['sendas','Sendas'],['rampas','Rampas'],['cordones','Cordones']].map(([k, label]) => (
                <div key={k} className="col-4">
                  <label className="form-label small fw-semibold">{label}</label>
                  <input type="number" step="0.01" min="0" className="form-control form-control-sm"
                    value={form[k]} onChange={(e) => set(k, e.target.value)} />
                </div>
              ))}
            </div>

            {/* Materiales — dinámico desde el catálogo */}
            <p className="fw-semibold small text-muted mb-1">
              <i className="bi bi-box-seam me-1"></i>Materiales
            </p>
            {cargandoCat ? (
              <div className="d-flex align-items-center gap-2 text-muted small mb-3">
                <span className="spinner-border spinner-border-sm"></span>Cargando materiales...
              </div>
            ) : catalogo.length === 0 ? (
              <p className="text-muted small mb-3">No hay materiales en el catálogo.</p>
            ) : (
              <div className="row g-2 mb-3">
                {catalogo.map((cat) => (
                  <div key={cat._id} className="col-6 col-md-4 col-lg-3">
                    <label className="form-label small fw-semibold" title={cat.nombre}>
                      {cat.nombre}
                      <span className="text-muted fw-normal ms-1">({cat.unidad})</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      className="form-control form-control-sm"
                      value={cantidades[cat._id] ?? ''}
                      placeholder="0"
                      onChange={(e) =>
                        setCantidades((prev) => ({ ...prev, [cat._id]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Estados */}
            <div className="row g-2 mb-3">
              <div className="col-12 col-md-6">
                <label className="form-label small fw-semibold">Estado operativo</label>
                <select className="form-select form-select-sm"
                  value={form.estadoOperativo} onChange={(e) => set('estadoOperativo', e.target.value)}>
                  {ESTADOS_OPERATIVO.map((e) => <option key={e}>{e}</option>)}
                </select>
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label small fw-semibold">Estado admin</label>
                <select className="form-select form-select-sm"
                  value={form.estadoAdmin} onChange={(e) => set('estadoAdmin', e.target.value)}>
                  {ESTADOS_ADMIN.map((e) => <option key={e}>{e}</option>)}
                </select>
              </div>
            </div>

            {/* Observaciones */}
            <div className="mb-2">
              <label className="form-label small fw-semibold">Observaciones</label>
              <textarea className="form-control form-control-sm" rows={2}
                value={form.observaciones} onChange={(e) => set('observaciones', e.target.value)} />
            </div>

            {error && <div className="alert alert-danger py-2 small mt-2">{error}</div>}
          </div>

          <div className="modal-footer">
            <button className="btn btn-outline-secondary" onClick={onClose} disabled={guardando}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleGuardar} disabled={guardando}>
              {guardando
                ? <><span className="spinner-border spinner-border-sm me-2"></span>Guardando...</>
                : <><i className="bi bi-check-lg me-2"></i>Guardar cambios</>}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
