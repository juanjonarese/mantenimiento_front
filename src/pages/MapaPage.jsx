import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { obtenerTrabajos } from '../db/db';
import { COLORES_ESTADO_OP, COLORES_ESTADO_ADMIN } from '../constants';

const COLOR_PIN = {
  'Certificado': '#0d6efd', // azul
  'Terminado':   '#198754', // verde
  'En proceso':  '#ffc107', // amarillo
  'Sin iniciar': '#dc3545', // rojo
};

function getPinColor(trabajo) {
  if (trabajo.estadoAdmin === 'Certificado') return COLOR_PIN['Certificado'];
  if (trabajo.estadoOperativo === 'Terminado' || trabajo.estadoOperativo === 'Finalizado') return COLOR_PIN['Terminado'];
  if (trabajo.estadoOperativo === 'En proceso') return COLOR_PIN['En proceso'];
  return COLOR_PIN['Sin iniciar'];
}

function FitBounds({ trabajos }) {
  const map = useMap();
  useEffect(() => {
    const puntos = trabajos.filter((t) => t.lat && t.lng);
    if (puntos.length === 0) return;
    if (puntos.length === 1) {
      map.setView([puntos[0].lat, puntos[0].lng], 16);
      return;
    }
    const lats = puntos.map((t) => t.lat);
    const lngs = puntos.map((t) => t.lng);
    map.fitBounds([
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ], { padding: [40, 40] });
  }, [trabajos]);
  return null;
}

export default function MapaPage() {
  const [trabajos, setTrabajos] = useState([]);
  const [filtro, setFiltro] = useState('todos');
  const [seleccionado, setSeleccionado] = useState(null);

  useEffect(() => {
    obtenerTrabajos().then(setTrabajos);
  }, []);

  const conUbicacion = trabajos.filter((t) => t.lat && t.lng);

  const filtrados = conUbicacion.filter((t) => {
    if (filtro === 'todos') return true;
    if (filtro === 'certificado') return t.estadoAdmin === 'Certificado';
    if (filtro === 'finalizado') return t.estadoOperativo === 'Finalizado' && t.estadoAdmin !== 'Certificado';
    if (filtro === 'en_proceso') return t.estadoOperativo === 'En proceso';
    if (filtro === 'sin_iniciar') return t.estadoOperativo === 'Sin iniciar';
    return true;
  });

  const centro = conUbicacion.length > 0
    ? [conUbicacion[0].lat, conUbicacion[0].lng]
    : [-34.6037, -58.3816];

  return (
    <div className="d-flex flex-column" style={{ height: 'calc(100vh - 56px)' }}>

      {/* Barra de filtros */}
      <div className="bg-white border-bottom px-3 py-2 d-flex gap-2 flex-wrap align-items-center">
        <span className="small fw-semibold text-muted me-1">
          {filtrados.length} punto{filtrados.length !== 1 ? 's' : ''}
        </span>
        {[
          { key: 'todos',      label: 'Todos',        color: '#6c757d' },
          { key: 'sin_iniciar',label: 'Sin iniciar',  color: COLOR_PIN['Sin iniciar'] },
          { key: 'en_proceso', label: 'En proceso',   color: COLOR_PIN['En proceso'] },
          { key: 'finalizado', label: 'Finalizado',   color: COLOR_PIN['Finalizado'] },
          { key: 'certificado',label: 'Certificado',  color: COLOR_PIN['Certificado'] },
        ].map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setFiltro(key)}
            className={`btn btn-sm ${filtro === key ? 'text-white' : 'btn-outline-secondary'}`}
            style={filtro === key ? { backgroundColor: color, borderColor: color } : {}}
          >
            <span
              className="d-inline-block rounded-circle me-1"
              style={{ width: 10, height: 10, backgroundColor: color, verticalAlign: 'middle' }}
            ></span>
            {label}
          </button>
        ))}
      </div>

      {/* Mapa */}
      {conUbicacion.length === 0 ? (
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

            {filtrados.map((t) => (
              <CircleMarker
                key={t.id}
                center={[t.lat, t.lng]}
                radius={10}
                pathOptions={{
                  color: getPinColor(t),
                  fillColor: getPinColor(t),
                  fillOpacity: 0.9,
                  weight: 2,
                }}
                eventHandlers={{ click: () => setSeleccionado(t) }}
              >
                <Popup maxWidth={280} className="pintura-popup">
                  <div style={{ minWidth: 240 }}>
                    <div className="fw-bold fs-6 mb-1">
                      {t.calle1} y {t.calle2}
                    </div>
                    <div className="d-flex gap-1 flex-wrap mb-2">
                      <span className={`badge bg-${COLORES_ESTADO_OP[t.estadoOperativo]}`}>
                        {t.estadoOperativo}
                      </span>
                      <span className={`badge bg-${COLORES_ESTADO_ADMIN[t.estadoAdmin]}`}>
                        {t.estadoAdmin}
                      </span>
                    </div>

                    <table className="table table-sm table-borderless mb-2" style={{ fontSize: 13 }}>
                      <tbody>
                        <tr>
                          <td className="text-muted p-0 pe-2">Tipo</td>
                          <td className="p-0 fw-semibold">{t.tipoTrabajo}</td>
                        </tr>
                        <tr>
                          <td className="text-muted p-0 pe-2">Medidas</td>
                          <td className="p-0">{t.largo}m × {t.ancho}m × {t.cantidad}</td>
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
                        <tr>
                          <td className="text-muted p-0 pe-2">Usuario</td>
                          <td className="p-0">{t.usuario}</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Fotos en miniatura */}
                    {t.fotos?.filter((f) => f.tipo?.startsWith('image')).length > 0 && (
                      <div className="d-flex gap-1 mb-2 flex-wrap">
                        {t.fotos
                          .filter((f) => f.tipo?.startsWith('image'))
                          .slice(0, 4)
                          .map((f, i) => (
                            <img
                              key={i}
                              src={f.data}
                              alt={f.nombre}
                              style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 4 }}
                            />
                          ))}
                        {t.fotos.filter((f) => f.tipo?.startsWith('image')).length > 4 && (
                          <div
                            className="d-flex align-items-center justify-content-center bg-light rounded"
                            style={{ width: 52, height: 52, fontSize: 12, color: '#6c757d' }}
                          >
                            +{t.fotos.filter((f) => f.tipo?.startsWith('image')).length - 4}
                          </div>
                        )}
                      </div>
                    )}

                    {t.fotos?.filter((f) => f.tipo?.startsWith('video')).length > 0 && (
                      <div className="small text-muted mb-2">
                        <i className="bi bi-camera-video me-1"></i>
                        {t.fotos.filter((f) => f.tipo?.startsWith('video')).length} video
                        {t.fotos.filter((f) => f.tipo?.startsWith('video')).length > 1 ? 's' : ''}
                      </div>
                    )}

                    <Link
                      to={`/detalle/${t.id}`}
                      className="btn btn-sm btn-primary w-100"
                    >
                      <i className="bi bi-arrow-right-circle me-1"></i>Ver detalle completo
                    </Link>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>

          {/* Leyenda */}
          <div
            className="position-absolute bg-white rounded shadow-sm p-2"
            style={{ bottom: 24, left: 10, zIndex: 1000, fontSize: 12 }}
          >
            {[
              { label: 'Sin iniciar',  color: COLOR_PIN['Sin iniciar'] },
              { label: 'En proceso',   color: COLOR_PIN['En proceso'] },
              { label: 'Finalizado',   color: COLOR_PIN['Finalizado'] },
              { label: 'Certificado',  color: COLOR_PIN['Certificado'] },
            ].map(({ label, color }) => (
              <div key={label} className="d-flex align-items-center gap-2 mb-1">
                <span
                  className="d-inline-block rounded-circle"
                  style={{ width: 12, height: 12, backgroundColor: color, flexShrink: 0 }}
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
