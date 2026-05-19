import { useState, useEffect } from "react";
import { obtenerTiposTarea, crearTipoTarea, actualizarTipoTarea, toggleTipoTarea } from "../services/api";

const UNIDADES = ["m²", "metros", "unidades", "ml", "kg"];
const MODAL_VACIO = { nombre: "", unidad: "m²" };

export default function TiposTareaPage() {
  const [tipos, setTipos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState(MODAL_VACIO);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mostrarTodos, setMostrarTodos] = useState(false);

  const cargar = () => {
    setCargando(true);
    obtenerTiposTarea(mostrarTodos)
      .then(({ tipos: t }) => setTipos(t || []))
      .catch(() => setError("Error al cargar tipos de tarea"))
      .finally(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, [mostrarTodos]);

  function abrirNuevo() {
    setEditId(null);
    setForm(MODAL_VACIO);
    setError("");
    setModalAbierto(true);
  }

  function abrirEditar(tipo) {
    setEditId(tipo._id);
    setForm({ nombre: tipo.nombre, unidad: tipo.unidad });
    setError("");
    setModalAbierto(true);
  }

  async function handleGuardar() {
    if (!form.nombre.trim()) return setError("El nombre es obligatorio");
    setGuardando(true);
    setError("");
    try {
      if (editId) {
        await actualizarTipoTarea(editId, form);
      } else {
        await crearTipoTarea(form);
      }
      setModalAbierto(false);
      cargar();
    } catch (err) {
      setError(err.message || "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function handleToggle(tipo) {
    try {
      await toggleTipoTarea(tipo._id);
      cargar();
    } catch {
      setError("Error al cambiar el estado");
    }
  }

  return (
    <div className="tipos-tarea-page">

      {/* HEADER */}
      <div className="page-header bg-white border-bottom px-3 px-lg-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h4 className="fw-bold mb-0">
            <i className="bi bi-tags me-2 text-primary"></i>Tipos de tarea
          </h4>
          <small className="text-muted">
            {tipos.length} tipo{tipos.length !== 1 ? "s" : ""} registrado{tipos.length !== 1 ? "s" : ""}
          </small>
        </div>
        <div className="d-flex gap-2 align-items-center">
          <div className="form-check form-switch mb-0">
            <input
              className="form-check-input"
              type="checkbox"
              id="mostrarTodos"
              checked={mostrarTodos}
              onChange={(e) => setMostrarTodos(e.target.checked)}
            />
            <label className="form-check-label small text-muted" htmlFor="mostrarTodos">
              Ver desactivados
            </label>
          </div>
          <button className="btn btn-primary d-flex align-items-center gap-2" onClick={abrirNuevo}>
            <i className="bi bi-plus-lg"></i>
            <span>Nuevo tipo</span>
          </button>
        </div>
      </div>

      {/* CONTENIDO */}
      <div className="container py-3" style={{ maxWidth: 1400 }}>
        {error && !modalAbierto && (
          <div className="alert alert-danger">{error}</div>
        )}

        {cargando ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-primary"></div>
          </div>
        ) : tipos.length === 0 ? (
          <div className="card text-center py-5 text-muted">
            <i className="bi bi-tags display-4 mb-3 d-block"></i>
            <p className="mb-3">No hay tipos de tarea registrados</p>
            <div>
              <button className="btn btn-primary" onClick={abrirNuevo}>
                <i className="bi bi-plus-lg me-2"></i>Agregar primer tipo
              </button>
            </div>
          </div>
        ) : (
          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Nombre</th>
                    <th className="d-none d-sm-table-cell">Unidad</th>
                    <th className="text-center">Estado</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tipos.map((tipo) => (
                    <tr key={tipo._id} className={!tipo.activo ? "opacity-50" : ""}>
                      <td>
                        <span className="fw-semibold">{tipo.nombre}</span>
                        <span className="d-sm-none ms-2 text-muted small">{tipo.unidad}</span>
                      </td>
                      <td className="d-none d-sm-table-cell text-muted">{tipo.unidad}</td>
                      <td className="text-center">
                        <span className={`badge ${tipo.activo ? "bg-success" : "bg-secondary"}`}>
                          {tipo.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="text-end">
                        <div className="d-flex gap-2 justify-content-end">
                          <button
                            className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                            onClick={() => abrirEditar(tipo)}
                          >
                            <i className="bi bi-pencil"></i>
                            <span className="d-none d-md-inline">Editar</span>
                          </button>
                          <button
                            className={`btn btn-sm d-flex align-items-center gap-1 ${
                              tipo.activo ? "btn-outline-warning" : "btn-outline-success"
                            }`}
                            onClick={() => handleToggle(tipo)}
                          >
                            <i className={`bi bi-${tipo.activo ? "pause-circle" : "play-circle"}`}></i>
                            <span className="d-none d-md-inline">
                              {tipo.activo ? "Desactivar" : "Activar"}
                            </span>
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

      {/* MODAL */}
      {modalAbierto && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h6 className="modal-title">
                  <i className="bi bi-tags me-2"></i>
                  {editId ? "Editar tipo de tarea" : "Nuevo tipo de tarea"}
                </h6>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setModalAbierto(false)}
                />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-semibold">Nombre *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.nombre}
                    onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                    placeholder="Ej: Senda peatonal"
                    autoFocus
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Unidad de medida *</label>
                  <select
                    className="form-select"
                    value={form.unidad}
                    onChange={(e) => setForm((p) => ({ ...p, unidad: e.target.value }))}
                  >
                    {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                {error && (
                  <div className="alert alert-danger py-2 small">{error}</div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setModalAbierto(false)}
                  disabled={guardando}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleGuardar}
                  disabled={guardando}
                >
                  {guardando
                    ? <><span className="spinner-border spinner-border-sm me-2"></span>Guardando...</>
                    : <><i className="bi bi-check-lg me-1"></i>{editId ? "Guardar cambios" : "Agregar"}</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
