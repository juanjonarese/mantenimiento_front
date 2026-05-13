import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { obtenerUsuarios, eliminarUsuario, actualizarUsuario, crearUsuario } from "../services/api";

const UsuariosPage = () => {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      const response = await obtenerUsuarios();
      setUsuarios(response.usuarios || []);
    } catch (error) {
      console.error("Error al cargar usuarios:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar los usuarios",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCerrarSesion = () => {
    Swal.fire({
      title: "¿Cerrar sesión?",
      text: "¿Estás seguro que querés salir?",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#28a745",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Sí, salir",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.clear();
        navigate("/login");
      }
    });
  };

  const handleEliminar = async (id, nombre, apellido) => {
    const result = await Swal.fire({
      title: "¿Eliminar usuario?",
      html: `¿Estás seguro que querés eliminar a <strong>${nombre} ${apellido}</strong>?<br><small class="text-muted">Esta acción no se puede deshacer</small>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      try {
        await eliminarUsuario(id);
        Swal.fire({
          icon: "success",
          title: "Usuario eliminado",
          text: "El usuario fue eliminado correctamente",
          timer: 2000,
          showConfirmButton: false,
        });
        cargarUsuarios();
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.message || "No se pudo eliminar el usuario",
        });
      }
    }
  };

  const handleEditar = async (usuario) => {
    const { value: formValues } = await Swal.fire({
      title: "Editar Usuario",
      html: `
        <div class="mb-3 text-start">
          <label for="swal-nombre" class="form-label">Nombre</label>
          <input id="swal-nombre" class="form-control" value="${usuario.nombre}" required>
        </div>
        <div class="mb-3 text-start">
          <label for="swal-apellido" class="form-label">Apellido</label>
          <input id="swal-apellido" class="form-control" value="${usuario.apellido}" required>
        </div>
        <div class="mb-3 text-start">
          <label for="swal-email" class="form-label">Email</label>
          <input id="swal-email" type="email" class="form-control" value="${usuario.email}" required>
        </div>
        <div class="mb-3 text-start">
          <label for="swal-password" class="form-label">Nueva Contraseña (opcional)</label>
          <input id="swal-password" type="password" class="form-control" placeholder="Dejar vacío para no cambiar">
          <small class="text-muted">Debe comenzar con MAYÚSCULA, contener letras y números (mínimo 6 caracteres)</small>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonColor: "#28a745",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Guardar cambios",
      cancelButtonText: "Cancelar",
      width: '90%',
      preConfirm: () => {
        const nombre = document.getElementById("swal-nombre").value;
        const apellido = document.getElementById("swal-apellido").value;
        const email = document.getElementById("swal-email").value;
        const password = document.getElementById("swal-password").value;

        if (!nombre || !apellido || !email) {
          Swal.showValidationMessage("Por favor completá todos los campos obligatorios");
          return false;
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          Swal.showValidationMessage("Email inválido");
          return false;
        }

        // Si se ingresó contraseña, validar formato
        if (password) {
          const passwordRegex = /^[A-Z](?=.*[a-z])(?=.*\d)[A-Za-z\d]{5,}$/;
          if (!passwordRegex.test(password)) {
            Swal.showValidationMessage("La contraseña debe comenzar con MAYÚSCULA, contener letras y números (mínimo 6 caracteres)");
            return false;
          }
        }

        return { nombre, apellido, email, password };
      },
    });

    if (formValues) {
      try {
        const updateData = {
          nombre: formValues.nombre,
          apellido: formValues.apellido,
          email: formValues.email,
        };

        // Solo incluir password si se ingresó uno nuevo
        if (formValues.password) {
          updateData.password = formValues.password;
        }

        await actualizarUsuario(usuario._id, updateData);

        Swal.fire({
          icon: "success",
          title: "Usuario actualizado",
          text: "Los cambios se guardaron correctamente",
          timer: 2000,
          showConfirmButton: false,
        });

        cargarUsuarios();
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.message || "No se pudo actualizar el usuario",
        });
      }
    }
  };

  const handleCrearUsuario = async () => {
    const { value: formValues } = await Swal.fire({
      title: "Crear Nuevo Usuario",
      html: `
        <div class="mb-3 text-start">
          <label for="swal-nombre" class="form-label">Nombre</label>
          <input id="swal-nombre" class="form-control" placeholder="Juan" required>
        </div>
        <div class="mb-3 text-start">
          <label for="swal-apellido" class="form-label">Apellido</label>
          <input id="swal-apellido" class="form-control" placeholder="Pérez" required>
        </div>
        <div class="mb-3 text-start">
          <label for="swal-email" class="form-label">Email</label>
          <input id="swal-email" type="email" class="form-control" placeholder="correo@ejemplo.com" required>
        </div>
        <div class="mb-3 text-start">
          <label for="swal-password" class="form-label">Contraseña</label>
          <input id="swal-password" type="password" class="form-control" placeholder="Ej: Admin123" required>
          <small class="text-muted">Debe comenzar con MAYÚSCULA, contener letras y números (mínimo 6 caracteres)</small>
        </div>
        <div class="mb-3 text-start">
          <label for="swal-password-confirm" class="form-label">Confirmar Contraseña</label>
          <input id="swal-password-confirm" type="password" class="form-control" placeholder="Repetí la contraseña" required>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonColor: "#28a745",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Crear Usuario",
      cancelButtonText: "Cancelar",
      width: '90%',
      preConfirm: () => {
        const nombre = document.getElementById("swal-nombre").value;
        const apellido = document.getElementById("swal-apellido").value;
        const email = document.getElementById("swal-email").value;
        const password = document.getElementById("swal-password").value;
        const passwordConfirm = document.getElementById("swal-password-confirm").value;

        if (!nombre || !apellido || !email || !password || !passwordConfirm) {
          Swal.showValidationMessage("Por favor completá todos los campos");
          return false;
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          Swal.showValidationMessage("Email inválido");
          return false;
        }

        // Validar formato de contraseña
        const passwordRegex = /^[A-Z](?=.*[a-z])(?=.*\d)[A-Za-z\d]{5,}$/;
        if (!passwordRegex.test(password)) {
          Swal.showValidationMessage("La contraseña debe comenzar con MAYÚSCULA, contener letras y números (mínimo 6 caracteres)");
          return false;
        }

        // Validar que las contraseñas coincidan
        if (password !== passwordConfirm) {
          Swal.showValidationMessage("Las contraseñas no coinciden");
          return false;
        }

        return { nombre, apellido, email, password };
      },
    });

    if (formValues) {
      try {
        await crearUsuario({
          nombre: formValues.nombre,
          apellido: formValues.apellido,
          email: formValues.email,
          password: formValues.password,
        });

        Swal.fire({
          icon: "success",
          title: "Usuario creado",
          text: "El usuario fue creado correctamente",
          timer: 2000,
          showConfirmButton: false,
        });

        cargarUsuarios();
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.message || "No se pudo crear el usuario",
        });
      }
    }
  };

  return (
    <div className="vh-100 d-flex flex-column" style={{ backgroundColor: "#f8f9fa" }}>
      {/* Navbar Responsive */}
      <nav className="navbar navbar-dark bg-success shadow-sm">
        <div className="container-fluid">
          <span className="navbar-brand mb-0 h1 d-flex align-items-center">
            <i className="bi bi-people-fill me-2"></i>
            <span className="d-none d-sm-inline">Sistema de Usuarios</span>
            <span className="d-inline d-sm-none">Usuarios</span>
          </span>
          <button
            className="btn btn-outline-light btn-sm"
            onClick={handleCerrarSesion}
          >
            <i className="bi bi-box-arrow-right me-1"></i>
            <span className="d-none d-sm-inline">Cerrar Sesión</span>
            <span className="d-inline d-sm-none">Salir</span>
          </button>
        </div>
      </nav>

      {/* Contenido Principal */}
      <div className="flex-grow-1 overflow-auto">
        <div className="container-fluid py-3 px-2 px-md-3">
          <div className="card shadow-sm">
            {/* Header con botón responsive */}
            <div className="card-header bg-white py-3">
              <div className="row g-2 align-items-center">
                <div className="col-12 col-md-8">
                  <h5 className="mb-0 fw-bold text-success">
                    <i className="bi bi-list-ul me-2"></i>
                    <span className="d-none d-sm-inline">Lista de Usuarios Registrados</span>
                    <span className="d-inline d-sm-none">Usuarios</span>
                  </h5>
                </div>
                <div className="col-12 col-md-4 text-md-end">
                  <button
                    className="btn btn-success w-100 w-md-auto"
                    onClick={handleCrearUsuario}
                  >
                    <i className="bi bi-person-plus-fill me-2"></i>
                    Nuevo Usuario
                  </button>
                </div>
              </div>
            </div>

            <div className="card-body p-2 p-md-3">
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-success" role="status">
                    <span className="visually-hidden">Cargando...</span>
                  </div>
                  <p className="mt-3 text-muted">Cargando usuarios...</p>
                </div>
              ) : usuarios.length === 0 ? (
                <div className="text-center py-5">
                  <i className="bi bi-inbox" style={{ fontSize: "3rem", color: "#ccc" }}></i>
                  <p className="mt-3 text-muted">No hay usuarios registrados</p>
                  <button
                    className="btn btn-success mt-2"
                    onClick={handleCrearUsuario}
                  >
                    Crear primer usuario
                  </button>
                </div>
              ) : (
                <>
                  {/* Vista tabla para pantallas medianas/grandes */}
                  <div className="table-responsive d-none d-md-block">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Nombre</th>
                          <th>Apellido</th>
                          <th>Email</th>
                          <th className="text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usuarios.map((usuario) => (
                          <tr key={usuario._id}>
                            <td className="fw-semibold">{usuario.nombre}</td>
                            <td>{usuario.apellido}</td>
                            <td>
                              <i className="bi bi-envelope me-2 text-muted"></i>
                              {usuario.email}
                            </td>
                            <td className="text-center">
                              <button
                                className="btn btn-sm btn-outline-primary me-2"
                                onClick={() => handleEditar(usuario)}
                                title="Editar usuario"
                              >
                                <i className="bi bi-pencil-fill"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleEliminar(usuario._id, usuario.nombre, usuario.apellido)}
                                title="Eliminar usuario"
                              >
                                <i className="bi bi-trash-fill"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Vista cards para móviles */}
                  <div className="d-md-none">
                    {usuarios.map((usuario) => (
                      <div key={usuario._id} className="card mb-3 shadow-sm">
                        <div className="card-body">
                          <h6 className="card-title text-success fw-bold mb-2">
                            {usuario.nombre} {usuario.apellido}
                          </h6>
                          <p className="card-text mb-3 small">
                            <i className="bi bi-envelope me-2"></i>
                            <span className="text-break">{usuario.email}</span>
                          </p>
                          <div className="d-flex gap-2">
                            <button
                              className="btn btn-sm btn-outline-primary flex-fill"
                              onClick={() => handleEditar(usuario)}
                            >
                              <i className="bi bi-pencil-fill me-1"></i>
                              Editar
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger flex-fill"
                              onClick={() => handleEliminar(usuario._id, usuario.nombre, usuario.apellido)}
                            >
                              <i className="bi bi-trash-fill me-1"></i>
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Footer con contador */}
            <div className="card-footer bg-white text-muted text-center py-2">
              <small>
                Total: <strong>{usuarios.length}</strong> {usuarios.length === 1 ? 'usuario' : 'usuarios'}
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsuariosPage;
