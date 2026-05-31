import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { actualizarTrabajoBackend } from '../services/api';
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

function getMat(materiales, nombre) {
  const n = nombre.toLowerCase();
  return materiales?.find((m) => m.nombre?.toLowerCase().includes(n))?.cantidad ?? 0;
}

function getSup(items, tipo) {
  return items?.find((i) => i.tipoTrabajo === tipo)?.superficie ?? 0;
}

const DEFAULT_LAT = -26.8241;
const DEFAULT_LNG = -65.2226;

export default function EditarTrabajoModal({ trabajo, onClose, onGuardado }) {
  const lat0 = trabajo.lat || DEFAULT_LAT;
  const lng0 = trabajo.lng || DEFAULT_LNG;

  const [form, setForm] = useState({
    fechaCarga: trabajo.fechaCarga
      ? new Date(trabajo.fechaCarga).toISOString().split('T')[0]
      : '',
    calle1:        trabajo.calle1 || '',
    calle2:        trabajo.calle2 || '',
    lat:           lat0,
    lng:           lng0,
    sendas:        getSup(trabajo.items, 'SENDAS'),
    rampas:        getSup(trabajo.items, 'RAMPAS'),
    cordones:      getSup(trabajo.items, 'CORDONES'),
    bolsasTermo:   getMat(trabajo.materiales, 'termoplást'),
    bolsasMicro:   getMat(trabajo.materiales, 'microesfera'),
    litrosImprim:  getMat(trabajo.materiales, 'imprimac'),
    litrosPintura: getMat(trabajo.materiales, 'acrílica'),
    estadoOperativo: trabajo.estadoOperativo || 'Sin iniciar',
    estadoAdmin:     trabajo.estadoAdmin     || 'Sin certificar',
    observaciones:   trabajo.observaciones   || '',
  });

  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState('');
  const mapaKey = useRef(`${lat0},${lng0}`);

  function set(field, val) {
    setForm((prev) => ({ ...prev, [field]: val }));
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

      const materiales = [];
      if (numVal(form.bolsasTermo)   > 0) materiales.push({ nombre: 'Bolsas termoplástica', cantidad: numVal(form.bolsasTermo),   unidad: 'u' });
      if (numVal(form.bolsasMicro)   > 0) materiales.push({ nombre: 'Bolsas microesferas',  cantidad: numVal(form.bolsasMicro),   unidad: 'u' });
      if (numVal(form.litrosImprim)  > 0) materiales.push({ nombre: 'Imprimación',           cantidad: numVal(form.litrosImprim),  unidad: 'l' });
      if (numVal(form.litrosPintura) > 0) materiales.push({ nombre: 'Pintura acrílica',      cantidad: numVal(form.litrosPintura), unidad: 'l' });

      const datos = {
        fechaCarga:        form.fechaCarga ? new Date(form.fechaCarga) : trabajo.fechaCarga,
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
      onGuardado();
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
                <input
                  type="text"
                  className="form-control form-control-sm font-monospace"
                  value={form.lat}
                  onChange={(e) => handleLatLngInput('lat', e.target.value)}
                  placeholder="-26.8286"
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-semibold">Longitud</label>
                <input
                  type="text"
                  className="form-control form-control-sm font-monospace"
                  value={form.lng}
                  onChange={(e) => handleLatLngInput('lng', e.target.value)}
                  placeholder="-65.2026"
                />
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

            {/* Materiales */}
            <p className="fw-semibold small text-muted mb-1">Materiales</p>
            <div className="row g-2 mb-3">
              {[
                ['bolsasTermo',  'Bolsas termo (u)'],
                ['bolsasMicro',  'Bolsas microesf. (u)'],
                ['litrosImprim', 'Imprimación (l)'],
                ['litrosPintura','Pintura acrílica (l)'],
              ].map(([k, label]) => (
                <div key={k} className="col-6 col-md-3">
                  <label className="form-label small fw-semibold">{label}</label>
                  <input type="number" step="0.1" min="0" className="form-control form-control-sm"
                    value={form[k]} onChange={(e) => set(k, e.target.value)} />
                </div>
              ))}
            </div>

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
