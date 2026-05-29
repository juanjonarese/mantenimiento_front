import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { obtenerTurnoActivo } from "../services/api";
import { obtenerTrabajos, eliminarTrabajo } from "../db/db";

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

const COLORES_OP = {
  'Sin iniciar': 'secondary',
  'En proceso': 'warning',
  'Terminado': 'success',
  'Finalizado': 'success',
};

export default function TurnoPage() {
  const navigate = useNavigate();
  const [turno, setTurno] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [trabajos, setTrabajos] = useState([]);
  const nombre = localStorage.getItem("nombre") || "";

  const cargarTrabajos = useCallback(async () => {
    const turnoId = localStorage.getItem('turnoId');
    if (!turnoId) { setTrabajos([]); return; }
    const todos = await obtenerTrabajos();
    setTrabajos(todos.filter((t) => t.turnoId === turnoId));
  }, []);

  useEffect(() => {
    window.addEventListener('focus', cargarTrabajos);
    return () => window.removeEventListener('focus', cargarTrabajos);
  }, [cargarTrabajos]);

  useEffect(() => {
    const turnoId = localStorage.getItem("turnoId");
    const esDev = import.meta.env.DEV;

    if (!turnoId && !esDev) { navigate("/login"); return; }

    if (esDev && !turnoId) {
      setTurno({ _id: "dev-turno", fechaInicio: new Date().toISOString() });
      cargarTrabajos();
      setCargando(false);
      return;
    }

    obtenerTurnoActivo()
      .then(({ turno: t }) => {
        if (!t) { localStorage.removeItem("turnoId"); navigate("/login"); }
        else { setTurno(t); cargarTrabajos(); }
      })
      .catch(() => {
        setError("Sin conexión — mostrando datos guardados");
        const id = localStorage.getItem("turnoId");
        if (id) { setTurno({ _id: id, fechaInicio: null }); cargarTrabajos(); }
        else navigate("/login");
      })
      .finally(() => setCargando(false));
  }, []);


  async function handleEliminar(t) {
    const { isConfirmed } = await Swal.fire({
      title: '¿Eliminar trabajo?',
      html: `<strong>${t.calle1} y ${t.calle2}</strong>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });
    if (!isConfirmed) return;
    await eliminarTrabajo(t.id);
    cargarTrabajos();
  }

  if (cargando) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: "60vh" }}>
        <div className="spinner-border text-success"></div>
      </div>
    );
  }

  const supTotal = trabajos.reduce((s, t) =>
    s + (t.items || []).reduce((si, i) => si + (i.superficie || 0), 0), 0
  ).toFixed(2);

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
          <i className="bi bi-clock-history me-2 text-success"></i>Turno activo
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
      <div className="row g-2 mb-4">
        <div className="col-12 col-sm-6">
          <button className="btn btn-primary btn-lg w-100 py-3" onClick={() => navigate("/nuevo")}>
            <i className="bi bi-plus-circle me-2 fs-5"></i>Nuevo trabajo
          </button>
        </div>
        <div className="col-12 col-sm-6">
          <button className="btn btn-outline-danger btn-lg w-100 py-3" onClick={() => navigate("/cerrar-turno")}>
            <i className="bi bi-door-closed me-2 fs-5"></i>Cerrar turno
          </button>
        </div>
      </div>

      {/* Trabajos del turno */}
      <div className="mb-3 d-flex align-items-center justify-content-between">
        <span className="fw-semibold">
          <i className="bi bi-tools me-1 text-primary"></i>Trabajos del turno
          {trabajos.length > 0 && (
            <span className="ms-2 badge bg-primary">{trabajos.length}</span>
          )}
        </span>
        {trabajos.length > 0 && (
          <span className="text-muted small">{supTotal} m² total</span>
        )}
      </div>

      {trabajos.length === 0 ? (
        <div className="card text-center py-4 text-muted small">
          <i className="bi bi-clipboard fs-3 mb-2 d-block opacity-50"></i>
          Todavía no cargaste trabajos en este turno
        </div>
      ) : (
        <div className="row g-2">
          {trabajos.map((t) => {
            const color = COLORES_OP[t.estadoOperativo] || 'secondary';
            const getSup = (tipo) =>
              (t.items || []).find((i) => i.tipoTrabajo === tipo)?.superficie || 0;
            return (
              <div key={t.id} className="col-12 col-md-6 col-xl-4">
                <div className="card h-100 border-start border-3 border-primary shadow-sm">
                  <div className="card-body py-2 px-3">

                    {/* Intersección */}
                    <div className="fw-semibold mb-1">
                      <i className="bi bi-geo-alt me-1 text-primary"></i>
                      {t.calle1} y {t.calle2}
                    </div>

                    {/* Superficies por tipo */}
                    <div className="d-flex gap-3 flex-wrap mb-2" style={{ fontSize: 12 }}>
                      {getSup('SENDAS') > 0 && (
                        <span className="text-muted">Sendas <strong>{getSup('SENDAS').toFixed(1)}</strong> m²</span>
                      )}
                      {getSup('RAMPAS') > 0 && (
                        <span className="text-muted">Rampas <strong>{getSup('RAMPAS').toFixed(1)}</strong> m²</span>
                      )}
                      {getSup('CORDONES') > 0 && (
                        <span className="text-muted">Cordones <strong>{getSup('CORDONES').toFixed(1)}</strong> m²</span>
                      )}
                    </div>

                    {/* Badge estado + acciones */}
                    <div className="d-flex align-items-center justify-content-between gap-2">
                      <span className={`badge bg-${color} text-${color === 'warning' ? 'dark' : 'white'}`}>
                        {t.estadoOperativo}
                      </span>
                      <div className="d-flex gap-1">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => navigate(`/editar/${t.id}`)}
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleEliminar(t)}
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
