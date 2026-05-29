import { useState, useEffect } from 'react';
import { obtenerTodosClientes, crearCliente, actualizarCliente, toggleCliente } from '../services/api';

const FORM_VACIO = { nombre: '', cuit: '', contacto: '', telefono: '', email: '', direccion: '' };

function formatCuit(valor) {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(null);

  const cargar = () => {
    setCargando(true);
    obtenerTodosClientes()
      .then(({ clientes: c }) => setClientes(c || []))
      .catch(() => setError('No se pudo conectar con el servidor'))
      .finally(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, []);

  function abrirNuevo() {
    setEditId(null);
    setForm(FORM_VACIO);
    setError('');
    setModalAbierto(true);
  }

  function abrirEditar(c) {
    setEditId(c._id);
    setForm({
      nombre: c.nombre,
      cuit: formatCuit(c.cuit),
      contacto: c.contacto || '',
      telefono: c.telefono || '',
      email: c.email || '',
      direccion: c.direccion || '',
    });
    setError('');
    setModalAbierto(true);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    if (name === 'cuit') {
      setForm((prev) => ({ ...prev, cuit: formatCuit(value) }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  }

  async function handleGuardar() {
    const { nombre, cuit } = form;
    if (!nombre.trim()) return setError('Ingresá la razón social');
    if (!cuit.trim()) return setError('Ingresá el CUIT');

    setError('');
    setGuardando(true);
    try {
      const datos = {
        nombre: form.nombre.trim(),
        cuit: form.cuit,
        contacto: form.contacto.trim(),
        telefono: form.telefono.trim(),
        email: form.email.trim(),
        direccion: form.direccion.trim(),
      };
      if (editId) {
        await actualizarCliente(editId, datos);
      } else {
        await crearCliente(datos);
      }
      setModalAbierto(false);
      cargar();
    } catch (err) {
      setError(err.message || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  async function handleToggle(cliente) {
    try {
      await toggleCliente(cliente._id);
      setConfirmToggle(null);
      cargar();
    } catch (err) {
      setError(err.message || 'Error al cambiar el estado');
      setConfirmToggle(null);
    }
  }

  const activos = clientes.filter((c) => c.activo).length;

  return (
    <div className="materiales-page">

      {/* ── HEADER ── */}
      <div className="page-header bg-white border-bottom px-3 px-lg-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h4 className="fw-bold mb-0">
            <i className="bi bi-person-vcard me-2 text-primary"></i>Clientes
          </h4>
          <small className="text-muted">
            {activos} activo{activos !== 1 ? 's' : ''} · {clientes.length} total
          </small>
        </div>
        <button className="btn btn-primary d-flex align-items-center gap-2" onClick={abrirNuevo}>
          <i className="bi bi-plus-lg"></i>
          <span>Nuevo cliente</span>
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
        ) : clientes.length === 0 ? (
          <div className="card text-center py-5 text-muted">
            <i className="bi bi-person-vcard display-4 mb-3 d-block"></i>
            <p className="mb-3">No hay clientes registrados</p>
            <div>
              <button className="btn btn-primary" onClick={abrirNuevo}>
                <i className="bi bi-plus-lg me-2"></i>Agregar primer cliente
              </button>
            </div>
          </div>
        ) : (
          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Razón social</th>
                    <th className="d-none d-md-table-cell">CUIT</th>
                    <th className="d-none d-sm-table-cell">Contacto</th>
                    <th className="d-none d-lg-table-cell">Teléfono</th>
                    <th className="d-none d-lg-table-cell">Email</th>
                    <th className="text-center">Estado</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c) => (
                    <tr key={c._id} className={c.activo ? '' : 'table-secondary opacity-75'}>
                      <td>
                        <span className="fw-semibold">{c.nombre}</span>
                        <div className="d-md-none text-muted small">{formatCuit(c.cuit)}</div>
                      </td>
                      <td className="d-none d-md-table-cell text-muted">{formatCuit(c.cuit)}</td>
                      <td className="d-none d-sm-table-cell">{c.contacto || <span className="text-muted">—</span>}</td>
                      <td className="d-none d-lg-table-cell text-muted">{c.telefono || '—'}</td>
                      <td className="d-none d-lg-table-cell text-muted">{c.email || '—'}</td>
                      <td className="text-center">
                        {c.activo
                          ? <span className="badge bg-success">Activo</span>
                          : <span className="badge bg-secondary">Inactivo</span>}
                      </td>
                      <td className="text-end">
                        <div className="d-flex gap-2 justify-content-end">
                          <button
                            className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                            onClick={() => abrirEditar(c)}
                          >
                            <i className="bi bi-pencil"></i>
                            <span className="d-none d-md-inline">Editar</span>
                          </button>
                          <button
                            className={`btn btn-sm d-flex align-items-center gap-1 ${c.activo ? 'btn-outline-warning' : 'btn-outline-success'}`}
                            onClick={() => setConfirmToggle(c)}
                          >
                            <i className={`bi bi-${c.activo ? 'pause-circle' : 'play-circle'}`}></i>
                            <span className="d-none d-md-inline">{c.activo ? 'Desactivar' : 'Activar'}</span>
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
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h6 className="modal-title">
                  <i className="bi bi-person-vcard me-2"></i>
                  {editId ? 'Editar cliente' : 'Nuevo cliente'}
                </h6>
                <button type="button" className="btn-close btn-close-white" onClick={() => setModalAbierto(false)} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-semibold">Razón social *</label>
                  <input type="text" className="form-control" name="nombre"
                    value={form.nombre} onChange={handleChange} placeholder="Ej: Municipalidad de Rosario" autoFocus />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">CUIT *</label>
                  <input type="text" className="form-control" name="cuit"
                    value={form.cuit} onChange={handleChange} placeholder="XX-XXXXXXXX-X"
                    inputMode="numeric" />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Contacto</label>
                  <input type="text" className="form-control" name="contacto"
                    value={form.contacto} onChange={handleChange} placeholder="Nombre de la persona de contacto" />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Teléfono</label>
                  <input type="tel" className="form-control" name="telefono"
                    value={form.telefono} onChange={handleChange} placeholder="Ej: 341-4123456" />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Email</label>
                  <input type="email" className="form-control" name="email"
                    value={form.email} onChange={handleChange} placeholder="contacto@empresa.com" />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Dirección</label>
                  <input type="text" className="form-control" name="direccion"
                    value={form.direccion} onChange={handleChange} placeholder="Ej: Av. Córdoba 1234, Rosario" />
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
                    : <><i className="bi bi-check-lg me-1"></i>{editId ? 'Guardar cambios' : 'Agregar cliente'}</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMAR TOGGLE ── */}
      {confirmToggle && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="modal-body text-center py-4">
                <i className={`bi bi-${confirmToggle.activo ? 'pause-circle-fill text-warning' : 'play-circle-fill text-success'} display-5 mb-3 d-block`}></i>
                <p className="mb-1 fw-semibold">
                  {confirmToggle.activo ? '¿Desactivar cliente?' : '¿Activar cliente?'}
                </p>
                <p className="text-muted small">
                  "{confirmToggle.nombre}" quedará {confirmToggle.activo ? 'inactivo y no aparecerá en nuevos trabajos' : 'activo nuevamente'}.
                </p>
              </div>
              <div className="modal-footer justify-content-center gap-2">
                <button className="btn btn-outline-secondary" onClick={() => setConfirmToggle(null)}>
                  Cancelar
                </button>
                <button
                  className={`btn ${confirmToggle.activo ? 'btn-warning' : 'btn-success'}`}
                  onClick={() => handleToggle(confirmToggle)}
                >
                  <i className={`bi bi-${confirmToggle.activo ? 'pause-circle' : 'play-circle'} me-1`}></i>
                  {confirmToggle.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
