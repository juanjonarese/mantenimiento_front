import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { loginUsuario, obtenerTurnoActivo, abrirTurno } from "../services/api";
import "../css/Login.css";
import Footer from "../components/Footer";

const LoginScreen = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Limpiar localStorage al montar el componente para evitar problemas con credenciales viejas
  useEffect(() => {
    localStorage.clear();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    // Limpiar error cuando el usuario empieza a escribir
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await loginUsuario(formData.email.trim(), formData.password);

      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("token", data.token);
      localStorage.setItem("email", formData.email.trim());
      localStorage.setItem("rol", data.rol || "supervisor");
      localStorage.setItem("nombre", data.nombre || "");

      if (data.rol === "supervisor") {
        try {
          const { turno } = await obtenerTurnoActivo();
          if (turno) {
            localStorage.setItem("turnoId", turno._id);
            navigate("/cerrar-turno?pendiente=1");
          } else {
            const { turno: nuevoTurno } = await abrirTurno();
            localStorage.setItem("turnoId", nuevoTurno._id);
            navigate("/turno");
          }
        } catch {
          navigate("/turno");
        }
        return;
      }

      navigate("/");
    } catch (err) {
      if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        setError("No se puede conectar con el servidor. Verifique su conexión a Internet.");
      } else {
        setError(err.message || "Usuario o contraseña incorrectos");
      }
      console.error("Error en login:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="login-wrapper d-flex flex-column"
      style={{ minHeight: "100vh" }}
    >
      <div className="container flex-grow-1 px-3">
        <div className="row justify-content-center align-items-center min-vh-100">
          <div className="col-12 col-sm-10 col-md-8 col-lg-5 col-xl-4">
            <div className="card login-card shadow-lg">
              <div className="card-body p-4">
                {/* Logo/Header */}
                <div className="text-center mb-4">
                  <h2 className="fw-bold text-success mb-2 fs-3 fs-md-2">
                    <i className="bi bi-person-circle me-2"></i>
                    <span className="d-none d-sm-inline">Sistema de Usuarios</span>
                    <span className="d-inline d-sm-none">Usuarios</span>
                  </h2>
                  <p className="text-muted small">Iniciá sesión para continuar</p>
                </div>

                {/* Mensaje de error */}
                {error && (
                  <div
                    className="alert alert-danger alert-dismissible fade show"
                    role="alert"
                  >
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    {error}
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setError("")}
                    ></button>
                  </div>
                )}

                {/* Formulario */}
                <form onSubmit={handleSubmit}>
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
                      placeholder="Contraseña"
                      value={formData.password}
                      onChange={handleChange}
                      disabled={loading}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-success w-100 mt-3"
                    disabled={loading}
                    style={{ fontWeight: "600", letterSpacing: "1px" }}
                  >
                    {loading ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        Ingresando...
                      </>
                    ) : (
                      "INGRESAR"
                    )}
                  </button>
                </form>

                {/* Ayuda/Info */}
                <div className="text-center mt-4">
                  <small className="text-muted">
                    ¿No tenés cuenta? Comunicate con el administrador
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

export default LoginScreen;
