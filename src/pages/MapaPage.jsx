import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { obtenerTrabajosBackend } from '../services/api';
import { obtenerTrabajos } from '../db/db';
import { COLORES_ESTADO_OP, COLORES_ESTADO_ADMIN } from '../constants';

// ─── Colores de pins ────────────────────────────────────────────────────────
const COLOR_PIN = {
  certificado:  '#0d6efd', // azul
  revision:     '#fd7e14', // naranja
  terminado:    '#198754', // verde
  en_proceso:   '#ffc107', // amarillo
  sin_iniciar:  '#dc3545', // rojo
};

function getPinColor(t) {
  if (t.estadoAdmin === 'Certificado')  return COLOR_PIN.certificado;
  if (t.estadoAdmin === 'En revisión')  return COLOR_PIN.revision;
  const op = t.estadoOperativo;
  if (op === 'Terminado' || op === 'Finalizado') return COLOR_PIN.terminado;
  if (op === 'En proceso')  return COLOR_PIN.en_proceso;
  return COLOR_PIN.sin_iniciar;
}

const LEYENDA = [
  { label: 'Sin iniciar',  color: COLOR_PIN.sin_iniciar  },
  { label: 'En proceso',   color: COLOR_PIN.en_proceso   },
  { label: 'Terminado',    color: COLOR_PIN.terminado    },
  { label: 'En revisión',  color: COLOR_PIN.revision     },
  { label: 'Certificado',  color: COLOR_PIN.certificado  },
];

const FILTROS_MAPA = [
  { key: 'todos',       label: 'Todos',       color: '#6c757d' },
  { key: 'sin_iniciar', label: 'Sin iniciar', color: COLOR_PIN.sin_iniciar },
  { key: 'en_proceso',  label: 'En proceso',  color: COLOR_PIN.en_proceso  },
  { key: 'terminado',   label: 'Terminado',   color: COLOR_PIN.terminado   },
  { key: 'revision',    label: 'En revisión', color: COLOR_PIN.revision    },
  { key: 'certificado', label: 'Certificado', color: COLOR_PIN.certificado },
];

function matchFiltro(t, filtro) {
  if (filtro === 'todos')       return true;
  if (filtro === 'certificado') return t.estadoAdmin === 'Certificado';
  if (filtro === 'revision')    return t.estadoAdmin === 'En revisión';
  if (filtro === 'terminado')   return ['Terminado','Finalizado'].includes(t.estadoOperativo) && !['Certificado','En revisión'].includes(t.estadoAdmin);
  if (filtro === 'en_proceso')  return t.estadoOperativo === 'En proceso';
  if (filtro === 'sin_iniciar') return t.estadoOperativo === 'Sin iniciar';
  return true;
}

// ─── FitBounds ───────────────────────────────────────────────────────────────
function FitBounds({ trabajos }) {
  const map = useMap();
  useEffect(() => {
    const pts = trabajos.filter((t) => t.lat && t.lng);
    if (pts.length === 0) return;
    if (pts.length === 1) { map.setView([pts[0].lat, pts[0].lng], 16); return; }
    const lats = pts.map((t) => t.lat);
    const lngs = pts.map((t) => t.lng);
    map.fitBounds([[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]], { padding: [40, 40] });
  }, [trabajos]);
  return null;
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function MapaPage() {
  const [trabajos, setTrabajos] = useState([]);
  const [filtro, setFiltro] = useState('todos');
  const esCliente = localStorage.getItem('rol') === 'cliente';
  const clientePropio = localStorage.getItem('clienteNombre') || '';
  const [filtroCliente, setFiltroCliente] = useState(() =>
    localStorage.getItem('rol') === 'cliente' ? (localStorage.getItem('clienteNombre') || '') : ''
  );
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      try {
        // Admin: leer siempre del backend para ver todos los trabajos
        const { trabajos: backendData } = await obtenerTrabajosBackend();
        setTrabajos(backendData || []);
      } catch {
        // Si el backend no responde, caer en IndexedDB local
        try {
          const local = await obtenerTrabajos();
          setTrabajos(local);
          setError('Sin conexión al servidor — mostrando datos locales');
        } catch {
          setError('No se pudieron cargar los trabajos');
        }
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  const conUbicacion = trabajos.filter((t) => t.lat && t.lng);
  const filtrados = conUbicacion.filter((t) =>
    matchFiltro(t, filtro) && (!filtroCliente || t.clienteNombre === filtroCliente)
  );
  const centro = conUbicacion.length > 0
    ? [conUbicacion[0].lat, conUbicacion[0].lng]
    : [-26.8241, -65.2226];

  const tiposLabel = (t) =>
    t.items?.length ? t.items.map((i) => i.tipoTrabajo).join(', ') : (t.tipoTrabajo || '—');

  return (
    <div className="d-flex flex-column" style={{ height: 'calc(100vh - 56px)' }}>

      {/* Barra de filtros */}
      <div className="bg-white border-bottom px-3 py-2 d-flex gap-2 flex-wrap align-items-center">
        <span className="small fw-semibold text-muted me-1">
          {cargando
            ? <><span className="spinner-border spinner-border-sm me-1" style={{ width: 14, height: 14 }}></span>Cargando...</>
            : <>{filtrados.length} punto{filtrados.length !== 1 ? 's' : ''} de {conUbicacion.length}</>
          }
        </span>
        {error && (
          <span className="badge bg-warning text-dark small">
            <i className="bi bi-wifi-off me-1"></i>{error}
          </span>
        )}
        <div className="ms-auto d-flex gap-2 flex-wrap align-items-center">
          {esCliente ? (
            <span className="badge bg-primary px-3 py-2">
              <i className="bi bi-person-vcard me-1"></i>{clientePropio}
            </span>
          ) : (
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto', minWidth: 140 }}
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
            >
              <option value="">Todos los clientes</option>
              {[...new Set(conUbicacion.map((t) => t.clienteNombre).filter(Boolean))].sort().map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
          <div className="d-flex gap-1 flex-wrap">
            {FILTROS_MAPA.map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => setFiltro(key)}
                className={`btn btn-sm ${filtro === key ? 'text-white' : 'btn-outline-secondary'}`}
                style={filtro === key ? { backgroundColor: color, borderColor: color } : {}}
              >
                <span
                  className="d-inline-block rounded-circle me-1"
                  style={{ width: 9, height: 9, backgroundColor: filtro === key ? 'rgba(255,255,255,0.8)' : color, verticalAlign: 'middle' }}
                ></span>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mapa */}
      {!cargando && conUbicacion.length === 0 ? (
        <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center text-muted">
          <i className="bi bi-map display-4 mb-2"></i>
          <p className="mb-3">No hay trabajos con ubicación cargada</p>
          <Link to="/nuevo" className="btn btn-primary">Cargar primer trabajo</Link>
        </div>
      ) : (
        <div className="flex-grow-1 position-relative">
          <MapContainer
            center={centro}
            zoom={14}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds trabajos={filtrados} />

            {filtrados.map((t) => {
              const pinColor = getPinColor(t);
              const localId = t.idLocal || t.id;
              return (
                <CircleMarker
                  key={t._id || t.id}
                  center={[t.lat, t.lng]}
                  radius={4}
                  pathOptions={{ color: pinColor, fillColor: pinColor, fillOpacity: 0.85, weight: 1 }}
                >
                  <Popup maxWidth={280} className="pintura-popup">
                    <div style={{ minWidth: 240 }}>
                      <div className="fw-bold fs-6 mb-1">{t.calle1} y {t.calle2}</div>
                      <div className="d-flex gap-1 flex-wrap mb-2">
                        <span className={`badge bg-${COLORES_ESTADO_OP[t.estadoOperativo] || 'secondary'}`}>
                          {t.estadoOperativo}
                        </span>
                        <span className={`badge bg-${COLORES_ESTADO_ADMIN[t.estadoAdmin] || 'secondary'} ${t.estadoAdmin === 'En revisión' ? 'text-dark' : ''}`}>
                          {t.estadoAdmin || 'Sin certificar'}
                        </span>
                      </div>

                      <table className="table table-sm table-borderless mb-2" style={{ fontSize: 13 }}>
                        <tbody>
                          <tr>
                            <td className="text-muted p-0 pe-2">Tipo</td>
                            <td className="p-0 fw-semibold">{tiposLabel(t)}</td>
                          </tr>
                          <tr>
                            <td className="text-muted p-0 pe-2">Superficie</td>
                            <td className="p-0 fw-bold text-primary">{t.superficie} m²</td>
                          </tr>
                          <tr>
                            <td className="text-muted p-0 pe-2">Fecha</td>
                            <td className="p-0">
                              {new Date(t.fechaCarga).toLocaleString('es-AR', {
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </td>
                          </tr>
                          {t.usuario && (
                            <tr>
                              <td className="text-muted p-0 pe-2">Usuario</td>
                              <td className="p-0">{t.usuario}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>

                      {localId && (
                        <Link to={`/detalle/${localId}`} className="btn btn-sm btn-primary w-100">
                          <i className="bi bi-arrow-right-circle me-1"></i>Ver detalle
                        </Link>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>

          {/* Leyenda */}
          <div
            className="position-absolute bg-white rounded shadow-sm p-2"
            style={{ bottom: 24, left: 10, zIndex: 1000, fontSize: 12 }}
          >
            {LEYENDA.map(({ label, color }) => (
              <div key={label} className="d-flex align-items-center gap-2 mb-1">
                <span
                  className="d-inline-block rounded-circle flex-shrink-0"
                  style={{ width: 12, height: 12, backgroundColor: color }}
                ></span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
