import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { obtenerUsuarios, eliminarUsuario, actualizarUsuario, crearUsuario } from "../services/api";

const PASSWORD_REGEX = /^[A-Z](?=.*[a-z])(?=.*\d)[A-Za-z\d]{5,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function agregarValidacionConfirmacion() {
  const p1 = document.getElementById("swal-password");
  const p2 = document.getElementById("swal-password2");
  const msg = document.getElementById("swal-match");
  if (!p1 || !p2 || !msg) return;

  const verificar = () => {
    if (!p2.value) {
      msg.innerHTML = "";
      p2.classList.remove("is-valid", "is-invalid");
      return;
    }
    if (p1.value === p2.value) {
      msg.innerHTML = '<span class="text-success"><i class="bi bi-check-circle me-1"></i>Las contraseñas coinciden</span>';
      p2.classList.add("is-valid");
      p2.classList.remove("is-invalid");
    } else {
      msg.innerHTML = '<span class="text-danger"><i class="bi bi-x-circle me-1"></i>Las contraseñas no coinciden</span>';
      p2.classList.add("is-invalid");
      p2.classList.remove("is-valid");
    }
  };

  p1.addEventListener("input", verificar);
  p2.addEventListener("input", verificar);
}

const UsuariosPage = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { cargarUsuarios(); }, []);

  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      const response = await obtenerUsuarios();
      setUsuarios(response.usuarios || []);
    } catch {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudieron cargar los usuarios" });
    } finally {
      setLoading(false);
    }
  };

  const handleEliminar = async (id, nombre, apellido) => {
    const result = await Swal.fire({
      title: "¿Eliminar usuario?",
      html: `¿Eliminás a <strong>${nombre} ${apellido}</strong>?<br><small class="text-muted">Esta acción no se puede deshacer</small>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;
    try {
      await eliminarUsuario(id);
      Swal.fire({ icon: "success", title: "Eliminado", timer: 1500, showConfirmButton: false });
      cargarUsuarios();
    } catch (error) {
      Swal.fire({ icon: "error", title: "Error", text: error.message });
    }
  };

  const handleEditar = async (usuario) => {
    const { value } = await Swal.fire({
      title: "Editar usuario",
      html: `
        <div class="mb-3 text-start">
          <label class="form-label fw-semibold">Nombre *</label>
          <input id="swal-nombre" class="form-control" value="${usuario.nombre}">
        </div>
        <div class="mb-3 text-start">
          <label class="form-label fw-semibold">Apellido *</label>
          <input id="swal-apellido" class="form-control" value="${usuario.apellido}">
        </div>
        <div class="mb-3 text-start">
          <label class="form-label fw-semibold">Email *</label>
          <input id="swal-email" type="email" class="form-control" value="${usuario.email}">
        </div>
        <div class="mb-3 text-start">
          <label class="form-label fw-semibold">Rol *</label>
          <select id="swal-rol" class="form-select">
            <option value="supervisor" ${usuario.rol === 'supervisor' || usuario.rol === 'usuario' ? 'selected' : ''}>Supervisor</option>
            <option value="admin" ${usuario.rol === 'admin' ? 'selected' : ''}>Administrador</option>
            <option value="cliente" ${usuario.rol === 'cliente' ? 'selected' : ''}>Cliente</option>
          </select>
        </div>
        <div class="mb-3 text-start" id="swal-cliente-wrap" style="display:${usuario.rol === 'cliente' ? 'block' : 'none'}">
          <label class="form-label fw-semibold">Nombre del cliente *</label>
          <input id="swal-clienteNombre" class="form-control" value="${usuario.clienteNombre || ''}" placeholder="Nombre exacto del cliente">
          <small class="text-muted">Debe coincidir exactamente con el nombre en la sección Clientes.</small>
        </div>
        <hr>
        <div class="mb-3 text-start">
          <label class="form-label fw-semibold">Nueva contraseña <small class="text-muted fw-normal">(opcional)</small></label>
          <input id="swal-password" type="password" class="form-control" placeholder="Dejar vacío para no cambiar">
          <small class="text-muted">Mayúscula + letras + números, mínimo 6 caracteres</small>
        </div>
        <div class="mb-3 text-start">
          <label class="form-label fw-semibold">Confirmar contraseña</label>
          <input id="swal-password2" type="password" class="form-control" placeholder="Repetí la contraseña">
          <div id="swal-match" class="small mt-1"></div>
        </div>
      `,
      didOpen: () => {
        agregarValidacionConfirmacion();
        document.getElementById('swal-rol')?.addEventListener('change', (e) => {
          const wrap = document.getElementById('swal-cliente-wrap');
          if (wrap) wrap.style.display = e.target.value === 'cliente' ? 'block' : 'none';
        });
      },
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonColor: "#0d6efd",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Guardar cambios",
      cancelButtonText: "Cancelar",
      width: "420px",
      preConfirm: () => {
        const nombre = document.getElementById("swal-nombre").value.trim();
        const apellido = document.getElementById("swal-apellido").value.trim();
        const email = document.getElementById("swal-email").value.trim();
        const rol = document.getElementById("swal-rol").value;
        const clienteNombre = document.getElementById("swal-clienteNombre")?.value.trim() || '';
        const password = document.getElementById("swal-password").value;
        const password2 = document.getElementById("swal-password2").value;

        if (!nombre || !apellido || !email) return Swal.showValidationMessage("Completá los campos obligatorios") && false;
        if (!EMAIL_REGEX.test(email)) return Swal.showValidationMessage("Email inválido") && false;
        if (rol === 'cliente' && !clienteNombre) return Swal.showValidationMessage("Ingresá el nombre del cliente") && false;
        if (password) {
          if (!PASSWORD_REGEX.test(password)) return Swal.showValidationMessage("Contraseña inválida: mayúscula + letras + números, mínimo 6 caracteres") && false;
          if (password !== password2) return Swal.showValidationMessage("Las contraseñas no coinciden") && false;
        }
        return { nombre, apellido, email, rol, clienteNombre, password };
      },
    });

    if (!value) return;
    try {
      const datos = { nombre: value.nombre, apellido: value.apellido, email: value.email, rol: value.rol, clienteNombre: value.clienteNombre || '' };
      if (value.password) datos.password = value.password;
      await actualizarUsuario(usuario._id, datos);
      Swal.fire({ icon: "success", title: "Actualizado", timer: 1500, showConfirmButton: false });
      cargarUsuarios();
    } catch (error) {
      Swal.fire({ icon: "error", title: "Error", text: error.message });
    }
  };

  const handleCrear = async () => {
    const { value } = await Swal.fire({
      title: "Nuevo usuario",
      html: `
        <div class="mb-3 text-start">
          <label class="form-label fw-semibold">Nombre *</label>
          <input id="swal-nombre" class="form-control" placeholder="Juan">
        </div>
        <div class="mb-3 text-start">
          <label class="form-label fw-semibold">Apellido *</label>
          <input id="swal-apellido" class="form-control" placeholder="Pérez">
        </div>
        <div class="mb-3 text-start">
          <label class="form-label fw-semibold">Email *</label>
          <input id="swal-email" type="email" class="form-control" placeholder="correo@ejemplo.com">
        </div>
        <div class="mb-3 text-start">
          <label class="form-label fw-semibold">Rol *</label>
          <select id="swal-rol" class="form-select">
            <option value="supervisor">Supervisor</option>
            <option value="admin">Administrador</option>
            <option value="cliente">Cliente</option>
          </select>
        </div>
        <div class="mb-3 text-start" id="swal-cliente-wrap" style="display:none">
          <label class="form-label fw-semibold">Nombre del cliente *</label>
          <input id="swal-clienteNombre" class="form-control" placeholder="Nombre exacto del cliente">
          <small class="text-muted">Debe coincidir exactamente con el nombre en la sección Clientes.</small>
        </div>
        <div class="mb-3 text-start">
          <label class="form-label fw-semibold">Contraseña *</label>
          <input id="swal-password" type="password" class="form-control" placeholder="Ej: Admin123">
          <small class="text-muted">Mayúscula + letras + números, mínimo 6 caracteres</small>
        </div>
        <div class="mb-3 text-start">
          <label class="form-label fw-semibold">Confirmar contraseña *</label>
          <input id="swal-password2" type="password" class="form-control" placeholder="Repetí la contraseña">
          <div id="swal-match" class="small mt-1"></div>
        </div>
      `,
      didOpen: () => {
        agregarValidacionConfirmacion();
        document.getElementById('swal-rol')?.addEventListener('change', (e) => {
          const wrap = document.getElementById('swal-cliente-wrap');
          if (wrap) wrap.style.display = e.target.value === 'cliente' ? 'block' : 'none';
        });
      },
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonColor: "#198754",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Crear usuario",
      cancelButtonText: "Cancelar",
      width: "420px",
      preConfirm: () => {
        const nombre = document.getElementById("swal-nombre").value.trim();
        const apellido = document.getElementById("swal-apellido").value.trim();
        const email = document.getElementById("swal-email").value.trim();
        const rol = document.getElementById("swal-rol").value;
        const clienteNombre = document.getElementById("swal-clienteNombre")?.value.trim() || '';
        const password = document.getElementById("swal-password").value;
        const password2 = document.getElementById("swal-password2").value;

        if (!nombre || !apellido || !email || !password || !password2) return Swal.showValidationMessage("Completá todos los campos") && false;
        if (!EMAIL_REGEX.test(email)) return Swal.showValidationMessage("Email inválido") && false;
        if (rol === 'cliente' && !clienteNombre) return Swal.showValidationMessage("Ingresá el nombre del cliente") && false;
        if (!PASSWORD_REGEX.test(password)) return Swal.showValidationMessage("Contraseña inválida: mayúscula + letras + números, mínimo 6 caracteres") && false;
        if (password !== password2) return Swal.showValidationMessage("Las contraseñas no coinciden") && false;
        return { nombre, apellido, email, rol, clienteNombre, password };
      },
    });

    if (!value) return;
    try {
      await crearUsuario({ nombre: value.nombre, apellido: value.apellido, email: value.email, rol: value.rol, clienteNombre: value.clienteNombre || '', password: value.password });
      Swal.fire({ icon: "success", title: "Usuario creado", timer: 1500, showConfirmButton: false });
      cargarUsuarios();
    } catch (error) {
      Swal.fire({ icon: "error", title: "Error", text: error.message });
    }
  };

  const badgeRol = (rol) => {
    if (rol === 'admin') return <span className="badge bg-primary">Admin</span>;
    if (rol === 'cliente') return <span className="badge bg-success">Cliente</span>;
    return <span className="badge bg-secondary">Supervisor</span>;
  };

  return (
    <div className="lista-page">

      {/* ── HEADER ── */}
      <div className="page-header bg-white border-bottom px-3 px-lg-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h4 className="fw-bold mb-0">
            <i className="bi bi-people me-2 text-primary"></i>Usuarios
          </h4>
          <small className="text-muted">
            {usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''} registrado{usuarios.length !== 1 ? 's' : ''}
          </small>
        </div>
        <button className="btn btn-primary d-flex align-items-center gap-2" onClick={handleCrear}>
          <i className="bi bi-person-plus"></i>
          <span>Nuevo usuario</span>
        </button>
      </div>

      <div className="container py-3" style={{ maxWidth: 1400 }}>
        <div className="card shadow-sm">
        <div className="card-body p-2 p-md-3">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary"></div>
              <p className="mt-3 text-muted small">Cargando...</p>
            </div>
          ) : usuarios.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-inbox fs-1 d-block mb-2"></i>
              No hay usuarios registrados
            </div>
          ) : (
            <>
              {/* Tabla — pantallas medianas+ */}
              <div className="table-responsive d-none d-md-block">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Nombre</th>
                      <th>Email</th>
                      <th>Rol</th>
                      <th>Cliente</th>
                      <th className="text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((u) => (
                      <tr key={u._id}>
                        <td className="fw-semibold">{u.nombre} {u.apellido}</td>
                        <td className="text-muted small">{u.email}</td>
                        <td>{badgeRol(u.rol)}</td>
                        <td className="small text-muted">{u.clienteNombre || '—'}</td>
                        <td className="text-center">
                          <button className="btn btn-sm me-1" style={{ backgroundColor: '#ffc107', color: '#000' }}
                            onClick={() => handleEditar(u)}>
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button className="btn btn-sm btn-danger"
                            onClick={() => handleEliminar(u._id, u.nombre, u.apellido)}>
                            <i className="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards — móvil */}
              <div className="d-md-none">
                {usuarios.map((u) => (
                  <div key={u._id} className="card mb-2">
                    <div className="card-body py-2">
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <span className="fw-semibold">{u.nombre} {u.apellido}</span>
                        {badgeRol(u.rol)}
                      </div>
                      <div className="text-muted small mb-2">{u.email}</div>
                      <div className="d-flex gap-2">
                        <button className="btn btn-sm flex-fill fw-semibold"
                          style={{ backgroundColor: '#ffc107', color: '#000' }}
                          onClick={() => handleEditar(u)}>
                          <i className="bi bi-pencil me-1"></i>Editar
                        </button>
                        <button className="btn btn-sm btn-danger flex-fill"
                          onClick={() => handleEliminar(u._id, u.nombre, u.apellido)}>
                          <i className="bi bi-trash me-1"></i>Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

          <div className="card-footer bg-white text-muted text-center py-2 small">
            Total: <strong>{usuarios.length}</strong> {usuarios.length === 1 ? "usuario" : "usuarios"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsuariosPage;
