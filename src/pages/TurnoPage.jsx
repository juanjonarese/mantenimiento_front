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
  return ((Date.now() - new Date(fechaInicio)) / 3600000).toFixed(1);
}

const COLOR_ESTADO = {
  'Sin iniciar': { bg: '#6c757d', text: '#fff' },
  'En proceso':  { bg: '#ffc107', text: '#212529' },
  'Terminado':   { bg: '#198754', text: '#fff' },
  'Finalizado':  { bg: '#198754', text: '#fff' },
};

const BORDER_ESTADO = {
  'Sin iniciar': '#adb5bd',
  'En proceso':  '#ffc107',
  'Terminado':   '#198754',
  'Finalizado':  '#198754',
};

export default function TurnoPage() {
  const navigate = useNavigate();
  const [turno, setTurno] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [trabajos, setTrabajos] = useState([]);
  const nombre = localStorage.getItem("nombre") || "";

  const cargarTrabajos = useCallback(async () => {
    const turnoId = localStorage.getItem("turnoId");
    if (!turnoId) { setTrabajos([]); return; }
    const todos = await obtenerTrabajos();
    setTrabajos(todos.filter((t) => t.turnoId === turnoId));
  }, []);

  useEffect(() => {
    window.addEventListener("focus", cargarTrabajos);
    return () => window.removeEventListener("focus", cargarTrabajos);
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
      title: "¿Eliminar trabajo?",
      html: `<strong>${t.calle1} y ${t.calle2}</strong>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
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

  const supTotal = trabajos
    .reduce((s, t) => s + (t.items || []).reduce((si, i) => si + (i.superficie || 0), 0), 0)
    .toFixed(1);

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }} className="px-3 py-4 pb-5">

      {error && (
        <div className="alert alert-warning py-2 small mb-3 d-flex align-items-center gap-2">
          <i className="bi bi-wifi-off flex-shrink-0"></i>{error}
        </div>
      )}

      {/* ── Header compacto ── */}
      <div className="d-flex align-items-start justify-content-between mb-4">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span
              className="rounded-circle d-inline-block"
              style={{ width: 8, height: 8, background: "#198754", marginTop: 1, flexShrink: 0 }}
            />
            <span className="fw-bold fs-6">Turno activo</span>
          </div>
          {nombre && (
            <div className="text-muted small">{nombre}</div>
          )}
          <div className="text-muted small">
            {formatFecha(turno?.fechaInicio)} · desde {formatHora(turno?.fechaInicio)}
            {turno?.fechaInicio && (
              <span className="ms-2 text-success fw-semibold">{calcularHoras(turno.fechaInicio)} hs</span>
            )}
          </div>
        </div>
        <button
          className="btn btn-sm btn-outline-danger flex-shrink-0 ms-3"
          onClick={() => navigate("/cerrar-turno")}
        >
          <i className="bi bi-door-closed me-1"></i>Cerrar turno
        </button>
      </div>

      {/* ── CTA principal ── */}
      <button
        className="btn btn-primary w-100 mb-4 py-2 fw-semibold"
        onClick={() => navigate("/nuevo")}
      >
        <i className="bi bi-plus-lg me-2"></i>Registrar nuevo trabajo
      </button>

      {/* ── Lista de trabajos ── */}
      <div className="d-flex align-items-center justify-content-between mb-2">
        <span className="text-uppercase text-muted fw-semibold" style={{ fontSize: 11, letterSpacing: "0.06em" }}>
          Trabajos del turno
          {trabajos.length > 0 && (
            <span className="ms-2 badge rounded-pill bg-primary" style={{ fontSize: 10 }}>{trabajos.length}</span>
          )}
        </span>
        {trabajos.length > 0 && (
          <span className="text-muted small">{supTotal} m²</span>
        )}
      </div>

      {trabajos.length === 0 ? (
        <div className="text-center py-5 text-muted">
          <i className="bi bi-clipboard" style={{ fontSize: 40, opacity: 0.2 }}></i>
          <p className="small mt-3 mb-0">Todavía no hay trabajos en este turno</p>
        </div>
      ) : (
        <div className="d-flex flex-column gap-2">
          {trabajos.map((t) => {
            const estado = t.estadoOperativo || "Sin iniciar";
            const colores = COLOR_ESTADO[estado] || COLOR_ESTADO["Sin iniciar"];
            const borderColor = BORDER_ESTADO[estado] || "#adb5bd";
            const getSup = (tipo) =>
              (t.items || []).find((i) => i.tipoTrabajo === tipo)?.superficie || 0;

            return (
              <div
                key={t.id}
                className="card shadow-sm"
                style={{ borderLeft: `3px solid ${borderColor}` }}
              >
                <div className="card-body py-2 px-3">

                  {/* Fila 1: intersección + botones */}
                  <div className="d-flex align-items-start justify-content-between gap-2 mb-1">
                    <div className="fw-semibold lh-sm" style={{ fontSize: 15 }}>
                      {t.calle1} y {t.calle2}
                    </div>
                    <div className="d-flex gap-1 flex-shrink-0">
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        style={{ padding: "2px 8px" }}
                        onClick={() => navigate(`/editar/${t.id}`)}
                      >
                        <i className="bi bi-pencil" style={{ fontSize: 12 }}></i>
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        style={{ padding: "2px 8px" }}
                        onClick={() => handleEliminar(t)}
                      >
                        <i className="bi bi-trash" style={{ fontSize: 12 }}></i>
                      </button>
                    </div>
                  </div>

                  {/* Fila 2: superficies */}
                  <div className="d-flex gap-3 flex-wrap mb-1" style={{ fontSize: 12, color: "#6c757d" }}>
                    {getSup("SENDAS") > 0 && (
                      <span>Sendas <strong style={{ color: "#212529" }}>{getSup("SENDAS").toFixed(1)}</strong> m²</span>
                    )}
                    {getSup("RAMPAS") > 0 && (
                      <span>Rampas <strong style={{ color: "#212529" }}>{getSup("RAMPAS").toFixed(1)}</strong> m²</span>
                    )}
                    {getSup("CORDONES") > 0 && (
                      <span>Cordones <strong style={{ color: "#212529" }}>{getSup("CORDONES").toFixed(1)}</strong> m²</span>
                    )}
                  </div>

                  {/* Fila 3: badge estado */}
                  <span
                    className="badge"
                    style={{ background: colores.bg, color: colores.text, fontSize: 11 }}
                  >
                    {estado}
                  </span>

                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
