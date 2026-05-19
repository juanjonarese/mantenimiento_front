import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { obtenerTurnoActivo } from "../services/api";

function formatHora(fecha) {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function formatFecha(fecha) {
  if (!fecha) return "";
  return new Date(fecha).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

function calcularHoras(fechaInicio) {
  if (!fechaInicio) return "—";
  const diff = (Date.now() - new Date(fechaInicio)) / 3600000;
  return diff.toFixed(1);
}

export default function TurnoPage() {
  const navigate = useNavigate();
  const [turno, setTurno] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const nombre = localStorage.getItem("nombre") || "";

  useEffect(() => {
    const turnoId = localStorage.getItem("turnoId");
    const esDev = import.meta.env.DEV;

    if (!turnoId && !esDev) {
      navigate("/login");
      return;
    }

    if (esDev && !turnoId) {
      setTurno({ _id: "dev-turno", fechaInicio: new Date().toISOString() });
      setCargando(false);
      return;
    }

    obtenerTurnoActivo()
      .then(({ turno: t }) => {
        if (!t) {
          localStorage.removeItem("turnoId");
          navigate("/login");
        } else {
          setTurno(t);
        }
      })
      .catch(() => {
        setError("Sin conexión — mostrando datos guardados");
        const id = localStorage.getItem("turnoId");
        if (id) setTurno({ _id: id, fechaInicio: null });
        else navigate("/login");
      })
      .finally(() => setCargando(false));
  }, []);

  if (cargando) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: "60vh" }}>
        <div className="spinner-border text-success"></div>
      </div>
    );
  }

  return (
    <div className="container-fluid p-3 pb-5">
      {error && (
        <div className="alert alert-warning py-2 small mb-3">
          <i className="bi bi-wifi-off me-2"></i>{error}
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <h5 className="fw-bold mb-1">
          <i className="bi bi-clock-history me-2 text-success"></i>
          Turno activo
        </h5>
        {nombre && <div className="text-muted small">Supervisor: {nombre}</div>}
      </div>

      {/* Tarjeta info turno */}
      <div className="card border-success mb-4">
        <div className="card-body">
          <div className="row g-3 text-center">
            <div className="col-6 border-end">
              <div className="text-muted small mb-1">Inicio</div>
              <div className="fw-bold fs-5">{formatHora(turno?.fechaInicio)}</div>
              <div className="text-muted small">{formatFecha(turno?.fechaInicio)}</div>
            </div>
            <div className="col-6">
              <div className="text-muted small mb-1">Tiempo activo</div>
              <div className="fw-bold fs-5 text-success">{calcularHoras(turno?.fechaInicio)} hs</div>
              <div className="text-muted small">en curso</div>
            </div>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="d-flex flex-column gap-3">
        <button
          className="btn btn-primary btn-lg w-100 py-3"
          onClick={() => navigate("/nuevo")}
        >
          <i className="bi bi-plus-circle me-2 fs-5"></i>
          Nuevo trabajo
        </button>

        <button
          className="btn btn-outline-secondary btn-lg w-100 py-3"
          onClick={() => navigate("/lista")}
        >
          <i className="bi bi-list-ul me-2 fs-5"></i>
          Ver trabajos registrados
        </button>

        <div className="mt-2">
          <button
            className="btn btn-outline-danger btn-lg w-100 py-3"
            onClick={() => navigate("/cerrar-turno")}
          >
            <i className="bi bi-door-closed me-2 fs-5"></i>
            Cerrar turno
          </button>
        </div>
      </div>
    </div>
  );
}
