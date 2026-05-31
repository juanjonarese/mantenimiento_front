import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import * as XLSX from 'xlsx';
import { obtenerTrabajosBackend, obtenerEstadisticas, obtenerTodosMaterialesCatalogo, obtenerConsumoMateriales } from '../services/api';
import { TIPOS_TRABAJO, COLORES_ESTADO_OP, COLORES_ESTADO_ADMIN } from '../constants';

const COLOR_PIN = {
  'Certificado': '#0d6efd',
  'Terminado':   '#198754',
  'En proceso':  '#ffc107',
  'Sin iniciar': '#dc3545',
};

const COLORES_PIE = ['#0d6efd','#198754','#ffc107','#dc3545','#6f42c1','#0dcaf0','#fd7e14','#6c757d'];

const TIPO_ALIAS = {
  'Senda peatonal': 'SENDAS', 'Sendas': 'SENDAS', 'SENDAS': 'SENDAS',
  'Rampa': 'RAMPAS', 'Rampas': 'RAMPAS', 'RAMPAS': 'RAMPAS',
  'Cordón': 'CORDONES', 'Cordon': 'CORDONES', 'Cordones': 'CORDONES', 'CORDONES': 'CORDONES',
};
const normTipoGlobal = (t) => TIPO_ALIAS[t] || t;

function getPinColor(t) {
  if (t.estadoAdmin === 'Certificado') return COLOR_PIN['Certificado'];
  if (t.estadoOperativo === 'Terminado' || t.estadoOperativo === 'Finalizado') return COLOR_PIN['Terminado'];
  if (t.estadoOperativo === 'En proceso') return COLOR_PIN['En proceso'];
  return COLOR_PIN['Sin iniciar'];
}

function StatCard({ label, value, sub, color = 'primary', icon }) {
  return (
    <div className="col-6 col-md-4 col-lg-2">
      <div className={`card border-0 h-100`} style={{ borderLeft: `4px solid var(--bs-${color})` }}>
        <div className="card-body py-3 px-3">
          <div className="d-flex align-items-center gap-2 mb-1">
            <i className={`bi bi-${icon} text-${color}`}></i>
            <span className="small text-muted">{label}</span>
          </div>
          <div className={`fw-bold fs-4 text-${color}`}>{value}</div>
          {sub && <div className="small text-muted">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

export default function PanelPage() {
  const [trabajos, setTrabajos] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [catalogo, setCatalogo] = useState([]);
  const [consumoTurnos, setConsumoTurnos] = useState([]);
  const [pagina, setPagina] = useState(1);
  const POR_PAGINA = 15;

  const [filtros, setFiltros] = useState({
    desde: '', hasta: '', usuario: '', tipoTrabajo: '',
    estadoOperativo: '', estadoAdmin: '', material: '',
  });

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const { material, ...backendFiltros } = filtros;
      if (backendFiltros.tipoTrabajo) backendFiltros.tipoTrabajo = normTipoGlobal(backendFiltros.tipoTrabajo);
      const params = Object.fromEntries(Object.entries(backendFiltros).filter(([, v]) => v !== ''));
      const [{ trabajos: t }, { estadisticas: e }, catRes, consumoRes] = await Promise.all([
        obtenerTrabajosBackend(params),
        obtenerEstadisticas(),
        obtenerTodosMaterialesCatalogo().catch(() => ({ materiales: [] })),
        obtenerConsumoMateriales().catch(() => ({ consumo: [] })),
      ]);
      setCatalogo(catRes.materiales || []);
      setConsumoTurnos(consumoRes.consumo || []);
      let resultado = t || [];
      if (material) {
        resultado = resultado.filter((tj) =>
          [...(tj.materiales || []), ...(tj.items || []).flatMap((i) => i.materiales || [])]
            .some((m) => m.nombre === material)
        );
      }
      setTrabajos(resultado);
      setEstadisticas(e || null);
      setPagina(1);
    } catch {
      setError('No se pudo conectar con el servidor. Verificá que el backend esté activo.');
    } finally {
      setCargando(false);
    }
  }, [filtros]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Datos para gráficos ──
  const porDia = (() => {
    const mapa = {};
    trabajos.forEach((t) => {
      const dia = new Date(t.fechaCarga).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
      mapa[dia] = (mapa[dia] || 0) + 1;
    });
    return Object.entries(mapa).slice(-20).map(([fecha, cantidad]) => ({ fecha, cantidad }));
  })();

  const porTipo = (() => {
    const mapa = {};
    trabajos.forEach((t) => {
      if (t.items?.length) {
        t.items.forEach((item) => { if (item.tipoTrabajo) mapa[item.tipoTrabajo] = (mapa[item.tipoTrabajo] || 0) + 1; });
      } else if (t.tipoTrabajo) {
        mapa[t.tipoTrabajo] = (mapa[t.tipoTrabajo] || 0) + 1;
      }
    });
    return Object.entries(mapa).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  })();

  const porEstado = [
    { name: 'Sin iniciar', value: trabajos.filter((t) => t.estadoOperativo === 'Sin iniciar').length, color: '#dc3545' },
    { name: 'En proceso',  value: trabajos.filter((t) => t.estadoOperativo === 'En proceso').length,  color: '#ffc107' },
    { name: 'Terminado',   value: trabajos.filter((t) => ['Terminado','Finalizado'].includes(t.estadoOperativo)).length, color: '#198754' },
  ].filter((d) => d.value > 0);

  const porOperario = (() => {
    const mapa = {};
    trabajos.forEach((t) => {
      const u = t.usuario || 'Sin asignar';
      mapa[u] = (mapa[u] || 0) + (t.superficie || 0);
    });
    return Object.entries(mapa)
      .map(([usuario, superficie]) => ({ usuario: usuario.split('@')[0], superficie: parseFloat(superficie.toFixed(1)) }))
      .sort((a, b) => b.superficie - a.superficie)
      .slice(0, 8);
  })();

  const consumoMateriales = (() => {
    const mapa = {};
    trabajos.forEach((t) => {
      [...(t.materiales || []), ...(t.items || []).flatMap((i) => i.materiales || [])].forEach((m) => {
        if (!m.nombre) return;
        const key = `${m.nombre}||${m.unidad || ''}`;
        if (!mapa[key]) mapa[key] = { nombre: m.nombre, unidad: m.unidad || '', cantidad: 0 };
        mapa[key].cantidad += m.cantidad || 0;
      });
    });
    return Object.values(mapa)
      .map((m) => ({ ...m, cantidad: parseFloat(m.cantidad.toFixed(2)) }))
      .sort((a, b) => b.cantidad - a.cantidad);
  })();

  const normTipo = normTipoGlobal;

  // Extrae el número y la unidad de un string de tamaño (ej: "25 kg" → { num: 25, unit: "kg" })
  const parseTamano = (str) => {
    if (!str) return { num: null, unit: '' };
    const match = str.match(/^([\d.,]+)\s*(.*)$/);
    if (!match) return { num: null, unit: '' };
    return { num: parseFloat(match[1].replace(',', '.')), unit: match[2].trim() };
  };

  // Normaliza string: minúsculas, sin acentos (rango NFD U+0300-U+036F)
  const normStr = (s) => (s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  // Dos nombres de material coinciden si son iguales OR si la palabra más larga
  // del nombre del catálogo (≥ 6 chars) está contenida en el nombre del trabajo
  const matchMat = (catalogName, trabajoName) => {
    const na = normStr(catalogName);
    const nb = normStr(trabajoName);
    if (na === nb) return true;
    const longestKey = na.split(/\s+/)
      .filter((w) => w.length >= 6)
      .sort((x, y) => y.length - x.length)[0];
    return longestKey ? nb.includes(longestKey) : false;
  };

  const rendimientoMateriales = catalogo
    .filter((mat) => mat.tiposTarea && mat.tiposTarea.length > 0)
    .map((mat) => {
      const tiposNorm = mat.tiposTarea.map(normTipo);
      // Busca en consumoMateriales usando matching flexible por palabras clave
      const matched = consumoMateriales.filter((c) => matchMat(mat.nombre, c.nombre));
      const consumido = matched.reduce((s, c) => s + c.cantidad, 0);
      const consumidoUnidad = matched[0]?.unidad || mat.unidad;
      const m2 = trabajos.reduce((sum, t) => {
        if (t.items?.length) {
          return sum + t.items
            .filter((item) => tiposNorm.includes(normTipo(item.tipoTrabajo)))
            .reduce((s, item) => s + (item.superficie || 0), 0);
        }
        return sum + (tiposNorm.includes(normTipo(t.tipoTrabajo)) ? (t.superficie || 0) : 0);
      }, 0);
      const { num: tamanoNum, unit: tamanoUnit } = parseTamano(mat.tamano);
      // Si el consumo está en unidades (bolsas) → multiplicar por tamano para obtener kg/l reales
      // Si el consumo está en litros/kg → dividir por tamano para obtener cantidad de envases
      let cantidadReal, unidadReal;
      if (tamanoNum) {
        if (consumidoUnidad === 'u') {
          cantidadReal = consumido * tamanoNum;
          unidadReal = tamanoUnit || mat.unidad;
        } else {
          cantidadReal = consumido / tamanoNum;
          unidadReal = 'u';
        }
      } else {
        cantidadReal = consumido;
        unidadReal = consumidoUnidad;
      }
      // Para materiales en 'u' (bolsas): ratio = cantidadReal(kg) / m²  → kg/m²
      // Para materiales en 'l'       : ratio = consumido(l)    / m²  → l/m²
      const ratioBase = consumidoUnidad === 'u' ? cantidadReal : consumido;
      const ratioUnidad = consumidoUnidad === 'u' ? (tamanoUnit || mat.unidad) : consumidoUnidad;
      return {
        nombre: mat.nombre,
        unidad: mat.unidad,
        tamano: mat.tamano || '',
        tamanoNum,
        consumidoUnidad,
        tiposTarea: mat.tiposTarea,
        consumido: parseFloat(consumido.toFixed(3)),
        cantidadReal: parseFloat(cantidadReal.toFixed(3)),
        unidadReal,
        m2: parseFloat(m2.toFixed(2)),
        ratio: m2 > 0 && ratioBase > 0 ? parseFloat((ratioBase / m2).toFixed(4)) : null,
        ratioUnidad,
      };
    });

  const porDiaSuperficie = (() => {
    const mapa = {};
    trabajos.forEach((t) => {
      const dia = new Date(t.fechaCarga).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
      mapa[dia] = (mapa[dia] || 0) + (t.superficie || 0);
    });
    return Object.entries(mapa).slice(-20).map(([fecha, superficie]) => ({ fecha, superficie: parseFloat(superficie.toFixed(1)) }));
  })();

  // ── Paginación ──
  const totalPaginas = Math.ceil(trabajos.length / POR_PAGINA);
  const trabajosPagina = trabajos.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  // ── Usuarios únicos para filtro ──
  const usuarios = [...new Set(trabajos.map((t) => t.usuario))].sort();

  // ── Materiales únicos para filtro ──
  const materialesUnicos = [...new Set(
    trabajos.flatMap((t) => [
      ...(t.materiales || []).map((m) => m.nombre),
      ...(t.items || []).flatMap((i) => (i.materiales || []).map((m) => m.nombre)),
    ]).filter(Boolean)
  )].sort();

  // ── Export Excel ──
  function exportarExcel() {
    const filas = trabajos.map((t) => ({
      Fecha: new Date(t.fechaCarga).toLocaleString('es-AR'),
      Usuario: t.usuario,
      'Calle 1': t.calle1,
      'Calle 2': t.calle2,
      Tipos: t.items ? t.items.map((i) => i.tipoTrabajo).join(', ') : (t.tipoTrabajo || ''),
      'Superficie (m²)': t.superficie,
      'Estado operativo': t.estadoOperativo,
      Certificación: t.estadoAdmin,
      Materiales: t.materiales?.map((m) => `${m.nombre}: ${m.cantidad} ${m.unidad}`).join(' | ') || '',
      Latitud: t.lat,
      Longitud: t.lng,
      Observaciones: t.observaciones || '',
      'Link Drive': t.linkDrive || '',
      'Link MyMaps': t.linkMyMaps || '',
    }));
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Trabajos');
    XLSX.writeFile(wb, `trabajos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function handleFiltro(e) {
    setFiltros((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function limpiarFiltros() {
    setFiltros({ desde: '', hasta: '', usuario: '', tipoTrabajo: '', estadoOperativo: '', estadoAdmin: '', material: '' });
  }

  const hayFiltros = Object.values(filtros).some((v) => v !== '');
  const superficieTotal = trabajos.reduce((acc, t) => acc + (t.superficie || 0), 0);

  const m2PorTipo = (() => {
    const mapa = {};
    trabajos.forEach((t) => {
      if (t.items?.length) {
        t.items.forEach((item) => {
          if (item.tipoTrabajo) mapa[item.tipoTrabajo] = (mapa[item.tipoTrabajo] || 0) + (item.superficie || 0);
        });
      } else if (t.tipoTrabajo) {
        mapa[t.tipoTrabajo] = (mapa[t.tipoTrabajo] || 0) + (t.superficie || 0);
      }
    });
    return Object.entries(mapa)
      .map(([tipo, m2]) => ({ tipo, m2: parseFloat(m2.toFixed(1)) }))
      .sort((a, b) => b.m2 - a.m2);
  })();

  return (
    <div className="panel-page">

      {/* ── HEADER ── */}
      <div className="panel-header border-bottom bg-white px-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h4 className="fw-bold mb-0">
            <i className="bi bi-bar-chart-line me-2 text-primary"></i>Panel de gestión
          </h4>
          <small className="text-muted">Vista de administración y supervisión</small>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-success btn-sm" onClick={exportarExcel} disabled={trabajos.length === 0}>
            <i className="bi bi-file-earmark-excel me-1"></i>Exportar Excel
          </button>
          <button className="btn btn-outline-secondary btn-sm" onClick={() => window.print()}>
            <i className="bi bi-printer me-1"></i>Imprimir / PDF
          </button>
          <button className="btn btn-outline-primary btn-sm" onClick={cargar} disabled={cargando}>
            <i className={`bi bi-arrow-clockwise me-1 ${cargando ? 'spin' : ''}`}></i>Actualizar
          </button>
        </div>
      </div>

      <div className="container-fluid px-3 px-lg-4 py-3">

        {error && (
          <div className="alert alert-warning d-flex align-items-center gap-2">
            <i className="bi bi-info-circle-fill"></i>
            <div>
              <strong>Panel no disponible sin sesión activa.</strong>
              <span className="ms-1 small">Iniciá sesión para ver los datos del servidor.</span>
            </div>
          </div>
        )}

        {/* ── FILTROS ── */}
        <div className="card mb-4">
          <div className="card-header fw-semibold small d-flex justify-content-between align-items-center">
            <span><i className="bi bi-funnel me-1"></i>Filtros</span>
            {hayFiltros && (
              <button className="btn btn-sm btn-outline-secondary py-0" onClick={limpiarFiltros}>
                <i className="bi bi-x me-1"></i>Limpiar
              </button>
            )}
          </div>
          <div className="card-body">
            <div className="row g-2">
              <div className="col-6 col-md-3 col-lg-2">
                <label className="form-label small fw-semibold mb-1">Desde</label>
                <input type="date" className="form-control form-control-sm" name="desde"
                  value={filtros.desde} onChange={handleFiltro} />
              </div>
              <div className="col-6 col-md-3 col-lg-2">
                <label className="form-label small fw-semibold mb-1">Hasta</label>
                <input type="date" className="form-control form-control-sm" name="hasta"
                  value={filtros.hasta} onChange={handleFiltro} />
              </div>
              <div className="col-6 col-md-3 col-lg-2">
                <label className="form-label small fw-semibold mb-1">Usuario</label>
                <select className="form-select form-select-sm" name="usuario"
                  value={filtros.usuario} onChange={handleFiltro}>
                  <option value="">Todos</option>
                  {usuarios.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="col-6 col-md-3 col-lg-2">
                <label className="form-label small fw-semibold mb-1">Tipo</label>
                <select className="form-select form-select-sm" name="tipoTrabajo"
                  value={filtros.tipoTrabajo} onChange={handleFiltro}>
                  <option value="">Todos</option>
                  {[...new Set(TIPOS_TRABAJO.map(normTipoGlobal))].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-6 col-md-3 col-lg-2">
                <label className="form-label small fw-semibold mb-1">Estado op.</label>
                <select className="form-select form-select-sm" name="estadoOperativo"
                  value={filtros.estadoOperativo} onChange={handleFiltro}>
                  <option value="">Todos</option>
                  <option>Sin iniciar</option>
                  <option>En proceso</option>
                  <option>Terminado</option>
                </select>
              </div>
              <div className="col-6 col-md-3 col-lg-2">
                <label className="form-label small fw-semibold mb-1">Certificación</label>
                <select className="form-select form-select-sm" name="estadoAdmin"
                  value={filtros.estadoAdmin} onChange={handleFiltro}>
                  <option value="">Todas</option>
                  <option>Sin certificar</option>
                  <option>Certificado</option>
                  <option>Rechazado</option>
                </select>
              </div>
              <div className="col-6 col-md-3 col-lg-2">
                <label className="form-label small fw-semibold mb-1">Material</label>
                <select className="form-select form-select-sm" name="material"
                  value={filtros.material} onChange={handleFiltro}>
                  <option value="">Todos</option>
                  {materialesUnicos.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── STATS ── */}
        <div className="row g-3 mb-4">
          <StatCard label="Total trabajos" value={trabajos.length} icon="collection" color="primary" />
          <div className="col-6 col-md-4 col-lg-2">
            <div className="card border-0 h-100" style={{ borderLeft: '4px solid var(--bs-info)' }}>
              <div className="card-body py-3 px-3">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <i className="bi bi-rulers text-info"></i>
                  <span className="small text-muted">Superficie total</span>
                </div>
                <div className="fw-bold fs-4 text-info">{superficieTotal.toFixed(0)} m²</div>
                {m2PorTipo.map(({ tipo, m2 }) => (
                  <div key={tipo} className="d-flex justify-content-between small text-muted mt-1">
                    <span>{tipo}</span>
                    <span className="fw-semibold">{m2.toLocaleString('es-AR')} m²</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <StatCard label="Terminados" value={trabajos.filter((t) => ['Terminado','Finalizado'].includes(t.estadoOperativo)).length} icon="check-circle" color="success" />
          <StatCard label="En proceso" value={trabajos.filter((t) => t.estadoOperativo === 'En proceso').length} icon="hourglass-split" color="warning" />
          <StatCard label="Sin iniciar" value={trabajos.filter((t) => t.estadoOperativo === 'Sin iniciar').length} icon="pause-circle" color="danger" />
          <StatCard label="Certificados" value={trabajos.filter((t) => t.estadoAdmin === 'Certificado').length} icon="patch-check" color="primary"
            sub={`${trabajos.filter((t) => t.estadoAdmin === 'Rechazado').length} rechazados`} />
        </div>

        {/* ── GRÁFICOS ── */}
        <div className="row g-3 mb-4">
          <div className="col-12 col-lg-6">
            <div className="card h-100">
              <div className="card-header fw-semibold small">
                <i className="bi bi-bar-chart me-1"></i>Trabajos por día (últimos registros)
              </div>
              <div className="card-body">
                {porDia.length === 0
                  ? <div className="text-center text-muted py-4">Sin datos</div>
                  : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={porDia} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="cantidad" fill="#0d6efd" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-6 col-lg-3">
            <div className="card h-100">
              <div className="card-header fw-semibold small">
                <i className="bi bi-pie-chart me-1"></i>Por tipo
              </div>
              <div className="card-body d-flex align-items-center justify-content-center">
                {porTipo.length === 0
                  ? <div className="text-center text-muted">Sin datos</div>
                  : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={porTipo} dataKey="value" nameKey="name" cx="50%" cy="50%"
                          outerRadius={70} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                          labelLine={false}>
                          {porTipo.map((_, i) => <Cell key={i} fill={COLORES_PIE[i % COLORES_PIE.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v, n) => [v, n]} />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-6 col-lg-3">
            <div className="card h-100">
              <div className="card-header fw-semibold small">
                <i className="bi bi-pie-chart me-1"></i>Por estado
              </div>
              <div className="card-body d-flex align-items-center justify-content-center">
                {porEstado.length === 0
                  ? <div className="text-center text-muted">Sin datos</div>
                  : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={porEstado} dataKey="value" nameKey="name" cx="50%" cy="50%"
                          outerRadius={70} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                          labelLine={false}>
                          {porEstado.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
              </div>
            </div>
          </div>
        </div>

        {/* ── GRÁFICOS EXTRA ── */}
        <div className="row g-3 mb-4">
          <div className="col-12 col-lg-6">
            <div className="card h-100">
              <div className="card-header fw-semibold small">
                <i className="bi bi-person-bar-chart me-1"></i>m² por operario
              </div>
              <div className="card-body">
                {porOperario.length === 0
                  ? <div className="text-center text-muted py-4">Sin datos</div>
                  : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={porOperario} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} unit=" m²" />
                        <YAxis type="category" dataKey="usuario" tick={{ fontSize: 11 }} width={80} />
                        <Tooltip formatter={(v) => [`${v} m²`, 'Superficie']} />
                        <Bar dataKey="superficie" fill="#198754" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-6">
            <div className="card h-100">
              <div className="card-header fw-semibold small">
                <i className="bi bi-graph-up me-1"></i>m² ejecutados por día
              </div>
              <div className="card-body">
                {porDiaSuperficie.length === 0
                  ? <div className="text-center text-muted py-4">Sin datos</div>
                  : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={porDiaSuperficie} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} unit=" m²" />
                        <Tooltip formatter={(v) => [`${v} m²`, 'Superficie']} />
                        <Bar dataKey="superficie" fill="#0d6efd" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
              </div>
            </div>
          </div>
        </div>

        {/* ── MATERIALES ── */}
        <div className="card mb-4">
          <div className="card-header fw-semibold small">
            <i className="bi bi-box-seam me-1"></i>Consumo de materiales
            {consumoMateriales.length > 0 && (
              <span className="text-muted fw-normal ms-2">({consumoMateriales.length} materiales)</span>
            )}
          </div>
          {consumoMateriales.length === 0 ? (
            <div className="card-body text-center text-muted py-4">
              <i className="bi bi-box display-4 d-block mb-2"></i>
              Sin datos de materiales en los trabajos seleccionados
            </div>
          ) : (
            <div className="card-body">
              <div className="row g-3">
                {/* Gráfico barras horizontales — top 10 */}
                <div className="col-12 col-lg-7">
                  <p className="small fw-semibold text-muted mb-2">Top materiales por cantidad</p>
                  <ResponsiveContainer width="100%" height={Math.max(200, Math.min(consumoMateriales.length, 10) * 36)}>
                    <BarChart
                      data={consumoMateriales.slice(0, 10)}
                      layout="vertical"
                      margin={{ top: 4, right: 60, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11 }} width={120} />
                      <Tooltip
                        formatter={(v, _n, props) => [`${v} ${props.payload.unidad}`, 'Cantidad']}
                      />
                      <Bar dataKey="cantidad" fill="#6f42c1" radius={[0, 4, 4, 0]}>
                        {consumoMateriales.slice(0, 10).map((m, i) => (
                          <Cell key={i} fill={COLORES_PIE[i % COLORES_PIE.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Tabla resumen */}
                <div className="col-12 col-lg-5">
                  <p className="small fw-semibold text-muted mb-2">Detalle completo</p>
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    <table className="table table-sm table-hover mb-0">
                      <thead className="table-light sticky-top">
                        <tr>
                          <th className="small">Material</th>
                          <th className="small text-end">Cantidad</th>
                          <th className="small">Unidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {consumoMateriales.map((m, i) => (
                          <tr key={i}>
                            <td className="small">{m.nombre}</td>
                            <td className="small text-end fw-bold text-primary">{m.cantidad.toLocaleString('es-AR')}</td>
                            <td className="small text-muted">{m.unidad}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RENDIMIENTO DE MATERIALES ── */}
        <div className="card mb-4">
          <div className="card-header fw-semibold small">
            <i className="bi bi-speedometer2 me-1"></i>Rendimiento de materiales
            {rendimientoMateriales.length > 0 && (
              <span className="text-muted fw-normal ms-2">
                ({rendimientoMateriales.length} material{rendimientoMateriales.length !== 1 ? 'es' : ''} configurado{rendimientoMateriales.length !== 1 ? 's' : ''})
              </span>
            )}
          </div>
          {rendimientoMateriales.length === 0 ? (
            <div className="card-body text-center text-muted py-4">
              <i className="bi bi-speedometer2 display-4 d-block mb-2"></i>
              <p className="mb-1">Sin materiales configurados</p>
              <p className="small">En <strong>Materiales</strong>, asociá cada material a sus tipos de tarea para ver el rendimiento aquí.</p>
            </div>
          ) : (
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="small ps-3">Material</th>
                      <th className="small">Tipos de tarea</th>
                      <th className="small text-end">Consumido</th>
                      <th className="small text-end">m² ejecutados</th>
                      <th className="small text-end pe-3">Rendimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rendimientoMateriales.map((r, i) => (
                      <tr key={i}>
                        <td className="small fw-semibold ps-3">{r.nombre}</td>
                        <td className="small text-muted">
                          {r.tiposTarea.map((t) => (
                            <span key={t} className="badge bg-light text-dark border me-1">{t}</span>
                          ))}
                        </td>
                        <td className="small text-end">
                          {r.consumido > 0 ? (
                            <div>
                              {r.consumidoUnidad === 'u' ? (
                                // Bolsas: primario = bolsas, secundario = kg/l reales
                                <>
                                  <span className="fw-bold text-primary">{r.consumido.toLocaleString('es-AR')} {r.unidad}</span>
                                  {r.tamanoNum && (
                                    <div className="text-muted" style={{ fontSize: 11 }}>
                                      = {r.cantidadReal.toLocaleString('es-AR')} {r.unidadReal}
                                    </div>
                                  )}
                                </>
                              ) : (
                                // Litros: primario = envases (÷ tamano), secundario = litros reales
                                <>
                                  <span className="fw-bold text-primary">{r.cantidadReal.toLocaleString('es-AR')} u</span>
                                  {r.tamanoNum && (
                                    <div className="text-muted" style={{ fontSize: 11 }}>
                                      = {r.consumido.toLocaleString('es-AR')} {r.consumidoUnidad}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          ) : <span className="text-muted">—</span>}
                        </td>
                        <td className="small text-end">
                          {r.m2 > 0
                            ? <span>{r.m2.toLocaleString('es-AR')} m²</span>
                            : <span className="text-muted">—</span>}
                        </td>
                        <td className="small text-end pe-3">
                          {r.ratio !== null
                            ? (
                              <span className="badge bg-success fs-6 px-2 py-1">
                                {r.ratio.toLocaleString('es-AR')} {r.ratioUnidad}/m²
                              </span>
                            )
                            : <span className="text-muted small">Sin datos aún</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── MAPA ── */}
        <div className="card mb-4">
          <div className="card-header fw-semibold small d-flex justify-content-between align-items-center">
            <span><i className="bi bi-map me-1"></i>Mapa de trabajos ({trabajos.filter(t => t.lat && t.lng).length} puntos)</span>
            <div className="d-flex gap-2 small">
              {[
                { label: 'Sin iniciar', color: '#dc3545' },
                { label: 'En proceso',  color: '#ffc107' },
                { label: 'Finalizado',  color: '#198754' },
                { label: 'Certificado', color: '#0d6efd' },
              ].map(({ label, color }) => (
                <span key={label} className="d-flex align-items-center gap-1">
                  <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color, display: 'inline-block' }}></span>
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="card-body p-0" style={{ height: 320 }}>
            {trabajos.filter(t => t.lat && t.lng).length === 0
              ? (
                <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                  <div className="text-center"><i className="bi bi-map display-4"></i><p className="mt-2">Sin puntos con ubicación</p></div>
                </div>
              ) : (
                <MapContainer
                  center={[trabajos.find(t => t.lat)?.lat || -26.8241, trabajos.find(t => t.lng)?.lng || -65.2226]}
                  zoom={12}
                  style={{ height: '100%', width: '100%', borderRadius: '0 0 12px 12px' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap'
                  />
                  {trabajos.filter(t => t.lat && t.lng).map((t) => (
                    <CircleMarker key={t._id} center={[t.lat, t.lng]} radius={4}
                      pathOptions={{ color: getPinColor(t), fillColor: getPinColor(t), fillOpacity: 0.85, weight: 1 }}>
                      <Popup maxWidth={220}>
                        <div className="fw-semibold">{t.calle1} y {t.calle2}</div>
                        <div className="small text-muted">
                          {t.items?.length > 0 ? t.items.map((i) => i.tipoTrabajo).join(', ') : t.tipoTrabajo} · {t.superficie} m²
                        </div>
                        <div className="small">{t.estadoOperativo} · {t.estadoAdmin}</div>
                        <div className="small text-muted">{t.usuario}</div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              )}
          </div>
        </div>

        {/* ── TABLA ── */}
        <div className="card">
          <div className="card-header fw-semibold small d-flex justify-content-between align-items-center">
            <span>
              <i className="bi bi-table me-1"></i>
              {trabajos.length} trabajo{trabajos.length !== 1 ? 's' : ''}
              {hayFiltros && ' (filtrado)'}
            </span>
            <span className="text-muted small">
              Página {pagina} de {totalPaginas || 1}
            </span>
          </div>

          {cargando ? (
            <div className="card-body text-center py-5">
              <div className="spinner-border text-primary"></div>
              <p className="mt-2 text-muted">Cargando datos...</p>
            </div>
          ) : trabajos.length === 0 ? (
            <div className="card-body text-center py-5 text-muted">
              <i className="bi bi-inbox display-4"></i>
              <p className="mt-2">No hay trabajos con los filtros seleccionados</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover table-sm mb-0 align-middle">
                  <thead className="table-light">
                    <tr>
                      <th className="small">Fecha</th>
                      <th className="small">Intersección</th>
                      <th className="small">Tipo</th>
                      <th className="small text-end">m²</th>
                      <th className="small">Estado</th>
                      <th className="small">Certif.</th>
                      <th className="small">Usuario</th>
                      <th className="small">Fotos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trabajosPagina.map((t) => (
                      <tr key={t._id}>
                        <td className="small text-nowrap">
                          {new Date(t.fechaCarga).toLocaleDateString('es-AR', {
                            day: '2-digit', month: '2-digit', year: '2-digit',
                          })}
                        </td>
                        <td className="small fw-semibold">{t.calle1} y {t.calle2}</td>
                        <td className="small">{t.items ? t.items.map((i) => i.tipoTrabajo).join(', ') : t.tipoTrabajo}</td>
                        <td className="small text-end fw-bold text-primary">{t.superficie}</td>
                        <td>
                          <span className={`badge bg-${COLORES_ESTADO_OP[t.estadoOperativo]}`} style={{ fontSize: 11 }}>
                            {t.estadoOperativo}
                          </span>
                        </td>
                        <td>
                          <span className={`badge bg-${COLORES_ESTADO_ADMIN[t.estadoAdmin]}`} style={{ fontSize: 11 }}>
                            {t.estadoAdmin === 'Certificado' ? '✓ Cert.' : 'Sin cert.'}
                          </span>
                        </td>
                        <td className="small text-muted text-truncate" style={{ maxWidth: 120 }}>
                          {t.usuario}
                        </td>
                        <td className="small text-center text-muted">
                          {t.cantFotos > 0
                            ? <><i className="bi bi-camera me-1"></i>{t.cantFotos}</>
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="table-light">
                    <tr>
                      <td colSpan={3} className="small fw-semibold">Total página</td>
                      <td className="small text-end fw-bold text-primary">
                        {trabajosPagina.reduce((a, t) => a + (t.superficie || 0), 0).toFixed(1)} m²
                      </td>
                      <td colSpan={4}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Paginación */}
              {totalPaginas > 1 && (
                <div className="card-footer d-flex justify-content-center gap-1 py-2">
                  <button className="btn btn-sm btn-outline-secondary" disabled={pagina === 1}
                    onClick={() => setPagina(1)}>«</button>
                  <button className="btn btn-sm btn-outline-secondary" disabled={pagina === 1}
                    onClick={() => setPagina((p) => p - 1)}>‹</button>
                  {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                    const p = Math.max(1, Math.min(pagina - 2, totalPaginas - 4)) + i;
                    return (
                      <button key={p}
                        className={`btn btn-sm ${p === pagina ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setPagina(p)}>{p}</button>
                    );
                  })}
                  <button className="btn btn-sm btn-outline-secondary" disabled={pagina === totalPaginas}
                    onClick={() => setPagina((p) => p + 1)}>›</button>
                  <button className="btn btn-sm btn-outline-secondary" disabled={pagina === totalPaginas}
                    onClick={() => setPagina(totalPaginas)}>»</button>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
