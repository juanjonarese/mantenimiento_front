import { useState, useRef, useEffect } from 'react';
import Swal from 'sweetalert2';
import { useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { guardarTrabajo, obtenerTrabajoPorId, marcarTodosSincronizados } from '../db/db';
import { obtenerClientes, subirFoto, sincronizarTrabajos, obtenerTiposTarea } from '../services/api';
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
const TRABAJO_VACIO = { tipoTrabajo: '', largo: '', ancho: '', cantidad: '', fotos: [] };

const DEFAULT_LAT = -26.8241;
const DEFAULT_LNG = -65.2226;

const FORM_VACIO = {
  clienteId: '', clienteNombre: '',
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
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [cargandoClientes, setCargandoClientes] = useState(true);
  const [tiposTarea, setTiposTarea] = useState(TIPOS_TRABAJO);
  const [geocodificando, setGeocodificando] = useState(false);
  const geocodeTimer = useRef(null);

  // Modal
  const [busqueda, setBusqueda] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState('');

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [modalForm, setModalForm] = useState({ ...TRABAJO_VACIO });
  const [errorModal, setErrorModal] = useState('');

  const mapaKeyRef = useRef('default');
  const fileRef = useRef();
  const modalFileRef = useRef();
  const esEdicion = Boolean(id);
  const esAdmin = true;

  useEffect(() => {
    obtenerClientes()
      .then(({ clientes: c }) => setClientes(c || []))
      .catch(() => {})
      .finally(() => setCargandoClientes(false));
    obtenerTiposTarea()
      .then(({ tipos: t }) => {
        const nombres = (t || []).filter((tt) => tt.activo).map((tt) => tt.nombre);
        if (nombres.length > 0) setTiposTarea(nombres);
      })
      .catch(() => { /* fallback: mantiene TIPOS_TRABAJO del estado inicial */ });
  }, []);

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
          fotos: item.fotos || [],
        }));
        setForm({
          clienteId: t.clienteId || '', clienteNombre: t.clienteNombre || '',
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
          reverseGeocode(lat, lng);
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

  function handleClienteChange(e) {
    const clienteId = e.target.value;
    const cliente = clientes.find((c) => c._id === clienteId);
    setForm((prev) => ({ ...prev, clienteId, clienteNombre: cliente?.nombre || '' }));
  }

  async function reverseGeocode(lat, lng) {
    setGeocodificando(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`,
        { headers: { 'Accept-Language': 'es' } }
      );
      const data = await res.json();
      const addr = data.address || {};
      const calle = [addr.road, addr.house_number].filter(Boolean).join(' ') || addr.suburb || addr.neighbourhood || '';
      if (calle) setForm((prev) => ({ ...prev, calle1: calle }));
    } catch { /* si falla, el usuario completa manualmente */ }
    finally { setGeocodificando(false); }
  }

  async function handleGPS() {
    const pos = await obtenerUbicacion();
    if (pos) {
      setGpsFallo(false);
      setForm((prev) => ({ ...prev, lat: pos.lat.toFixed(6), lng: pos.lng.toFixed(6) }));
      reverseGeocode(pos.lat.toFixed(6), pos.lng.toFixed(6));
    }
  }

  async function handleBuscar() {
    if (!busqueda.trim()) return;
    setBuscando(true);
    setErrorBusqueda('');
    setResultadosBusqueda([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(busqueda)}&format=json&limit=5&countrycodes=ar`
      );
      const data = await res.json();
      if (data.length === 0) return setErrorBusqueda('No se encontró la dirección');
      setResultadosBusqueda(data);
    } catch {
      setErrorBusqueda('Error al buscar la dirección');
    } finally {
      setBuscando(false);
    }
  }

  function seleccionarResultado(r) {
    const lat = parseFloat(r.lat).toFixed(6);
    const lng = parseFloat(r.lon).toFixed(6);
    setForm((prev) => ({ ...prev, lat, lng }));
    setResultadosBusqueda([]);
    setBusqueda('');
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

  // Comprime y sube a Cloudinary si hay conexión
  async function procesarArchivo(archivo) {
    const comprimido = await comprimirMedia(archivo);
    if (navigator.onLine) {
      try {
        const { url } = await subirFoto(
          comprimido.data, comprimido.nombre, comprimido.tipo,
          form.calle1 || '', form.calle2 || ''
        );
        return { ...comprimido, driveUrl: url, subido: true };
      } catch (err) {
        return { ...comprimido, subido: false, errorSubida: err.message };
      }
    }
    return { ...comprimido, subido: false };
  }

  async function handleFotosModal(e) {
    const archivos = Array.from(e.target.files);
    if (!archivos.length) return;
    setComprimiendo(true);
    setErrorModal('');
    try {
      const nuevas = await Promise.all(archivos.map(procesarArchivo));
      setModalForm((prev) => ({ ...prev, fotos: [...(prev.fotos || []), ...nuevas] }));
    } catch (err) {
      setErrorModal(err.message);
    } finally {
      setComprimiendo(false);
      e.target.value = '';
    }
  }

  function eliminarFotoModal(idx) {
    setModalForm((prev) => ({ ...prev, fotos: prev.fotos.filter((_, i) => i !== idx) }));
  }

  function guardarModal() {
    if (!modalForm.tipoTrabajo) return setErrorModal('Seleccioná el tipo de trabajo');
    if (!modalForm.largo || !modalForm.ancho || !modalForm.cantidad) return setErrorModal('Completá las medidas');
    setErrorModal('');
    setForm((prev) => {
      const trabajos = [...prev.trabajos];
      if (editIdx === null) trabajos.push({ ...modalForm });
      else trabajos[editIdx] = { ...modalForm };
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
      const nuevas = await Promise.all(archivos.map(procesarArchivo));
      setFotos((prev) => [...prev, ...nuevas]);
      const subidas = nuevas.filter(f => f.subido);
      const fallidas = nuevas.filter(f => f.errorSubida);
      if (subidas.length) {
        await Swal.fire({
          icon: 'success',
          title: `${subidas.length} foto(s) subidas`,
          html: `<small>${subidas[0].driveUrl}</small>`,
          timer: 4000,
          showConfirmButton: false,
        });
      }
      if (fallidas.length) {
        await Swal.fire({
          icon: 'error',
          title: 'Error al subir fotos',
          text: fallidas[0].errorSubida || 'Error desconocido',
        });
        setErrorForm(`⚠ ${fallidas.length} foto(s) no se pudieron subir: ${fallidas[0].errorSubida}`);
      }
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setComprimiendo(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorForm('');
    if (!form.clienteId) return setErrorForm('Seleccioná el cliente');
    if (!form.calle1) return setErrorForm('Ingresá al menos la dirección principal');
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
          fotos: t.fotos || [],
        };
      });

      const trabajo = {
        id: esEdicion ? Number(id) : Date.now(),
        fechaCarga: esEdicion ? trabajoBase.fechaCarga : new Date().toISOString(),
        fechaModificacion: esEdicion ? new Date().toISOString() : undefined,
        usuario: localStorage.getItem('email') || '',
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        clienteId: form.clienteId,
        clienteNombre: form.clienteNombre,
        calle1: form.calle1.trim(),
        calle2: form.calle2.trim(),
        items: itemsCalculados,
        superficie: parseFloat(superficieTotal),
        estadoOperativo: form.estadoOperativo,
        estadoAdmin: form.estadoAdmin,
        observaciones: form.observaciones,
        linkDrive: form.linkDrive,
        linkMyMaps: form.linkMyMaps,
        fotos: [...fotosExistentes, ...fotos],
        turnoId: localStorage.getItem('turnoId') || null,
        sincronizado: false,
      };
      await guardarTrabajo(trabajo);

      // Sincronizar inmediatamente si hay conexión (no esperar al ciclo de useSync)
      if (navigator.onLine) {
        try {
          const email = localStorage.getItem('email') || '';
          await sincronizarTrabajos([{
            idLocal:           trabajo.id,
            fechaCarga:        trabajo.fechaCarga,
            fechaModificacion: trabajo.fechaModificacion,
            usuario:           trabajo.usuario || email,
            lat:               trabajo.lat,
            lng:               trabajo.lng,
            clienteId:         trabajo.clienteId,
            clienteNombre:     trabajo.clienteNombre,
            calle1:            trabajo.calle1,
            calle2:            trabajo.calle2,
            turno:             trabajo.turnoId || null,
            items:             trabajo.items,
            materiales:        trabajo.materiales || [],
            superficie:        trabajo.superficie,
            estadoOperativo:   trabajo.estadoOperativo,
            estadoAdmin:       trabajo.estadoAdmin,
            observaciones:     trabajo.observaciones,
            linkDrive:         trabajo.linkDrive,
            linkMyMaps:        trabajo.linkMyMaps,
            fotos:             (trabajo.fotos || []).map(({ nombre, tipo, driveUrl, subido }) => ({
              nombre, tipo, driveUrl: driveUrl || null, subido: subido || false,
            })),
            cantFotos:         (trabajo.fotos || []).length,
          }]);
          await marcarTodosSincronizados([trabajo.id]);
        } catch {
          // Sin conexión o error → quedará pendiente para el próximo intento de useSync
        }
      }

      const rol = localStorage.getItem('rol');
      if (rol === 'supervisor') {
        setGuardadoOk(true);
      } else {
        navigate('/lista');
      }
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

  function hacerOtroTrabajo() {
    setGuardadoOk(false);
    setForm(FORM_VACIO);
    setFotos([]);
    setFotosExistentes([]);
    setErrorForm('');
    setMapaListo(false);
    mapaKeyRef.current = 'default';
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

  if (guardadoOk) {
    return (
      <div className="p-3 pb-5 d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '70vh' }}>
        <div className="text-center mb-4">
          <i className="bi bi-check-circle-fill text-success" style={{ fontSize: 56 }}></i>
          <h5 className="fw-bold mt-3 mb-1">¡Trabajo guardado!</h5>
          <p className="text-muted small">¿Qué querés hacer ahora?</p>
        </div>
        <div className="row g-3 w-100" style={{ maxWidth: 480 }}>
          <div className="col-12 col-sm-6">
            <button
              className="card border-2 border-primary text-center w-100 h-100 p-4 btn btn-outline-primary"
              style={{ borderRadius: 16 }}
              onClick={hacerOtroTrabajo}
            >
              <i className="bi bi-plus-circle-fill text-primary mb-3" style={{ fontSize: 40 }}></i>
              <div className="fw-bold fs-6">Hacer otro trabajo</div>
              <div className="text-muted small mt-1">Cargá un nuevo trabajo en el turno</div>
            </button>
          </div>
          <div className="col-12 col-sm-6">
            <button
              className="card border-2 border-warning text-center w-100 h-100 p-4 btn btn-outline-warning"
              style={{ borderRadius: 16 }}
              onClick={() => navigate('/cerrar-turno')}
            >
              <i className="bi bi-door-closed-fill text-warning mb-3" style={{ fontSize: 40 }}></i>
              <div className="fw-bold fs-6">Cerrar turno</div>
              <div className="text-muted small mt-1">Registrá materiales y cerrá el turno</div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 pb-5">
      <h5 className="fw-bold mb-3">
        <i className="bi bi-geo-alt me-2 text-primary"></i>
        {esEdicion ? 'Editar trabajo' : 'Nuevo trabajo'}
      </h5>

      <form onSubmit={handleSubmit}>
        {/* CLIENTE */}
        <div className="card mb-3">
          <div className="card-header bg-light fw-semibold small">
            <i className="bi bi-person-vcard me-1"></i> Cliente *
          </div>
          <div className="card-body">
            {cargandoClientes ? (
              <div className="d-flex align-items-center gap-2 text-muted small">
                <span className="spinner-border spinner-border-sm"></span>
                Cargando clientes...
              </div>
            ) : clientes.length === 0 ? (
              <div className="text-muted small">
                <i className="bi bi-exclamation-circle me-1 text-warning"></i>
                No hay clientes cargados. Pedile al administrador que agregue clientes.
              </div>
            ) : (
              <select
                className="form-select"
                value={form.clienteId}
                onChange={handleClienteChange}
              >
                <option value="">Seleccioná el cliente...</option>
                {clientes.map((c) => (
                  <option key={c._id} value={c._id}>{c.nombre}</option>
                ))}
              </select>
            )}
          </div>
        </div>

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

            {/* Buscador de dirección */}
            <div className="mb-2">
              <div className="input-group">
                <input
                  type="text"
                  className="form-control"
                  value={busqueda}
                  onChange={(e) => { setBusqueda(e.target.value); setResultadosBusqueda([]); setErrorBusqueda(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleBuscar(); } }}
                  placeholder="Buscar dirección o calle..."
                />
                <button type="button" className="btn btn-outline-primary" onClick={handleBuscar} disabled={buscando}>
                  {buscando
                    ? <span className="spinner-border spinner-border-sm"></span>
                    : <i className="bi bi-search"></i>}
                </button>
              </div>
              {errorBusqueda && <div className="text-danger small mt-1">{errorBusqueda}</div>}
              {resultadosBusqueda.length > 0 && (
                <div className="list-group mt-1 shadow-sm" style={{ zIndex: 1000, position: 'relative' }}>
                  {resultadosBusqueda.map((r) => (
                    <button
                      key={r.place_id}
                      type="button"
                      className="list-group-item list-group-item-action small py-2 text-start"
                      onClick={() => seleccionarResultado(r)}
                    >
                      <i className="bi bi-geo-alt me-2 text-primary"></i>
                      {r.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ position: 'relative', height: 260, borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
              {!mapaListo ? (
                <div className="d-flex flex-column align-items-center justify-content-center h-100 bg-light">
                  <span className="spinner-border text-primary mb-2"></span>
                  <span className="small text-muted">Obteniendo ubicación GPS...</span>
                </div>
              ) : (
                <MapContainer
                  key={mapaKeyRef.current}
                  center={[parseFloat(form.lat) || DEFAULT_LAT, parseFloat(form.lng) || DEFAULT_LNG]}
                  zoom={form.lat ? 17 : 13}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={false}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                  <Marker
                    position={[parseFloat(form.lat) || DEFAULT_LAT, parseFloat(form.lng) || DEFAULT_LNG]}
                    draggable={true}
                    icon={iconoMarcador}
                    eventHandlers={{
                      dragend: (e) => {
                        const pos = e.target.getLatLng();
                        const lat = pos.lat.toFixed(6);
                        const lng = pos.lng.toFixed(6);
                        setForm((prev) => ({ ...prev, lat, lng }));
                        clearTimeout(geocodeTimer.current);
                        geocodeTimer.current = setTimeout(() => reverseGeocode(lat, lng), 800);
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
                <label className="form-label small fw-semibold">
                  Dirección *
                  {geocodificando && <span className="spinner-border spinner-border-sm ms-2 text-muted"></span>}
                </label>
                <input type="text" className="form-control" name="calle1"
                  value={form.calle1} onChange={handleChange} placeholder="Av. Rivadavia 1234" />
              </div>
              <div className="col-6">
                <label className="form-label small fw-semibold text-muted">Calle transversal</label>
                <input type="text" className="form-control" name="calle2"
                  value={form.calle2} onChange={handleChange} placeholder="Opcional" />
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
                    {(t.fotos || []).length > 0 && (
                      <div className="mt-1 text-muted">
                        <i className="bi bi-camera me-1"></i>{t.fotos.length} foto{t.fotos.length !== 1 ? 's' : ''}
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
                <div className="small text-muted mb-1">Nuevos ({fotos.length}):</div>
                <div className="d-flex flex-wrap gap-2">
                  {fotos.map((f, i) => (
                    <div key={i} className="position-relative">
                      {f.tipo?.startsWith('image') ? (
                        <img src={f.driveUrl || f.data} alt={f.nombre} style={{ width: 70, height: 70, objectFit: 'cover' }} className="rounded border" />
                      ) : (
                        <div className="bg-light border rounded d-flex align-items-center justify-content-center" style={{ width: 70, height: 70 }}>
                          <i className="bi bi-camera-video text-secondary fs-4"></i>
                        </div>
                      )}
                      <div className="position-absolute top-0 start-0 m-1" title={f.errorSubida || ''}>
                        {f.subido
                          ? <i className="bi bi-cloud-check-fill text-success" style={{ fontSize: 12 }}></i>
                          : <i className="bi bi-cloud-slash text-danger" style={{ fontSize: 12 }}></i>
                        }
                      </div>
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
            <i className="bi bi-chat-left-text me-1"></i> Observaciones
          </div>
          <div className="card-body">
            {/* <div className="mb-2">
              <label className="form-label small fw-semibold">Link Google Drive</label>
              <input type="url" className="form-control" name="linkDrive"
                value={form.linkDrive} onChange={handleChange} placeholder="https://drive.google.com/..." />
            </div>
            <div className="mb-2">
              <label className="form-label small fw-semibold">Link My Maps</label>
              <input type="url" className="form-control" name="linkMyMaps"
                value={form.linkMyMaps} onChange={handleChange} placeholder="https://mymaps.google.com/..." />
            </div> */}
            <div>
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
                    {tiposTarea.map((t) => <option key={t}>{t}</option>)}
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

                {/* Fotos y videos de la tarea */}
                <div className="border-top pt-3 mt-1">
                  <div className="small fw-semibold mb-2">
                    <i className="bi bi-camera me-1"></i>Fotos / videos de esta tarea
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-secondary w-100 mb-2"
                    onClick={() => modalFileRef.current.click()}
                    disabled={comprimiendo}
                  >
                    {comprimiendo
                      ? <><span className="spinner-border spinner-border-sm me-2"></span>Comprimiendo...</>
                      : <><i className="bi bi-camera me-1"></i>Adjuntar foto o video</>}
                  </button>
                  <input
                    ref={modalFileRef}
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    capture="environment"
                    className="d-none"
                    onChange={handleFotosModal}
                  />
                  {(modalForm.fotos || []).length > 0 && (
                    <div className="d-flex flex-wrap gap-2 mt-2">
                      {(modalForm.fotos || []).map((f, i) => (
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
                          <button
                            type="button"
                            className="btn btn-danger btn-sm position-absolute top-0 end-0 p-0"
                            style={{ width: 18, height: 18, fontSize: 10, lineHeight: 1 }}
                            onClick={() => eliminarFotoModal(i)}
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

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
