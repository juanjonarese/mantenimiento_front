import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  obtenerTodosMaterialesCatalogo,
  crearMaterialCatalogo,
  actualizarMaterialCatalogo,
  eliminarMaterialCatalogo,
  obtenerTotalesEntradas,
  registrarEntradaStock,
  obtenerHistorialEntradas,
  obtenerConsumoMaterialesTrabajos,
  obtenerTiposTarea,
} from '../services/api';

const UNIDADES = ['litros', 'kg', 'unidades', 'm²', 'bolsas', 'tambores'];
const NOMBRES_SUGERIDOS = [
  'Pintura blanca', 'Pintura amarilla', 'Microesferas',
  'Diluyente', 'Termoplástico', 'Otros',
];
const MODAL_VACIO = { codigo: '', nombre: '', stock: '', unidad: 'litros', tamano: '', tiposTarea: [] };
const HOY = new Date().toISOString().split('T')[0];

function fmtNum(n) {
  if (!n) return '0';
  const val = parseFloat(parseFloat(n).toFixed(2));
  return val.toString();
}

function DisponibleBadge({ value }) {
  const cls = value <= 0 ? 'bg-danger' : value < 10 ? 'bg-warning text-dark' : 'bg-success';
  return <span className={`badge ${cls} px-3 py-2`} style={{ fontSize: 14 }}>{fmtNum(value)}</span>;
}

export default function MaterialesPage() {
  const [materiales, setMateriales]       = useState([]);
  const [totalesMap, setTotalesMap]       = useState({});
  const [consumoMap, setConsumoMap]       = useState({});
  const [tiposTareaOpts, setTiposTareaOpts] = useState([]);
  const [cargando, setCargando]           = useState(true);
  const [error, setError]                 = useState('');

  // Modal crear/editar (existente sin cambios)
  const [modalAbierto, setModalAbierto]       = useState(false);
  const [form, setForm]                       = useState(MODAL_VACIO);
  const [editId, setEditId]                   = useState(null);
  const [guardando, setGuardando]             = useState(false);
  const [confirmEliminar, setConfirmEliminar] = useState(null);

  // Modal cargar stock
  const [modalCargaAbierto, setModalCargaAbierto] = useState(false);
  const [materialCarga, setMaterialCarga]           = useState(null);
  const [formCarga, setFormCarga]                   = useState({ cantidad: '', fecha: HOY, descripcion: '' });
  const [guardandoCarga, setGuardandoCarga]         = useState(false);
  const [errorCarga, setErrorCarga]                 = useState('');

  // Modal historial
  const [historialAbierto, setHistorialAbierto]   = useState(false);
  const [historialMaterial, setHistorialMaterial] = useState(null);
  const [historialEntradas, setHistorialEntradas] = useState([]);
  const [historialCargando, setHistorialCargando] = useState(false);

  const cargar = () => {
    setCargando(true);
    Promise.all([
      obtenerTodosMaterialesCatalogo(),
      obtenerTotalesEntradas().catch(() => ({ totales: [] })),
      obtenerConsumoMaterialesTrabajos().catch(() => ({ consumo: [] })),
      obtenerTiposTarea().catch(() => ({ tipos: [] })),
    ])
      .then(([{ materiales: m }, { totales }, { consumo }, { tipos }]) => {
        setMateriales(m || []);
        const entMap = {};
        (totales || []).forEach(({ _id, total }) => { entMap[String(_id)] = total || 0; });
        setTotalesMap(entMap);
        const consMap = {};
        (consumo || []).forEach(({ nombre, cantidad }) => {
          const k = nombre.toLowerCase().trim();
          consMap[k] = (consMap[k] || 0) + (cantidad || 0);
        });
        setConsumoMap(consMap);
        setTiposTareaOpts((tipos || []).filter((t) => t.activo !== false));
      })
      .catch(() => setError('No se pudo conectar con el servidor'))
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    async function migrarSiNecesario() {
      try {
        const [{ materiales: backendMats }, localMats] = await Promise.all([
          obtenerTodosMaterialesCatalogo(),
          obtenerMaterialesLocales(),
        ]);
        if (backendMats.length === 0 && localMats.length > 0) {
          await Promise.all(
            localMats.map((m) =>
              crearMaterialCatalogo({
                codigo: m.codigo || '',
                nombre: m.nombre,
                stock: m.stock,
                unidad: m.unidad,
              }).catch(() => {})
            )
          );
        }
      } catch { /* si falla, igual carga normalmente */ }
      cargar();
    }
    migrarSiNecesario();
  }, []);

  function getCargado(mat)    { return totalesMap[String(mat._id)] || 0; }
  function getConsumido(mat)  { return consumoMap[mat.nombre.toLowerCase().trim()] || 0; }
  function getDisponible(mat) { return getCargado(mat) - getConsumido(mat); }

  // ── Modal crear/editar ──
  function abrirNuevo() {
    setEditId(null);
    setForm(MODAL_VACIO);
    setError('');
    setModalAbierto(true);
  }

  function abrirEditar(mat) {
    setEditId(mat._id);
    setForm({
      codigo:     mat.codigo || '',
      nombre:     mat.nombre,
      stock:      String(mat.stock),
      unidad:     mat.unidad,
      tamano:     mat.tamano || '',
      tiposTarea: mat.tiposTarea || [],
    });
    setError('');
    setModalAbierto(true);
  }

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleTipoTareaChange(tipo) {
    setForm((prev) => {
      const ya = prev.tiposTarea.includes(tipo);
      return {
        ...prev,
        tiposTarea: ya ? prev.tiposTarea.filter((t) => t !== tipo) : [...prev.tiposTarea, tipo],
      };
    });
  }

  async function handleGuardar() {
    if (!form.nombre.trim()) return setError('Ingresá el nombre del material');
    if (form.stock === '' || isNaN(Number(form.stock))) return setError('Ingresá un stock válido');
    setError('');
    setGuardando(true);
    try {
      const datos = {
        codigo:     form.codigo.trim(),
        nombre:     form.nombre.trim(),
        stock:      parseFloat(form.stock),
        unidad:     form.unidad,
        tamano:     form.tamano.trim(),
        tiposTarea: form.tiposTarea,
      };
      if (editId) {
        await actualizarMaterialCatalogo(editId, datos);
      } else {
        await crearMaterialCatalogo(datos);
      }
      setModalAbierto(false);
      cargar();
    } catch (err) {
      setError(err.message || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar(id) {
    try {
      await eliminarMaterialCatalogo(id);
      setConfirmEliminar(null);
      cargar();
    } catch (err) {
      setError(err.message || 'Error al eliminar');
      setConfirmEliminar(null);
    }
  }

  // ── Modal cargar stock ──
  function abrirModalCarga(mat) {
    setMaterialCarga(mat);
    setFormCarga({ cantidad: '', fecha: HOY, descripcion: '' });
    setErrorCarga('');
    setModalCargaAbierto(true);
  }

  async function handleGuardarCarga() {
    const cant = Number(formCarga.cantidad);
    if (!formCarga.cantidad || isNaN(cant) || cant === 0) {
      return setErrorCarga('Ingresá una cantidad distinta de 0');
    }
    setGuardandoCarga(true);
    try {
      await registrarEntradaStock(materialCarga._id, {
        cantidad:    cant,
        fecha:       formCarga.fecha,
        descripcion: formCarga.descripcion.trim(),
      });
      setModalCargaAbierto(false);
      cargar();
    } catch (err) {
      setErrorCarga(err.message || 'Error al registrar carga');
    } finally {
      setGuardandoCarga(false);
    }
  }

  // ── Modal historial ──
  async function abrirHistorial(mat) {
    setHistorialMaterial(mat);
    setHistorialEntradas([]);
    setHistorialCargando(true);
    setHistorialAbierto(true);
    try {
      const { entradas } = await obtenerHistorialEntradas(mat._id);
      setHistorialEntradas(entradas || []);
    } catch {
      setHistorialEntradas([]);
    } finally {
      setHistorialCargando(false);
    }
  }

  function exportarExcel() {
    const filas = materiales.map((mat) => ({
      'Código':     mat.codigo || '',
      'Material':   mat.nombre,
      'Unidad':     mat.unidad,
      'Tamaño':     mat.tamano || '',
      'Cargado':    getCargado(mat),
      'Consumido':  getConsumido(mat),
      'Disponible': getDisponible(mat),
    }));
    const ws = XLSX.utils.json_to_sheet(filas);
    ws['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Materiales');
    XLSX.writeFile(wb, `materiales_${HOY}.xlsx`);
  }

  function exportarPDF() {
    const filas = materiales.map((mat) => {
      const disp = getDisponible(mat);
      const colorDisp = disp < 0 ? '#dc3545' : disp < 10 ? '#856404' : '#198754';
      return `<tr>
        <td>${mat.codigo || '—'}</td>
        <td><strong>${mat.nombre}</strong></td>
        <td>${mat.unidad}</td>
        <td style="text-align:right;color:#198754">${fmtNum(getCargado(mat))}</td>
        <td style="text-align:right;color:#dc3545">${fmtNum(getConsumido(mat))}</td>
        <td style="text-align:right;font-weight:bold;color:${colorDisp}">${fmtNum(disp)}</td>
      </tr>`;
    }).join('');

    const ventana = window.open('', '_blank');
    ventana.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Materiales — Stock</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:12px;margin:24px}
        h2{margin:0 0 4px}p{margin:0 0 12px;color:#666;font-size:11px}
        table{border-collapse:collapse;width:100%}
        th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}
        th{background:#f0f0f0;font-weight:bold}
        @media print{body{margin:12px}}
      </style></head><body>
      <h2>Stock de Materiales</h2>
      <p>Generado: ${new Date().toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' })}</p>
      <table><thead><tr>
        <th>Código</th><th>Material</th><th>Unidad</th>
        <th style="text-align:right">Cargado</th>
        <th style="text-align:right">Consumido</th>
        <th style="text-align:right">Disponible</th>
      </tr></thead><tbody>${filas}</tbody></table>
    </body></html>`);
    ventana.document.close();
    ventana.focus();
    ventana.print();
  }

  return (
    <div className="materiales-page">

      {/* ── HEADER ── */}
      <div className="page-header bg-white border-bottom px-3 px-lg-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h4 className="fw-bold mb-0">
            <i className="bi bi-box-seam me-2 text-primary"></i>Materiales
          </h4>
          <small className="text-muted">
            {materiales.length} material{materiales.length !== 1 ? 'es' : ''} registrado{materiales.length !== 1 ? 's' : ''}
          </small>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-outline-success d-flex align-items-center gap-1" onClick={exportarExcel} disabled={materiales.length === 0} title="Exportar a Excel">
            <i className="bi bi-file-earmark-excel"></i>
            <span className="d-none d-sm-inline">Excel</span>
          </button>
          <button className="btn btn-outline-danger d-flex align-items-center gap-1" onClick={exportarPDF} disabled={materiales.length === 0} title="Exportar a PDF">
            <i className="bi bi-file-earmark-pdf"></i>
            <span className="d-none d-sm-inline">PDF</span>
          </button>
          <button className="btn btn-primary d-flex align-items-center gap-2" onClick={abrirNuevo}>
            <i className="bi bi-plus-lg"></i>
            <span>Nuevo material</span>
          </button>
        </div>
      </div>

      {/* ── CONTENIDO ── */}
      <div className="container py-3" style={{ maxWidth: 1400 }}>

        {error && !modalAbierto && (
          <div className="alert alert-danger">{error}</div>
        )}

        {cargando ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-primary"></div>
          </div>
        ) : materiales.length === 0 ? (
          <div className="card text-center py-5 text-muted">
            <i className="bi bi-box display-4 mb-3 d-block"></i>
            <p className="mb-3">No hay materiales registrados</p>
            <div>
              <button className="btn btn-primary" onClick={abrirNuevo}>
                <i className="bi bi-plus-lg me-2"></i>Agregar primer material
              </button>
            </div>
          </div>
        ) : (
          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="d-none d-sm-table-cell">Código</th>
                    <th>Material</th>
                    <th className="d-none d-md-table-cell">Unidad</th>
                    <th className="text-center d-none d-sm-table-cell">
                      <span className="text-success">Cargado</span>
                    </th>
                    <th className="text-center d-none d-sm-table-cell">
                      <span className="text-danger">Consumido</span>
                    </th>
                    <th className="text-center">Disponible</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {materiales.map((mat) => {
                    const cargado    = getCargado(mat);
                    const consumido  = getConsumido(mat);
                    const disponible = getDisponible(mat);
                    return (
                      <tr key={mat._id}>
                        <td className="d-none d-sm-table-cell">
                          {mat.codigo
                            ? <span className="badge bg-secondary fw-normal">{mat.codigo}</span>
                            : <span className="text-muted small">—</span>}
                        </td>
                        <td>
                          <span className="fw-semibold">{mat.nombre}</span>
                          {mat.codigo && <span className="d-sm-none ms-2 badge bg-secondary fw-normal">{mat.codigo}</span>}
                          <span className="d-md-none ms-2 text-muted small">{mat.unidad}</span>
                        </td>
                        <td className="d-none d-md-table-cell text-muted">{mat.unidad}</td>
                        <td className="text-center d-none d-sm-table-cell">
                          <span className="fw-semibold text-success">{fmtNum(cargado)}</span>
                        </td>
                        <td className="text-center d-none d-sm-table-cell">
                          <span className="fw-semibold text-danger">{fmtNum(consumido)}</span>
                        </td>
                        <td className="text-center">
                          <DisponibleBadge value={disponible} />
                        </td>
                        <td className="text-end">
                          <div className="d-flex gap-1 justify-content-end flex-wrap">
                            <button
                              className="btn btn-sm btn-success d-flex align-items-center gap-1"
                              onClick={() => abrirModalCarga(mat)}
                              title="Cargar stock"
                            >
                              <i className="bi bi-plus-circle"></i>
                              <span className="d-none d-lg-inline">Cargar</span>
                            </button>
                            <button
                              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                              onClick={() => abrirHistorial(mat)}
                              title="Ver historial de cargas"
                            >
                              <i className="bi bi-clock-history"></i>
                              <span className="d-none d-lg-inline">Historial</span>
                            </button>
                            <button
                              className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                              onClick={() => abrirEditar(mat)}
                              title="Editar material"
                            >
                              <i className="bi bi-pencil"></i>
                              <span className="d-none d-lg-inline">Editar</span>
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
                              onClick={() => setConfirmEliminar(mat)}
                              title="Eliminar material"
                            >
                              <i className="bi bi-trash"></i>
                              <span className="d-none d-lg-inline">Eliminar</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL CREAR / EDITAR ── */}
      {modalAbierto && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h6 className="modal-title">
                  <i className="bi bi-box-seam me-2"></i>
                  {editId ? 'Editar material' : 'Nuevo material'}
                </h6>
                <button type="button" className="btn-close btn-close-white" onClick={() => setModalAbierto(false)} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-semibold">Código</label>
                  <input type="text" className="form-control" name="codigo"
                    value={form.codigo} onChange={handleChange} placeholder="Ej: MAT-001" autoFocus />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Nombre *</label>
                  <input type="text" className="form-control" name="nombre"
                    value={form.nombre} onChange={handleChange} placeholder="Ej: Pintura blanca"
                    list="sugerencias-nombres" />
                  <datalist id="sugerencias-nombres">
                    {NOMBRES_SUGERIDOS.map((n) => <option key={n} value={n} />)}
                  </datalist>
                </div>
                <div className="row g-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Stock *</label>
                    <input type="number" className="form-control" name="stock"
                      value={form.stock} onChange={handleChange} min="0" step="any" placeholder="0" />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Unidad *</label>
                    <select className="form-select" name="unidad" value={form.unidad} onChange={handleChange}>
                      {UNIDADES.map((u) => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="form-label fw-semibold">Tamaño por unidad</label>
                  <input type="text" className="form-control" name="tamano"
                    value={form.tamano} onChange={handleChange} placeholder="Ej: 25 kg, 20 litros, 5 kg" />
                  <div className="form-text">Contenido o peso de cada unidad en stock.</div>
                </div>
                <div className="mt-3 border-top pt-3">
                  <label className="form-label fw-semibold small">
                    <i className="bi bi-link-45deg me-1"></i>Tipos de tarea asociados
                  </label>
                  {tiposTareaOpts.length === 0 ? (
                    <p className="text-muted small mb-0">No hay tipos de tarea registrados.</p>
                  ) : (
                    <div className="d-flex flex-wrap gap-2">
                      {tiposTareaOpts.map((tipo) => (
                        <div key={tipo._id} className="form-check form-check-inline m-0">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`tipo-${tipo._id}`}
                            checked={form.tiposTarea.includes(tipo.nombre)}
                            onChange={() => handleTipoTareaChange(tipo.nombre)}
                          />
                          <label className="form-check-label small" htmlFor={`tipo-${tipo._id}`}>
                            {tipo.nombre}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-muted small mt-1">
                    Permite calcular el rendimiento (kg o lts por m²) en el Panel
                  </div>
                </div>
                {error && <div className="alert alert-danger py-2 small mt-3">{error}</div>}
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setModalAbierto(false)} disabled={guardando}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={handleGuardar} disabled={guardando}>
                  {guardando
                    ? <span className="spinner-border spinner-border-sm"></span>
                    : <><i className="bi bi-check-lg me-1"></i>{editId ? 'Guardar cambios' : 'Agregar material'}</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CARGAR STOCK ── */}
      {modalCargaAbierto && materialCarga && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h6 className="modal-title">
                  <i className="bi bi-plus-circle me-2"></i>
                  Cargar stock — {materialCarga.nombre}
                </h6>
                <button type="button" className="btn-close btn-close-white" onClick={() => setModalCargaAbierto(false)} />
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Cantidad *</label>
                    <div className="input-group">
                      <input
                        type="number"
                        className="form-control"
                        value={formCarga.cantidad}
                        onChange={(e) => setFormCarga((p) => ({ ...p, cantidad: e.target.value }))}
                        step="any"
                        placeholder="Ej: -50 para corregir"
                        autoFocus
                      />
                      <span className="input-group-text">{materialCarga.unidad}</span>
                    </div>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Fecha de recepción</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formCarga.fecha}
                      onChange={(e) => setFormCarga((p) => ({ ...p, fecha: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="form-label fw-semibold">Descripción</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formCarga.descripcion}
                    onChange={(e) => setFormCarga((p) => ({ ...p, descripcion: e.target.value }))}
                    placeholder="Ej: Compra proveedor ABC, Remito 1234..."
                  />
                </div>
                {errorCarga && <div className="alert alert-danger py-2 small mt-3">{errorCarga}</div>}
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setModalCargaAbierto(false)} disabled={guardandoCarga}>
                  Cancelar
                </button>
                <button className="btn btn-success" onClick={handleGuardarCarga} disabled={guardandoCarga}>
                  {guardandoCarga
                    ? <span className="spinner-border spinner-border-sm"></span>
                    : <><i className="bi bi-check-lg me-1"></i>Registrar carga</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL HISTORIAL ── */}
      {historialAbierto && historialMaterial && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h6 className="modal-title">
                  <i className="bi bi-clock-history me-2"></i>
                  Historial de cargas — {historialMaterial.nombre}
                </h6>
                <button type="button" className="btn-close" onClick={() => setHistorialAbierto(false)} />
              </div>
              <div className="modal-body p-0">
                {historialCargando ? (
                  <div className="d-flex justify-content-center py-4">
                    <div className="spinner-border text-primary spinner-border-sm"></div>
                  </div>
                ) : historialEntradas.length === 0 ? (
                  <div className="text-center text-muted py-4">
                    <i className="bi bi-inbox display-5 d-block mb-2"></i>
                    No hay cargas registradas para este material
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Fecha</th>
                          <th className="text-end">Cantidad</th>
                          <th>Descripción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historialEntradas.map((e) => (
                          <tr key={e._id}>
                            <td className="text-muted small">
                              {new Date(e.fecha).toLocaleDateString('es-AR', {
                                day: '2-digit', month: '2-digit', year: 'numeric',
                              })}
                            </td>
                            <td className={`text-end fw-semibold ${e.cantidad >= 0 ? 'text-success' : 'text-danger'}`}>
                              {e.cantidad >= 0 ? '+' : ''}{fmtNum(e.cantidad)} {historialMaterial.unidad}
                            </td>
                            <td className="text-muted small">{e.descripcion || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="table-light">
                        <tr>
                          <td className="fw-semibold">Total cargado</td>
                          <td className="text-end fw-bold text-success">
                            {fmtNum(historialEntradas.reduce((s, e) => s + e.cantidad, 0))} {historialMaterial.unidad}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setHistorialAbierto(false)}>
                  Cerrar
                </button>
                <button
                  className="btn btn-success"
                  onClick={() => { setHistorialAbierto(false); abrirModalCarga(historialMaterial); }}
                >
                  <i className="bi bi-plus-circle me-1"></i>Nueva carga
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMAR ELIMINACIÓN ── */}
      {confirmEliminar && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1070 }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="modal-body text-center py-4">
                <i className="bi bi-exclamation-triangle-fill text-danger display-5 mb-3 d-block"></i>
                <p className="mb-1 fw-semibold">¿Eliminar material?</p>
                <p className="text-muted small">"{confirmEliminar.nombre}" será eliminado.</p>
              </div>
              <div className="modal-footer justify-content-center gap-2">
                <button className="btn btn-outline-secondary" onClick={() => setConfirmEliminar(null)}>
                  Cancelar
                </button>
                <button className="btn btn-danger" onClick={() => handleEliminar(confirmEliminar._id)}>
                  <i className="bi bi-trash me-1"></i>Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
