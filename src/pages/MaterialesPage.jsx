import { useState, useEffect } from 'react';
import {
  obtenerTodosMaterialesCatalogo,
  crearMaterialCatalogo,
  actualizarMaterialCatalogo,
  eliminarMaterialCatalogo,
} from '../services/api';
import { obtenerMateriales as obtenerMaterialesLocales } from '../db/db';

const UNIDADES = ['litros', 'kg', 'unidades', 'm²', 'bolsas', 'tambores'];
const NOMBRES_SUGERIDOS = [
  'Pintura blanca', 'Pintura amarilla', 'Microesferas',
  'Diluyente', 'Termoplástico', 'Otros',
];
const MODAL_VACIO = { codigo: '', nombre: '', stock: '', unidad: 'litros' };

function StockBadge({ stock }) {
  const cls = stock <= 0 ? 'bg-danger' : stock < 10 ? 'bg-warning text-dark' : 'bg-success';
  return <span className={`badge ${cls} px-3 py-2`} style={{ fontSize: 14 }}>{stock}</span>;
}

export default function MaterialesPage() {
  const [materiales, setMateriales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState(MODAL_VACIO);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [confirmEliminar, setConfirmEliminar] = useState(null);

  const cargar = () => {
    setCargando(true);
    obtenerTodosMaterialesCatalogo()
      .then(({ materiales: m }) => setMateriales(m || []))
      .catch(() => setError('No se pudo conectar con el servidor'))
      .finally(() => setCargando(false));
  };

  // Migración única: si el backend no tiene materiales pero el IndexedDB sí, los importa
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

  function abrirNuevo() {
    setEditId(null);
    setForm(MODAL_VACIO);
    setError('');
    setModalAbierto(true);
  }

  function abrirEditar(mat) {
    setEditId(mat._id);
    setForm({ codigo: mat.codigo || '', nombre: mat.nombre, stock: String(mat.stock), unidad: mat.unidad });
    setError('');
    setModalAbierto(true);
  }

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleGuardar() {
    if (!form.nombre.trim()) return setError('Ingresá el nombre del material');
    if (form.stock === '' || isNaN(Number(form.stock))) return setError('Ingresá un stock válido');
    setError('');
    setGuardando(true);
    try {
      const datos = {
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        stock: parseFloat(form.stock),
        unidad: form.unidad,
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
        <button className="btn btn-primary d-flex align-items-center gap-2" onClick={abrirNuevo}>
          <i className="bi bi-plus-lg"></i>
          <span>Nuevo material</span>
        </button>
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
                    <th className="text-center">Stock</th>
                    <th className="d-none d-sm-table-cell">Unidad</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {materiales.map((mat) => (
                    <tr key={mat._id}>
                      <td className="d-none d-sm-table-cell">
                        {mat.codigo
                          ? <span className="badge bg-secondary fw-normal">{mat.codigo}</span>
                          : <span className="text-muted small">—</span>}
                      </td>
                      <td>
                        <span className="fw-semibold">{mat.nombre}</span>
                        {mat.codigo && <span className="d-sm-none ms-2 badge bg-secondary fw-normal">{mat.codigo}</span>}
                        <span className="d-sm-none ms-2 text-muted small">{mat.unidad}</span>
                      </td>
                      <td className="text-center">
                        <StockBadge stock={mat.stock} />
                      </td>
                      <td className="d-none d-sm-table-cell text-muted">{mat.unidad}</td>
                      <td className="text-end">
                        <div className="d-flex gap-2 justify-content-end">
                          <button
                            className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                            onClick={() => abrirEditar(mat)}
                          >
                            <i className="bi bi-pencil"></i>
                            <span className="d-none d-md-inline">Editar</span>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
                            onClick={() => setConfirmEliminar(mat)}
                          >
                            <i className="bi bi-trash"></i>
                            <span className="d-none d-md-inline">Eliminar</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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

      {/* ── MODAL CONFIRMAR ELIMINACIÓN ── */}
      {confirmEliminar && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
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
