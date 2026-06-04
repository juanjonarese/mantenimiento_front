import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { obtenerTrabajos, guardarTrabajo, importarDesdeBackend } from '../db/db';
import { obtenerTrabajosBackend } from '../services/api';
import { useUsuariosMap } from '../hooks/useUsuariosMap';
import * as XLSX from 'xlsx';

// ─── Helpers ───────────────────────────────────────────────────────────────
const isoToDisplay = (s) => s ? s.split('-').reverse().join('/') : '';

const ESTADOS_PENDIENTE = ['Terminado', 'Finalizado'];

const ESTADO_CONFIG = {
  'Sin certificar': {
    color: 'secondary',
    bg: '',
    icon: 'hourglass-split',
    label: 'Sin certificar',
  },
  'En revisión': {
    color: 'warning',
    bg: 'bg-warning bg-opacity-10',
    icon: 'send',
    label: 'En revisión',
  },
  'Certificado': {
    color: 'success',
    bg: 'bg-success bg-opacity-10',
    icon: 'patch-check-fill',
    label: 'Certificado',
  },
  'Rechazado': {
    color: 'danger',
    bg: 'bg-danger bg-opacity-10',
    icon: 'x-circle-fill',
    label: 'Rechazado',
  },
  'Facturado': {
    color: 'info',
    bg: 'bg-info bg-opacity-10',
    icon: 'receipt',
    label: 'Facturado',
  },
};

function formatFecha(f) {
  if (!f) return '—';
  return new Date(f).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function superficieDe(t) {
  return (t.items || []).reduce((s, i) => s + (i.superficie || 0), 0).toFixed(2);
}

// Mapeo de tipos de trabajo a columnas del certificado
const CERT_ITEMS = [
  { key: 'item1', lines: ['ÍTEM 1', 'Sendas Peat./', 'Lín. Detención', '(m²)'],  tipos: ['Senda peatonal', 'Línea divisoria', 'Flecha', 'Estacionamiento'] },
  { key: 'item2', lines: ['ÍTEM 2', 'Rampas para', 'Discapacitados', '(m²)'],    tipos: ['Rampa', 'Ochava'] },
  { key: 'item3', lines: ['ÍTEM 3', 'Cordones', 'Cuneta', '(m²)'],               tipos: ['Cordón'] },
  { key: 'otros', lines: ['Otros', '(m²)'],                                       tipos: ['Otros'] },
];

function agruparPorInterseccion(trabajos) {
  const mapa = new Map();
  trabajos.forEach((t) => {
    const key = `${t.calle1} y ${t.calle2}`;
    if (!mapa.has(key)) {
      mapa.set(key, { interseccion: key, totales: Object.fromEntries(CERT_ITEMS.map((ci) => [ci.key, 0])) });
    }
    (t.items || []).forEach((item) => {
      const ci = CERT_ITEMS.find((c) => c.tipos.includes(item.tipoTrabajo));
      const k = ci ? ci.key : 'otros';
      mapa.get(key).totales[k] += item.superficie || 0;
    });
  });
  return [...mapa.values()];
}

function n(v) { return v > 0 ? v.toFixed(2).replace('.', ',') : '0,00'; }

function descargarExcelCert(trabajos, certData = {}) {
  const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const inters = agruparPorInterseccion(trabajos);
  const totales = Object.fromEntries(CERT_ITEMS.map((ci) => [ci.key, 0]));
  inters.forEach((r) => CERT_ITEMS.forEach((ci) => { totales[ci.key] += r.totales[ci.key]; }));

  const aoa = [
    ['CREAR CONSTRUCCIONES Y MANT. S.A.'],
    ['Pintura Vial · Demarcación Horizontal · Señalización  |  CUIT: 30-71241930-6  |  Muñecas 2657, San Miguel de Tucumán – CP 4000'],
    ['CERTIFICADO DE OBRA – DEMARCACIÓN VIAL  |  Municipalidad de San Miguel de Tucumán'],
    [],
    ['DATOS DEL CERTIFICADO'],
    ['N° Certificado', certData.nro || ''],
    ['Expediente Municipal', certData.expediente || ''],
    ['Fecha', fecha],
    ['Contrato / Licitación N°', certData.contrato || ''],
    ['Período de Ejecución', certData.periodo || ''],
    ['Inspector Municipal', certData.inspector || ''],
    [],
    ['DETALLE DE TRABAJOS POR INTERSECCIÓN'],
    ['#', 'INTERSECCIÓN DE CALLES', ...CERT_ITEMS.map((ci) => ci.lines.join(' '))],
    ...Array.from({ length: 20 }, (_, i) => {
      const r = inters[i];
      return [i + 1, r ? r.interseccion : '', ...CERT_ITEMS.map((ci) => r ? parseFloat(r.totales[ci.key].toFixed(2)) : '')];
    }),
    ['TOTALES', '', ...CERT_ITEMS.map((ci) => parseFloat(totales[ci.key].toFixed(2)))],
    [],
    ['FIRMAS Y CERTIFICACIÓN'],
    [],
    ['Damián Narese', '', 'Jefe de Operaciones'],
    ['Gerente General – CUIT: 30-71241930-6', '', 'Crear Construcciones y Mant. S.A.'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 6 }, { wch: 36 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Certificado');
  XLSX.writeFile(wb, `certificado_${(certData.nro || new Date().toISOString().slice(0,10))}.xlsx`);
}

function imprimirPDF(trabajos, certData = {}) {
  const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const inters = agruparPorInterseccion(trabajos);
  const totales = Object.fromEntries(CERT_ITEMS.map((ci) => [ci.key, 0]));
  inters.forEach((r) => CERT_ITEMS.forEach((ci) => { totales[ci.key] += r.totales[ci.key]; }));

  const filas20 = Array.from({ length: 20 }, (_, i) => inters[i] || null);
  const colHeaders = CERT_ITEMS.map((ci) => `<th class="num">${ci.lines.join('<br>')}</th>`).join('');
  const filasHTML = filas20.map((r, i) => `
    <tr class="${r ? '' : 'vacia'}">
      <td class="centro">${i + 1}</td>
      <td>${r ? r.interseccion : ''}</td>
      ${CERT_ITEMS.map((ci) => `<td class="num">${r ? n(r.totales[ci.key]) : ''}</td>`).join('')}
    </tr>`).join('');

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
  <title>Certificado ${certData.nro || fecha}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:10pt;color:#111;padding:14mm 14mm 10mm}
    .empresa{font-size:14pt;font-weight:bold;letter-spacing:.5px;border-bottom:2px solid #1a3a6e;padding-bottom:4px;margin-bottom:2px}
    .empresa-sub{font-size:8pt;color:#444;margin-bottom:8px}
    .doc-title{background:#1a3a6e;color:#fff;font-size:9pt;font-weight:bold;padding:5px 10px;text-align:center;letter-spacing:.3px;margin-bottom:12px}
    .seccion{font-size:9pt;font-weight:bold;background:#dce6f1;padding:4px 8px;margin-bottom:6px;border-left:3px solid #1a3a6e;text-transform:uppercase}
    .datos-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px 16px;margin-bottom:14px;font-size:8.5pt}
    .dato label{display:block;font-size:7.5pt;color:#666;margin-bottom:1px}
    .dato .val{border-bottom:1px solid #aaa;min-height:14px;padding-bottom:1px}
    table{width:100%;border-collapse:collapse;font-size:8.5pt;margin-bottom:14px}
    thead th{background:#1a3a6e;color:#fff;padding:4px 5px;text-align:center;vertical-align:bottom;border:1px solid #1a3a6e;line-height:1.3}
    td{border:1px solid #b0b8c8;padding:3px 5px;vertical-align:middle}
    .num{text-align:right}
    .centro{text-align:center}
    .vacia td{height:14px;background:#fafafa}
    .tot td{font-weight:bold;background:#dce6f1;border-top:2px solid #1a3a6e}
    .firmas{margin-top:18px;display:grid;grid-template-columns:1fr 1fr;gap:20px}
    .firma-box{border-top:1.5px solid #333;padding-top:6px;font-size:8.5pt}
    .firma-box .nombre{font-weight:bold;font-size:9.5pt}
    .firma-box .cargo{color:#444;font-size:8pt}
    @page{size:A4 landscape;margin:12mm}
  </style></head><body>
  <div class="empresa">CREAR CONSTRUCCIONES Y MANT. S.A.</div>
  <div class="empresa-sub">Pintura Vial · Demarcación Horizontal · Señalización &nbsp;|&nbsp; CUIT: 30-71241930-6 &nbsp;|&nbsp; Muñecas 2657, San Miguel de Tucumán – CP 4000</div>
  <div class="doc-title">CERTIFICADO DE OBRA – DEMARCACIÓN VIAL &nbsp;|&nbsp; Municipalidad de San Miguel de Tucumán</div>

  <div class="seccion">Datos del Certificado</div>
  <div class="datos-grid">
    <div class="dato"><label>N° Certificado</label><div class="val">${certData.nro || ''}</div></div>
    <div class="dato"><label>Expediente Municipal</label><div class="val">${certData.expediente || ''}</div></div>
    <div class="dato"><label>Fecha</label><div class="val">${fecha}</div></div>
    <div class="dato"><label>Contrato / Licitación N°</label><div class="val">${certData.contrato || ''}</div></div>
    <div class="dato"><label>Período de Ejecución</label><div class="val">${certData.periodo || ''}</div></div>
    <div class="dato"><label>Inspector Municipal</label><div class="val">${certData.inspector || ''}</div></div>
  </div>

  <div class="seccion">Detalle de Trabajos por Intersección</div>
  <table>
    <thead><tr>
      <th style="width:30px">#</th>
      <th style="text-align:left">INTERSECCIÓN DE CALLES</th>
      ${colHeaders}
    </tr></thead>
    <tbody>${filasHTML}
      <tr class="tot">
        <td colspan="2" class="centro">TOTALES</td>
        ${CERT_ITEMS.map((ci) => `<td class="num">${n(totales[ci.key])}</td>`).join('')}
      </tr>
    </tbody>
  </table>

  <div class="seccion">Firmas y Certificación</div>
  <div class="firmas">
    <div class="firma-box">
      <div class="nombre">Damián Narese</div>
      <div class="cargo">Gerente General – CUIT: 30-71241930-6</div>
    </div>
    <div class="firma-box">
      <div class="nombre">Jefe de Operaciones</div>
      <div class="cargo">Crear Construcciones y Mant. S.A.</div>
    </div>
  </div>
  </body></html>`;

  const win = window.open('', '_blank', 'width=1000,height=720');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

function buildMailto(emailTo, trabajo, mensaje, docLink) {
  const sup = superficieDe(trabajo);
  const tareas = (trabajo.items || [])
    .map((i) => `  - ${i.tipoTrabajo}: ${i.superficie} m²`)
    .join('\n');
  const subject = `Solicitud de certificación — ${trabajo.calle1} y ${trabajo.calle2}`;
  const body = [
    'Estimado/a,',
    '',
    'Se solicita la certificación del siguiente trabajo de pintura vial:',
    '',
    `Ubicación: ${trabajo.calle1} y ${trabajo.calle2}`,
    `Fecha de ejecución: ${formatFecha(trabajo.fechaCarga)}`,
    `Superficie total: ${sup} m²`,
    '',
    'Detalle de tareas:',
    tareas,
    trabajo.observaciones ? `\nObservaciones: ${trabajo.observaciones}` : '',
    docLink ? `\nDocumentación: ${docLink}` : '',
    mensaje ? `\nMensaje: ${mensaje}` : '',
    '',
    'Quedo a disposición para cualquier consulta.',
  ]
    .filter((l) => l !== null)
    .join('\n');

  return `mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ─── Componente ────────────────────────────────────────────────────────────

const FILTROS = [
  { key: 'pendientes', label: 'Sin certificar', estados: ['Sin certificar'],                  estadoKey: 'Sin certificar' },
  { key: 'revision',   label: 'En revisión',   estados: ['En revisión'],                     estadoKey: 'En revisión'   },
  { key: 'aprobados',  label: 'Certificados',  estados: ['Certificado'],                     estadoKey: 'Certificado'   },
  { key: 'facturados', label: 'Facturados',    estados: ['Facturado'],                       estadoKey: 'Facturado'     },
  { key: 'rechazados', label: 'Rechazados',    estados: ['Rechazado'],                       estadoKey: 'Rechazado'     },
  { key: 'todos',      label: 'Todos',         estados: null,                                estadoKey: null            },
];

export default function CertificacionesPage() {
  const resolve = useUsuariosMap();
  const [trabajos, setTrabajos] = useState([]);
  const [filtro, setFiltro] = useState('pendientes');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [busquedaNro, setBusquedaNro] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [expandido, setExpandido] = useState(null);
  const [modal, setModal] = useState(null); // { tipo, trabajo | bulk }
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState('');

  // Campos del modal
  const [emailTo, setEmailTo] = useState('');
  const [docLink, setDocLink] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [notas, setNotas] = useState('');
  const [motivo, setMotivo] = useState('');
  const [certData, setCertData] = useState({ nro: '', expediente: '', contrato: '', periodo: '', inspector: '' });
  const [facData, setFacData] = useState({ expediente: '', nroFactura: '' });

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    try {
      const { trabajos: backendData } = await obtenerTrabajosBackend();
      if (backendData?.length) await importarDesdeBackend(backendData);
    } catch { /* sin conexión, usa store local */ }
    const todos = await obtenerTrabajos();
    const terminados = todos.filter((t) => ESTADOS_PENDIENTE.includes(t.estadoOperativo));
    setTrabajos(terminados);
  }

  function calcularNroCert() {
    const procesados = trabajos.filter((t) => t.estadoAdmin && t.estadoAdmin !== 'Sin certificar').length;
    return String(procesados + 1).padStart(3, '0') + '/' + new Date().getFullYear();
  }

  // ── Filtrado ──────────────────────────────────────────────────────────────
  function contarFiltro(key) {
    const cfg = FILTROS.find((f) => f.key === key);
    if (!cfg || cfg.estados === null) return trabajos.length;
    return trabajos.filter((t) => cfg.estados.includes(t.estadoAdmin || 'Sin certificar')).length;
  }

  const filtrados = trabajos.filter((t) => {
    const e = t.estadoAdmin || 'Sin certificar';
    const cfg = FILTROS.find((f) => f.key === filtro);
    if (cfg && cfg.estados !== null && !cfg.estados.includes(e)) return false;
    if (fechaDesde || fechaHasta) {
      const d = new Date(t.fechaCarga);
      const fechaStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (fechaDesde && fechaStr < fechaDesde) return false;
      if (fechaHasta && fechaStr > fechaHasta) return false;
    }
    if (busquedaNro.trim()) {
      const nro = (t.nroCertificado || '').toLowerCase();
      if (!nro.includes(busquedaNro.trim().toLowerCase())) return false;
    }
    if (filtroCliente && t.clienteNombre !== filtroCliente) return false;
    return true;
  });

  // ── Selección múltiple ────────────────────────────────────────────────────
  const trabajosSeleccionados = filtrados.filter((t) => seleccionados.has(t.id));

  function toggleSeleccion(id) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    if (seleccionados.size === filtrados.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(filtrados.map((t) => t.id)));
    }
  }

  function limpiarSeleccion() { setSeleccionados(new Set()); }

  async function accionMasiva(nuevoEstado, extras = {}) {
    setGuardando(true);
    try {
      await Promise.all(
        trabajosSeleccionados.map((t) => actualizarEstado(t, nuevoEstado, extras))
      );
      limpiarSeleccion();
      setModal(null);
    } finally {
      setGuardando(false);
    }
  }

  // ── Acciones ──────────────────────────────────────────────────────────────
  function abrirModal(tipo, trabajo) {
    setModal({ tipo, trabajo });
    setEmailTo('');
    setDocLink('');
    setMensaje('');
    setNotas('');
    setMotivo('');
    setErrorModal('');
  }

  async function actualizarEstado(trabajo, nuevoEstado, extras = {}) {
    const actualizado = {
      ...trabajo,
      estadoAdmin: nuevoEstado,
      fechaCertificacion: new Date().toISOString(),
      ...extras,
      sincronizado: false,
    };
    await guardarTrabajo(actualizado);
    await cargar();
  }

  async function handleEnviarRevision() {
    if (!emailTo.trim()) return setErrorModal('Ingresá el email del destinatario');
    setGuardando(true);
    try {
      const url = buildMailto(emailTo.trim(), modal.trabajo, mensaje, docLink);
      window.location.href = url;
      await actualizarEstado(modal.trabajo, 'En revisión', {
        emailRevision: emailTo.trim(),
        docRevision: docLink.trim(),
      });
      setModal(null);
    } finally {
      setGuardando(false);
    }
  }

  async function handleCertificar() {
    setGuardando(true);
    try {
      await actualizarEstado(modal.trabajo, 'Certificado', {
        documentacionCertificacion: docLink.trim(),
        notasCertificacion: notas.trim(),
      });
      setModal(null);
    } finally {
      setGuardando(false);
    }
  }

  async function handleRechazar() {
    if (!motivo.trim()) return setErrorModal('Ingresá el motivo del rechazo');
    setGuardando(true);
    try {
      await actualizarEstado(modal.trabajo, 'Rechazado', { motivoRechazo: motivo.trim() });
      setModal(null);
    } finally {
      setGuardando(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="certificaciones-page">

      {/* ── HEADER ── */}
      <div className="page-header bg-white border-bottom px-3 px-lg-4 py-3">
        <h4 className="fw-bold mb-0">
          <i className="bi bi-patch-check me-2 text-success"></i>Certificaciones
        </h4>
        <small className="text-muted">{trabajos.length} trabajo{trabajos.length !== 1 ? 's' : ''} con estado operativo Terminado</small>
      </div>

      {/* ── FILTROS ── */}
      <div className="px-3 px-lg-4 pt-2 pb-1 bg-white border-bottom d-flex gap-2 flex-wrap">
        {FILTROS.map(({ key, label, estadoKey }) => {
          const count = contarFiltro(key);
          const cfg = estadoKey ? ESTADO_CONFIG[estadoKey] : null;
          const color = cfg?.color || 'dark';
          const active = filtro === key;
          return (
            <button
              key={key}
              className={`btn btn-sm ${active ? `btn-${color}` : `btn-outline-${color}`}`}
              onClick={() => { setFiltro(key); setExpandido(null); }}
            >
              {label}
              {count > 0 && (
                <span className={`ms-1 badge ${active ? 'bg-white text-dark' : `bg-${color} text-white`}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* ── BÚSQUEDA POR N° CERTIFICADO ── */}
      <div className="px-3 px-lg-4 py-2 bg-white border-bottom d-flex align-items-center gap-2">
        <i className="bi bi-search text-muted small flex-shrink-0"></i>
        <input
          type="text"
          className="form-control form-control-sm"
          placeholder="Buscar por N° certificado..."
          value={busquedaNro}
          onChange={(e) => { setBusquedaNro(e.target.value); setExpandido(null); }}
        />
        {busquedaNro && (
          <button className="btn btn-sm btn-outline-secondary py-0 flex-shrink-0" onClick={() => setBusquedaNro('')}>
            <i className="bi bi-x"></i>
          </button>
        )}
      </div>

      <div className="px-3 px-lg-4 py-2 bg-white border-bottom d-flex align-items-center gap-2 flex-wrap">
        <i className="bi bi-calendar-range text-muted small"></i>
        <div className="d-flex align-items-center gap-1">
          <label className="small text-muted mb-0 me-1">Desde</label>
          <div className="position-relative" style={{ width: 140 }}>
            <span className="position-absolute top-50 translate-middle-y ps-2 small text-muted pe-none" style={{ zIndex: 2 }}>
              {fechaDesde ? isoToDisplay(fechaDesde) : 'dd/mm/aaaa'}
            </span>
            <input type="date" className="form-control form-control-sm"
              style={{ color: 'transparent', caretColor: 'transparent' }}
              value={fechaDesde}
              onChange={(e) => { setFechaDesde(e.target.value); setExpandido(null); }} />
          </div>
        </div>
        <div className="d-flex align-items-center gap-1">
          <label className="small text-muted mb-0 me-1">Hasta</label>
          <div className="position-relative" style={{ width: 140 }}>
            <span className="position-absolute top-50 translate-middle-y ps-2 small text-muted pe-none" style={{ zIndex: 2 }}>
              {fechaHasta ? isoToDisplay(fechaHasta) : 'dd/mm/aaaa'}
            </span>
            <input type="date" className="form-control form-control-sm"
              style={{ color: 'transparent', caretColor: 'transparent' }}
              value={fechaHasta}
              onChange={(e) => { setFechaHasta(e.target.value); setExpandido(null); }} />
          </div>
        </div>
        {(fechaDesde || fechaHasta) && (
          <button
            className="btn btn-sm btn-outline-secondary py-0"
            onClick={() => { setFechaDesde(''); setFechaHasta(''); }}
          >
            <i className="bi bi-x me-1"></i>Limpiar fechas
          </button>
        )}
        {(fechaDesde || fechaHasta) && (
          <span className="small text-muted ms-1">{filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}</span>
        )}
        <select
          className="form-select form-select-sm"
          style={{ width: 'auto', minWidth: 150 }}
          value={filtroCliente}
          onChange={(e) => { setFiltroCliente(e.target.value); setExpandido(null); }}
        >
          <option value="">Todos los clientes</option>
          {[...new Set(trabajos.map((t) => t.clienteNombre).filter(Boolean))].sort().map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* ── BARRA SELECCIÓN MASIVA ── */}
      {filtrados.length > 0 && (
        <div className="px-3 px-lg-4 py-2 bg-white border-bottom d-flex align-items-center gap-2 flex-wrap">
          <div className="form-check mb-0">
            <input
              className="form-check-input"
              type="checkbox"
              id="chk-todos"
              checked={seleccionados.size > 0 && seleccionados.size === filtrados.length}
              ref={(el) => { if (el) el.indeterminate = seleccionados.size > 0 && seleccionados.size < filtrados.length; }}
              onChange={toggleTodos}
            />
            <label className="form-check-label small text-muted" htmlFor="chk-todos">
              {seleccionados.size === 0
                ? 'Seleccionar todos'
                : `${seleccionados.size} seleccionado${seleccionados.size !== 1 ? 's' : ''}`}
            </label>
          </div>

          {seleccionados.size > 0 && (
            <>
              <div className="vr mx-1"></div>
              <button
                className="btn btn-sm btn-warning text-dark"
                onClick={() => { setCertData({ nro: calcularNroCert(), expediente: '', contrato: '', periodo: '', inspector: '' }); setErrorModal(''); setModal({ tipo: 'revision', trabajos: trabajosSeleccionados }); }}
              >
                <i className="bi bi-printer me-1"></i>Revisión ({seleccionados.size})
              </button>
              <button
                className="btn btn-sm btn-success"
                onClick={() => { setDocLink(''); setNotas(''); setErrorModal(''); setCertData({ nro: trabajosSeleccionados[0]?.nroCertificado || calcularNroCert(), expediente: '', contrato: '', periodo: '', inspector: '' }); setModal({ tipo: 'certificar', trabajos: trabajosSeleccionados }); }}
              >
                <i className="bi bi-patch-check me-1"></i>Certificar ({seleccionados.size})
              </button>
              <button
                className="btn btn-sm btn-info text-white"
                onClick={() => { setFacData({ expediente: '', nroFactura: '' }); setErrorModal(''); setModal({ tipo: 'facturar', trabajos: trabajosSeleccionados }); }}
              >
                <i className="bi bi-receipt me-1"></i>Facturar ({seleccionados.size})
              </button>
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => setModal({ tipo: 'bulk-rechazar' })}
              >
                <i className="bi bi-x-circle me-1"></i>Rechazar ({seleccionados.size})
              </button>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setModal({ tipo: 'revertir', trabajos: trabajosSeleccionados })}
              >
                <i className="bi bi-arrow-counterclockwise me-1"></i>Revertir ({seleccionados.size})
              </button>
              <button className="btn btn-sm btn-outline-secondary ms-auto" onClick={limpiarSeleccion}>
                <i className="bi bi-x"></i>
              </button>
            </>
          )}
        </div>
      )}

      {/* ── CONTENIDO ── */}
      <div className="container-fluid px-3 px-lg-4 py-3" style={{ maxWidth: 1400 }}>
        {filtrados.length === 0 ? (
          <div className="text-center text-muted py-5">
            <i className="bi bi-inbox display-4 d-block mb-3 opacity-50"></i>
            <div className="fw-semibold">No hay trabajos en este estado</div>
          </div>
        ) : (
          <div className="row g-3">
            {filtrados.map((t) => {
              const estadoAdmin = t.estadoAdmin || 'Sin certificar';
              const cfg = ESTADO_CONFIG[estadoAdmin] || ESTADO_CONFIG['Sin certificar'];
              const sup = superficieDe(t);
              const abierto = expandido === t.id;

              const estaSeleccionado = seleccionados.has(t.id);

              return (
                <div key={t.id} className="col-12 col-md-6 col-xl-4">
                  <div
                    className={`card h-100 border-${cfg.color} border-2 ${cfg.bg} shadow-sm ${estaSeleccionado ? 'border-opacity-100' : ''}`}
                    style={{ cursor: 'pointer', outline: estaSeleccionado ? `2px solid var(--bs-${cfg.color})` : 'none', outlineOffset: 2 }}
                  >
                    {/* ── Cabecera de la tarjeta ── */}
                    <div
                      className={`card-header border-${cfg.color} d-flex justify-content-between align-items-start gap-2 py-3`}
                    >
                      {/* Checkbox */}
                      <div className="form-check mb-0 flex-shrink-0 pt-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={estaSeleccionado}
                          onChange={() => toggleSeleccion(t.id)}
                        />
                      </div>
                      {/* Info (click para expandir) */}
                      <div className="flex-grow-1 min-w-0" onClick={() => setExpandido(abierto ? null : t.id)}>
                        <div className="fw-bold">
                          <i className="bi bi-geo-alt me-1 text-primary"></i>
                          {t.calle1} y {t.calle2}
                        </div>
                        <div className="text-muted small mt-1">
                          {formatFecha(t.fechaCarga)}
                          {t.usuario ? ` · ${resolve(t.usuario)}` : ''}
                        </div>
                        <div className="mt-1 d-flex align-items-center gap-2 flex-wrap">
                          <span className={`badge bg-${cfg.color} text-${cfg.color === 'warning' ? 'dark' : 'white'}`}>
                            <i className={`bi bi-${cfg.icon} me-1`}></i>
                            {cfg.label}
                          </span>
                          <span className="badge bg-primary bg-opacity-75">{sup} m²</span>
                          {t.nroCertificado && (
                            <span className="badge bg-dark bg-opacity-75">
                              <i className="bi bi-hash me-1"></i>{t.nroCertificado}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Chevron expand */}
                      <i
                        className={`bi bi-chevron-${abierto ? 'up' : 'down'} text-muted flex-shrink-0 mt-1`}
                        onClick={() => setExpandido(abierto ? null : t.id)}
                      ></i>
                    </div>

                    {/* ── Detalle expandido ── */}
                    {abierto && (
                      <div className="card-body py-2">
                        {/* Tareas */}
                        <div className="small mb-2">
                          {(t.items || []).map((item, i) => (
                            <div key={i} className="d-flex justify-content-between py-1 border-bottom">
                              <span className="text-muted">{item.tipoTrabajo}</span>
                              <span className="fw-semibold">{item.superficie} m²</span>
                            </div>
                          ))}
                          <div className="d-flex justify-content-between pt-2 fw-bold">
                            <span>Total</span>
                            <span>{sup} m²</span>
                          </div>
                        </div>

                        {/* Observaciones */}
                        {t.observaciones && (
                          <div className="small text-muted fst-italic border-top pt-2 mb-2">
                            <i className="bi bi-chat-left-text me-1"></i>
                            "{t.observaciones}"
                          </div>
                        )}

                        {/* Info según estado */}
                        {estadoAdmin === 'En revisión' && t.emailRevision && (
                          <div className="alert alert-warning py-2 small mb-2">
                            <i className="bi bi-send me-1"></i>
                            Enviado a <strong>{t.emailRevision}</strong>
                          </div>
                        )}
                        {estadoAdmin === 'Certificado' && (
                          <div className="alert alert-success py-2 small mb-2">
                            <i className="bi bi-check-circle me-1"></i>
                            Certificado el {formatFecha(t.fechaCertificacion)}
                            {t.documentacionCertificacion && (
                              <> · <a href={t.documentacionCertificacion} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Ver doc</a></>
                            )}
                            {t.notasCertificacion && <div className="text-muted mt-1">{t.notasCertificacion}</div>}
                          </div>
                        )}
                        {estadoAdmin === 'Rechazado' && (
                          <div className="alert alert-danger py-2 small mb-2">
                            <i className="bi bi-x-circle me-1"></i>
                            <strong>Motivo:</strong> {t.motivoRechazo}
                          </div>
                        )}

                        {/* Acciones — mismo orden que el flujo: revisión → certificar → facturar */}
                        <div className="d-flex flex-column gap-2 pt-1">
                          <Link
                            to={`/detalle/${t.id}`}
                            className="btn btn-outline-secondary btn-sm w-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <i className="bi bi-eye me-1"></i>Ver detalle completo
                          </Link>

                          {/* 1. Pasar a revisión — disponible en Sin certificar o Rechazado */}
                          {(estadoAdmin === 'Sin certificar' || estadoAdmin === 'Rechazado') && (
                            <button
                              className="btn btn-warning btn-sm w-100 text-dark"
                              onClick={(e) => { e.stopPropagation(); setCertData({ nro: calcularNroCert(), expediente: '', contrato: '', periodo: '', inspector: '' }); setErrorModal(''); setModal({ tipo: 'revision', trabajos: [t] }); }}
                            >
                              <i className="bi bi-printer me-1"></i>Imprimir y pasar a revisión
                            </button>
                          )}

                          {/* 2. Certificar — disponible solo cuando En revisión */}
                          {estadoAdmin === 'En revisión' && (
                            <button
                              className="btn btn-success btn-sm w-100"
                              onClick={(e) => { e.stopPropagation(); setDocLink(''); setNotas(''); setErrorModal(''); setCertData({ nro: t.nroCertificado || calcularNroCert(), expediente: '', contrato: '', periodo: '', inspector: '' }); setModal({ tipo: 'certificar', trabajos: [t] }); }}
                            >
                              <i className="bi bi-patch-check me-1"></i>Certificar
                            </button>
                          )}

                          {/* 3. Facturar — disponible solo cuando Certificado */}
                          {estadoAdmin === 'Certificado' && (
                            <button
                              className="btn btn-info btn-sm w-100 text-white"
                              onClick={(e) => { e.stopPropagation(); setFacData({ expediente: '', nroFactura: '' }); setErrorModal(''); setModal({ tipo: 'facturar', trabajos: [t] }); }}
                            >
                              <i className="bi bi-receipt me-1"></i>Registrar facturación
                            </button>
                          )}

                          {/* Rechazar — no disponible si ya está Rechazado o Facturado */}
                          {estadoAdmin !== 'Rechazado' && estadoAdmin !== 'Facturado' && (
                            <button
                              className="btn btn-outline-danger btn-sm w-100"
                              onClick={(e) => { e.stopPropagation(); abrirModal('rechazar', t); }}
                            >
                              <i className="bi bi-x-circle me-1"></i>Rechazar
                            </button>
                          )}

                          {/* Revertir — disponible en cualquier estado salvo Sin certificar */}
                          {estadoAdmin !== 'Sin certificar' && (
                            <button
                              className="btn btn-outline-secondary btn-sm w-100"
                              onClick={(e) => { e.stopPropagation(); setModal({ tipo: 'revertir', trabajos: [t] }); }}
                            >
                              <i className="bi bi-arrow-counterclockwise me-1"></i>Revertir
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════
          MODALES
      ══════════════════════════════════════ */}
      {modal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1050 }}
          onClick={() => setModal(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-dialog-scrollable"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">

              {/* ── MODAL ENVIAR A REVISIÓN ── */}
              {modal.tipo === 'revision' && (() => {
                const trabajosRev = modal.trabajos;
                const inters = agruparPorInterseccion(trabajosRev);
                const totales = Object.fromEntries(CERT_ITEMS.map((ci) => [ci.key, 0]));
                inters.forEach((r) => CERT_ITEMS.forEach((ci) => { totales[ci.key] += r.totales[ci.key]; }));

                const confirmar = async () => {
                  setGuardando(true);
                  try {
                    await Promise.all(trabajosRev.map((t) => actualizarEstado(t, 'En revisión', { nroCertificado: certData.nro })));
                    limpiarSeleccion();
                    setModal(null);
                  } finally { setGuardando(false); }
                };

                return (
                  <>
                    <div className="modal-header bg-warning text-dark">
                      <h6 className="modal-title">
                        <i className="bi bi-printer me-2"></i>
                        Imprimir para revisión — {trabajosRev.length === 1 ? '1 trabajo' : `${trabajosRev.length} trabajos`}
                      </h6>
                      <button className="btn-close" onClick={() => setModal(null)} />
                    </div>

                    <div className="modal-body p-0" style={{ maxHeight: '80vh', overflowY: 'auto' }}>

                      {/* Datos del documento */}
                      <div className="px-3 pt-3 pb-2 border-bottom">
                        <div className="fw-semibold small mb-2 text-muted text-uppercase" style={{ letterSpacing: '.5px' }}>
                          <i className="bi bi-card-text me-1"></i>Datos del documento
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <div className="flex-grow-1">
                            <label className="form-label small fw-semibold mb-1">N° Certificado</label>
                            <input
                              className="form-control form-control-sm"
                              placeholder="Ej: 001/2025"
                              value={certData.nro}
                              onChange={(e) => setCertData((p) => ({ ...p, nro: e.target.value }))}
                            />
                          </div>
                          <div className="pt-3 mt-1">
                            <span className="badge bg-secondary bg-opacity-25 text-secondary small">autonumerado</span>
                          </div>
                        </div>
                      </div>

                      {/* Tabla de intersecciones */}
                      <div className="px-3 pt-3 pb-2 border-bottom">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="fw-semibold small text-muted text-uppercase" style={{ letterSpacing: '.5px' }}>
                            <i className="bi bi-table me-1"></i>Detalle por intersección
                          </span>
                          <div className="d-flex gap-2">
                            <button className="btn btn-sm btn-outline-success"
                              onClick={() => descargarExcelCert(trabajosRev, certData)}>
                              <i className="bi bi-file-earmark-excel me-1"></i>Excel
                            </button>
                            <button className="btn btn-sm btn-outline-dark"
                              onClick={() => imprimirPDF(trabajosRev, certData)}>
                              <i className="bi bi-printer me-1"></i>PDF
                            </button>
                          </div>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                          <table className="table table-sm table-bordered mb-0" style={{ fontSize: 11, minWidth: 500 }}>
                            <thead style={{ background: '#1a3a6e', color: '#fff' }}>
                              <tr>
                                <th style={{ color: '#fff' }}>#</th>
                                <th style={{ color: '#fff' }}>Intersección de calles</th>
                                {CERT_ITEMS.map((ci) => (
                                  <th key={ci.key} className="text-end" style={{ color: '#fff', fontSize: 10, verticalAlign: 'bottom', lineHeight: 1.3 }}>
                                    {ci.lines.map((line, i) => (
                                      <span key={i}>{i > 0 && <br />}{line}</span>
                                    ))}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {inters.map((r, i) => (
                                <tr key={i}>
                                  <td className="text-center text-muted">{i + 1}</td>
                                  <td className="fw-semibold">{r.interseccion}</td>
                                  {CERT_ITEMS.map((ci) => (
                                    <td key={ci.key} className="text-end">
                                      {r.totales[ci.key] > 0 ? r.totales[ci.key].toFixed(2) : <span className="text-muted">0,00</span>}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="fw-bold" style={{ background: '#dce6f1' }}>
                              <tr>
                                <td colSpan={2} className="text-center">TOTALES</td>
                                {CERT_ITEMS.map((ci) => (
                                  <td key={ci.key} className="text-end text-warning">{totales[ci.key].toFixed(2)}</td>
                                ))}
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>

                      {/* Aviso */}
                      <div className="px-3 py-3">
                        <div className="alert alert-warning py-2 small mb-0 d-flex gap-2">
                          <i className="bi bi-info-circle-fill flex-shrink-0 mt-1"></i>
                          <div>
                            Imprimí el documento, firmalo y envialo al cliente de manera manual.
                            Cuando confirmes, los trabajos pasan a <strong>En revisión</strong>.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="modal-footer flex-wrap gap-2">
                      <button className="btn btn-outline-secondary" onClick={() => setModal(null)}>Cancelar</button>
                      <button className="btn btn-outline-dark" onClick={() => imprimirPDF(trabajosRev, certData)}>
                        <i className="bi bi-printer me-1"></i>Solo imprimir
                      </button>
                      <button className="btn btn-warning text-dark" onClick={async () => { imprimirPDF(trabajosRev, certData); await confirmar(); }} disabled={guardando}>
                        {guardando
                          ? <span className="spinner-border spinner-border-sm"></span>
                          : <><i className="bi bi-printer me-1"></i>Imprimir y pasar a revisión</>}
                      </button>
                    </div>
                  </>
                );
              })()}

              {/* ── MODAL CERTIFICAR ── */}
              {modal.tipo === 'certificar' && (() => {
                const trabajosCert = modal.trabajos;
                const inters = agruparPorInterseccion(trabajosCert);
                const totales = Object.fromEntries(CERT_ITEMS.map((ci) => [ci.key, 0]));
                inters.forEach((r) => CERT_ITEMS.forEach((ci) => { totales[ci.key] += r.totales[ci.key]; }));

                const confirmar = async () => {
                  if (!certData.expediente.trim()) return setErrorModal('El N° de Expediente Municipal es obligatorio');
                  setGuardando(true);
                  try {
                    await Promise.all(trabajosCert.map((t) =>
                      actualizarEstado(t, 'Certificado', {
                        expedienteMunicipal: certData.expediente.trim(),
                        documentacionCertificacion: docLink.trim(),
                        notasCertificacion: notas.trim(),
                      })
                    ));
                    limpiarSeleccion();
                    setModal(null);
                  } finally { setGuardando(false); }
                };

                return (
                  <>
                    <div className="modal-header bg-success text-white">
                      <h6 className="modal-title">
                        <i className="bi bi-patch-check me-2"></i>
                        Certificar {trabajosCert.length === 1 ? 'trabajo' : `${trabajosCert.length} trabajos`}
                      </h6>
                      <button className="btn-close btn-close-white" onClick={() => setModal(null)} />
                    </div>

                    <div className="modal-body p-0" style={{ maxHeight: '80vh', overflowY: 'auto' }}>

                      {/* ── Datos del certificado ── */}
                      <div className="px-3 pt-3 pb-2 border-bottom">
                        <div className="fw-semibold small mb-2 text-muted text-uppercase" style={{ letterSpacing: '.5px' }}>
                          <i className="bi bi-card-text me-1"></i>Datos del certificado
                        </div>
                        <div className="row g-2">
                          <div className="col-6">
                            <label className="form-label small fw-semibold mb-1">N° Certificado</label>
                            <div className="d-flex align-items-center gap-1">
                              <input
                                className="form-control form-control-sm"
                                value={certData.nro}
                                onChange={(e) => setCertData((p) => ({ ...p, nro: e.target.value }))}
                              />
                              <span className="badge bg-secondary bg-opacity-25 text-secondary small text-nowrap">auto</span>
                            </div>
                          </div>
                          <div className="col-6">
                            <label className="form-label small fw-semibold mb-1">
                              N° Expediente Municipal <span className="text-danger">*</span>
                            </label>
                            <input
                              className={`form-control form-control-sm ${!certData.expediente ? 'border-danger' : ''}`}
                              placeholder="Ej: 15234/2025"
                              value={certData.expediente}
                              onChange={(e) => setCertData((p) => ({ ...p, expediente: e.target.value }))}
                              autoFocus
                            />
                          </div>
                        </div>
                        {errorModal && <div className="alert alert-danger py-2 small mt-2 mb-0">{errorModal}</div>}
                      </div>

                      {/* ── Tabla resumen por intersección ── */}
                      <div className="px-3 pt-3 pb-2 border-bottom">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="fw-semibold small text-muted text-uppercase" style={{ letterSpacing: '.5px' }}>
                            <i className="bi bi-table me-1"></i>Detalle por intersección
                          </span>
                          <div className="d-flex gap-2">
                            <button className="btn btn-sm btn-outline-success"
                              onClick={() => descargarExcelCert(trabajosCert, certData)}>
                              <i className="bi bi-file-earmark-excel me-1"></i>Excel
                            </button>
                            <button className="btn btn-sm btn-outline-primary"
                              onClick={() => imprimirPDF(trabajosCert, certData)}>
                              <i className="bi bi-printer me-1"></i>PDF
                            </button>
                          </div>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                          <table className="table table-sm table-bordered mb-0" style={{ fontSize: 11, minWidth: 500 }}>
                            <thead style={{ background: '#1a3a6e', color: '#fff' }}>
                              <tr>
                                <th style={{ color: '#fff' }}>#</th>
                                <th style={{ color: '#fff' }}>Intersección de calles</th>
                                {CERT_ITEMS.map((ci) => (
                                  <th key={ci.key} className="text-end" style={{ color: '#fff', fontSize: 10, verticalAlign: 'bottom', lineHeight: 1.3 }}>
                                    {ci.lines.map((line, i) => (
                                      <span key={i}>{i > 0 && <br />}{line}</span>
                                    ))}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {inters.map((r, i) => (
                                <tr key={i}>
                                  <td className="text-center text-muted">{i + 1}</td>
                                  <td className="fw-semibold">{r.interseccion}</td>
                                  {CERT_ITEMS.map((ci) => (
                                    <td key={ci.key} className="text-end">
                                      {r.totales[ci.key] > 0 ? r.totales[ci.key].toFixed(2) : <span className="text-muted">0,00</span>}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="fw-bold" style={{ background: '#dce6f1' }}>
                              <tr>
                                <td colSpan={2} className="text-center">TOTALES</td>
                                {CERT_ITEMS.map((ci) => (
                                  <td key={ci.key} className="text-end text-success">{totales[ci.key].toFixed(2)}</td>
                                ))}
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>

                      {/* ── Campos extra ── */}
                      <div className="px-3 py-3">
                        <div className="mb-2">
                          <label className="form-label small fw-semibold mb-1">Link documentación (opcional)</label>
                          <input type="url" className="form-control form-control-sm"
                            placeholder="https://drive.google.com/..."
                            value={docLink} onChange={(e) => setDocLink(e.target.value)} />
                        </div>
                        <div>
                          <label className="form-label small fw-semibold mb-1">Notas internas (opcional)</label>
                          <textarea className="form-control form-control-sm" rows={2}
                            placeholder="Observaciones internas..."
                            value={notas} onChange={(e) => setNotas(e.target.value)} />
                        </div>
                      </div>
                    </div>

                    <div className="modal-footer">
                      <button className="btn btn-outline-secondary" onClick={() => setModal(null)}>Cancelar</button>
                      <button className="btn btn-success" onClick={confirmar} disabled={guardando}>
                        {guardando
                          ? <span className="spinner-border spinner-border-sm"></span>
                          : <><i className="bi bi-patch-check me-1"></i>Confirmar certificación</>}
                      </button>
                    </div>
                  </>
                );
              })()}

              {/* ── MODAL RECHAZAR ── */}
              {modal.tipo === 'rechazar' && (
                <>
                  <div className="modal-header bg-danger text-white">
                    <h6 className="modal-title">
                      <i className="bi bi-x-circle me-2"></i>Rechazar trabajo
                    </h6>
                    <button className="btn-close btn-close-white" onClick={() => setModal(null)} />
                  </div>
                  <div className="modal-body">
                    <div className="fw-semibold mb-3">
                      <i className="bi bi-geo-alt me-1 text-primary"></i>
                      {modal.trabajo.calle1} y {modal.trabajo.calle2}
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Motivo del rechazo *</label>
                      <textarea
                        className="form-control"
                        rows={4}
                        placeholder="Describí el motivo del rechazo..."
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        autoFocus
                      />
                    </div>
                    {errorModal && <div className="alert alert-danger py-2 small">{errorModal}</div>}
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-outline-secondary" onClick={() => setModal(null)}>Cancelar</button>
                    <button className="btn btn-danger" onClick={handleRechazar} disabled={guardando}>
                      {guardando
                        ? <span className="spinner-border spinner-border-sm"></span>
                        : <><i className="bi bi-x-circle me-1"></i>Confirmar rechazo</>}
                    </button>
                  </div>
                </>
              )}

              {/* ── MODAL BULK CERTIFICAR ── */}

              {/* ── MODAL BULK REVISIÓN ── */}

              {/* ── MODAL BULK RECHAZAR ── */}
              {modal.tipo === 'bulk-rechazar' && (
                <>
                  <div className="modal-header bg-danger text-white">
                    <h6 className="modal-title">
                      <i className="bi bi-x-circle me-2"></i>Rechazar {trabajosSeleccionados.length} trabajos
                    </h6>
                    <button className="btn-close btn-close-white" onClick={() => setModal(null)} />
                  </div>
                  <div className="modal-body">
                    <ul className="list-unstyled small mb-3">
                      {trabajosSeleccionados.map((t) => (
                        <li key={t.id} className="py-1 border-bottom">
                          <i className="bi bi-geo-alt me-1 text-primary"></i>
                          <strong>{t.calle1} y {t.calle2}</strong>
                          <span className="text-muted ms-1">· {formatFecha(t.fechaCarga)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Motivo del rechazo *</label>
                      <textarea className="form-control" rows={3} placeholder="Describí el motivo..."
                        value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
                    </div>
                    {errorModal && <div className="alert alert-danger py-2 small">{errorModal}</div>}
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-outline-secondary" onClick={() => setModal(null)}>Cancelar</button>
                    <button className="btn btn-danger"
                      onClick={() => {
                        if (!motivo.trim()) return setErrorModal('Ingresá el motivo del rechazo');
                        accionMasiva('Rechazado', { motivoRechazo: motivo.trim() });
                      }}
                      disabled={guardando}>
                      {guardando ? <span className="spinner-border spinner-border-sm"></span>
                        : <><i className="bi bi-x-circle me-1"></i>Confirmar rechazo</>}
                    </button>
                  </div>
                </>
              )}

              {/* ── MODAL FACTURAR ── */}
              {modal.tipo === 'facturar' && (() => {
                const trabajosFac = modal.trabajos;
                const confirmar = async () => {
                  if (!facData.expediente.trim()) return setErrorModal('El N° de Expediente Municipal es obligatorio');
                  setGuardando(true);
                  try {
                    await Promise.all(trabajosFac.map((t) =>
                      actualizarEstado(t, 'Facturado', {
                        expedienteMunicipal: facData.expediente.trim(),
                        nroFactura: facData.nroFactura.trim(),
                        fechaFacturacion: new Date().toISOString(),
                      })
                    ));
                    limpiarSeleccion();
                    setModal(null);
                  } finally { setGuardando(false); }
                };
                return (
                  <>
                    <div className="modal-header bg-info text-white">
                      <h6 className="modal-title">
                        <i className="bi bi-receipt me-2"></i>
                        Registrar facturación — {trabajosFac.length === 1 ? '1 trabajo' : `${trabajosFac.length} trabajos`}
                      </h6>
                      <button className="btn-close btn-close-white" onClick={() => setModal(null)} />
                    </div>
                    <div className="modal-body">
                      <ul className="list-unstyled small mb-3">
                        {trabajosFac.map((t) => (
                          <li key={t.id} className="d-flex align-items-center gap-2 py-2 border-bottom">
                            <i className="bi bi-geo-alt text-primary"></i>
                            <span className="fw-semibold">{t.calle1} y {t.calle2}</span>
                            <span className="text-muted ms-auto text-nowrap">{formatFecha(t.fechaCarga)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mb-3">
                        <label className="form-label fw-semibold">N° Expediente Municipal <span className="text-danger">*</span></label>
                        <input
                          className="form-control"
                          placeholder="Ej: 15234/2025"
                          value={facData.expediente}
                          onChange={(e) => setFacData((p) => ({ ...p, expediente: e.target.value }))}
                          autoFocus
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-semibold">N° Factura (opcional)</label>
                        <input
                          className="form-control"
                          placeholder="Ej: 0001-00002345"
                          value={facData.nroFactura}
                          onChange={(e) => setFacData((p) => ({ ...p, nroFactura: e.target.value }))}
                        />
                      </div>
                      {errorModal && <div className="alert alert-danger py-2 small">{errorModal}</div>}
                    </div>
                    <div className="modal-footer">
                      <button className="btn btn-outline-secondary" onClick={() => setModal(null)}>Cancelar</button>
                      <button className="btn btn-info text-white" onClick={confirmar} disabled={guardando}>
                        {guardando
                          ? <span className="spinner-border spinner-border-sm"></span>
                          : <><i className="bi bi-receipt me-1"></i>Confirmar facturación</>}
                      </button>
                    </div>
                  </>
                );
              })()}

              {/* ── MODAL REVERTIR ── */}
              {modal.tipo === 'revertir' && (() => {
                const trabajosRevertir = modal.trabajos;
                const confirmar = async () => {
                  setGuardando(true);
                  try {
                    await Promise.all(trabajosRevertir.map((t) =>
                      actualizarEstado(t, 'Sin certificar', {
                        fechaCertificacion: null,
                        motivoRechazo: '',
                        documentacionCertificacion: '',
                        notasCertificacion: '',
                        emailRevision: '',
                        docRevision: '',
                        expedienteMunicipal: '',
                        nroFactura: '',
                        fechaFacturacion: null,
                      })
                    ));
                    limpiarSeleccion();
                    setModal(null);
                  } finally { setGuardando(false); }
                };
                return (
                  <>
                    <div className="modal-header">
                      <h6 className="modal-title">
                        <i className="bi bi-arrow-counterclockwise me-2"></i>
                        Revertir {trabajosRevertir.length === 1 ? 'certificación' : `${trabajosRevertir.length} certificaciones`}
                      </h6>
                      <button className="btn-close" onClick={() => setModal(null)} />
                    </div>
                    <div className="modal-body">
                      <div className="alert alert-warning d-flex gap-2 py-2 mb-3">
                        <i className="bi bi-exclamation-triangle-fill flex-shrink-0 mt-1"></i>
                        <div className="small">
                          Esto volverá {trabajosRevertir.length === 1 ? 'el trabajo' : 'los trabajos'} a estado <strong>Sin certificar</strong>, borrando la certificación, rechazo o revisión registrada.
                        </div>
                      </div>
                      <ul className="list-unstyled small mb-0">
                        {trabajosRevertir.map((t) => {
                          const cfg = ESTADO_CONFIG[t.estadoAdmin] || ESTADO_CONFIG['Sin certificar'];
                          return (
                            <li key={t.id} className="d-flex align-items-center gap-2 py-2 border-bottom">
                              <span className={`badge bg-${cfg.color} text-${cfg.color === 'warning' ? 'dark' : 'white'}`} style={{ fontSize: 10 }}>
                                {cfg.label}
                              </span>
                              <span className="fw-semibold">{t.calle1} y {t.calle2}</span>
                              <span className="text-muted ms-auto">{formatFecha(t.fechaCarga)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    <div className="modal-footer">
                      <button className="btn btn-outline-secondary" onClick={() => setModal(null)}>Cancelar</button>
                      <button className="btn btn-secondary" onClick={confirmar} disabled={guardando}>
                        {guardando
                          ? <span className="spinner-border spinner-border-sm"></span>
                          : <><i className="bi bi-arrow-counterclockwise me-1"></i>Confirmar reversión</>}
                      </button>
                    </div>
                  </>
                );
              })()}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
