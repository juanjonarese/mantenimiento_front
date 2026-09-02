import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { crearUsuario } from "../services/api";
import "../css/Login.css";
import Footer from "../components/Footer";

const RegistroPage = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    email: "",
    password: "",
    confirmarPassword: "",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const validarFormulario = () => {
    // Validar que todos los campos estén completos
    if (!formData.nombre.trim() || !formData.apellido.trim() || !formData.email.trim() || !formData.password || !formData.confirmarPassword) {
      Swal.fire({
        icon: "error",
        title: "Campos incompletos",
        text: "Por favor, completá todos los campos",
      });
      return false;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      Swal.fire({
        icon: "error",
        title: "Email inválido",
        text: "Por favor, ingresá un email válido",
      });
      return false;
    }

    // Validar formato de contraseña: alfanumérica, comienza con mayúscula, mínimo 6 caracteres
    const passwordRegex = /^[A-Z](?=.*[a-z])(?=.*\d)[A-Za-z\d]{5,}$/;
    if (!passwordRegex.test(formData.password)) {
      Swal.fire({
        icon: "error",
        title: "Contraseña inválida",
        html: `
          <p>La contraseña debe cumplir con los siguientes requisitos:</p>
          <ul style="text-align: left; margin: 0 auto; display: inline-block;">
            <li>Comenzar con MAYÚSCULA</li>
            <li>Contener al menos una letra minúscula</li>
            <li>Contener al menos un número</li>
            <li>Tener mínimo 6 caracteres alfanuméricos</li>
          </ul>
          <p style="margin-top: 10px;"><strong>Ejemplo:</strong> Admin123</p>
        `,
      });
      return false;
    }

    // Validar que las contraseñas coincidan
    if (formData.password !== formData.confirmarPassword) {
      Swal.fire({
        icon: "error",
        title: "Contraseñas no coinciden",
        text: "Las contraseñas ingresadas no coinciden",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validarFormulario()) {
      return;
    }

    setLoading(true);

    try {
      const { nombre, apellido, email, password } = formData;

      await crearUsuario({
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        email: email.trim(),
        password,
      });

      // Mostrar mensaje de éxito
      await Swal.fire({
        icon: "success",
        title: "¡Registro exitoso!",
        text: "Tu cuenta ha sido creada. Ahora podés iniciar sesión.",
        confirmButtonText: "Ir al login",
      });

      // Redirigir al login
      navigate("/login");
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al registrarse",
        text: error.message || "Ocurrió un error al crear tu cuenta. Intentá nuevamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper d-flex flex-column" style={{ minHeight: '100vh' }}>
      <div className="container flex-grow-1">
        <div className="row justify-content-center align-items-center min-vh-100">
          <div className="col-12 col-md-8 col-lg-6">
            <div className="card login-card shadow-lg">
              <div className="card-body p-4">
                {/* Logo/Header */}
                <div className="text-center mb-4">
                  <h2 className="fw-bold text-success mb-2">
                    <i className="bi bi-person-plus-fill me-2"></i>
                    Sistema de Usuarios
                  </h2>
                  <h5 className="text-muted">Crear nueva cuenta</h5>
                </div>

                {/* Formulario */}
                <form onSubmit={handleSubmit}>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label
                        htmlFor="nombre"
                        className="form-label text-muted small fw-semibold"
                      >
                        NOMBRE
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        id="nombre"
                        name="nombre"
                        placeholder="Juan"
                        value={formData.nombre}
                        onChange={handleChange}
                        disabled={loading}
                        required
                      />
                    </div>

                    <div className="col-md-6 mb-3">
                      <label
                        htmlFor="apellido"
                        className="form-label text-muted small fw-semibold"
                      >
                        APELLIDO
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        id="apellido"
                        name="apellido"
                        placeholder="Pérez"
                        value={formData.apellido}
                        onChange={handleChange}
                        disabled={loading}
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label
                      htmlFor="email"
                      className="form-label text-muted small fw-semibold"
                    >
                      EMAIL
                    </label>
                    <input
                      type="email"
                      className="form-control"
                      id="email"
                      name="email"
                      placeholder="correo@ejemplo.com"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={loading}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label
                      htmlFor="password"
                      className="form-label text-muted small fw-semibold"
                    >
                      CONTRASEÑA
                    </label>
                    <input
                      type="password"
                      className="form-control"
                      id="password"
                      name="password"
                      placeholder="Debe comenzar con mayúscula (ej: Admin123)"
                      value={formData.password}
                      onChange={handleChange}
                      disabled={loading}
                      required
                    />
                    <small className="text-muted">
                      Debe comenzar con MAYÚSCULA, contener letras y números (mínimo 6 caracteres)
                    </small>
                  </div>

                  <div className="mb-3">
                    <label
                      htmlFor="confirmarPassword"
                      className="form-label text-muted small fw-semibold"
                    >
                      CONFIRMAR CONTRASEÑA
                    </label>
                    <input
                      type="password"
                      className="form-control"
                      id="confirmarPassword"
                      name="confirmarPassword"
                      placeholder="Repetí tu contraseña"
                      value={formData.confirmarPassword}
                      onChange={handleChange}
                      disabled={loading}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-success w-100 mt-3"
                    disabled={loading}
                    style={{ fontWeight: '600', letterSpacing: '1px' }}
                  >
                    {loading ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        Registrando...
                      </>
                    ) : (
                      "REGISTRARSE"
                    )}
                  </button>
                </form>

                {/* Link al login */}
                <div className="text-center mt-4">
                  <small className="text-muted">
                    ¿Ya tenés cuenta?{" "}
                    <a
                      href="/login"
                      className="text-decoration-none fw-semibold"
                      style={{ color: '#28a745' }}
                    >
                      Iniciá sesión
                    </a>
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default RegistroPage;
