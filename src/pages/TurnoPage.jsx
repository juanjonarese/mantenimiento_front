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
  if (!fechaInicio) return null;
  return ((Date.now() - new Date(fechaInicio)) / 3600000).toFixed(1);
}

const COLOR_ESTADO = {
  "Sin iniciar": { bg: "#6c757d", text: "#fff" },
  "En proceso":  { bg: "#ffc107", text: "#212529" },
  "Terminado":   { bg: "#198754", text: "#fff" },
  "Finalizado":  { bg: "#198754", text: "#fff" },
};

const BORDER_ESTADO = {
  "Sin iniciar": "#adb5bd",
  "En proceso":  "#ffc107",
  "Terminado":   "#198754",
  "Finalizado":  "#198754",
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

  const hs = calcularHoras(turno?.fechaInicio);
  const supTotal = trabajos
    .reduce((s, t) => s + (t.items || []).reduce((si, i) => si + (i.superficie || 0), 0), 0)
    .toFixed(1);

  return (
    <div className="turno-page">

      {/* ── HEADER ── */}
      <div className="page-header bg-white border-bottom px-3 px-lg-4 py-3">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div>
            <h4 className="fw-bold mb-0 d-flex align-items-center gap-2">
              <span
                className="rounded-circle flex-shrink-0"
                style={{ width: 10, height: 10, background: "#198754", display: "inline-block" }}
              />
              Turno activo
            </h4>
            <small className="text-muted">
              {nombre && <span className="me-1">{nombre} ·</span>}
              {formatFecha(turno?.fechaInicio)} · desde {formatHora(turno?.fechaInicio)}
              {hs && <span className="ms-2 text-success fw-semibold">{hs} hs</span>}
            </small>
          </div>
          <div className="d-flex gap-2">
            <button
              className="btn btn-primary d-flex align-items-center gap-2"
              onClick={() => navigate("/nuevo")}
            >
              <i className="bi bi-plus-lg"></i>
              <span>Nuevo trabajo</span>
            </button>
            <button
              className="btn btn-outline-danger d-flex align-items-center gap-2"
              onClick={() => navigate("/cerrar-turno")}
            >
              <i className="bi bi-door-closed"></i>
              <span className="d-none d-sm-inline">Cerrar turno</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-warning py-1 small mb-0 mt-2 d-flex align-items-center gap-2">
            <i className="bi bi-wifi-off flex-shrink-0"></i>{error}
          </div>
        )}
      </div>

      {/* ── CONTENIDO ── */}
      <div className="container-fluid px-3 py-3" style={{ maxWidth: 1400 }}>

        {/* Resumen */}
        {trabajos.length > 0 && (
          <div className="d-flex align-items-center justify-content-between mb-3">
            <span className="text-muted small fw-semibold">
              {trabajos.length} trabajo{trabajos.length !== 1 ? "s" : ""} en este turno
            </span>
            <span className="text-muted small">{supTotal} m² total</span>
          </div>
        )}

        {/* Cards */}
        {trabajos.length === 0 ? (
          <div className="text-center text-muted py-5">
            <i className="bi bi-clipboard display-4" style={{ opacity: 0.2 }}></i>
            <p className="mt-3 small">Todavía no hay trabajos en este turno</p>
          </div>
        ) : (
          <div className="row g-2">
            {trabajos.map((t) => {
              const estado = t.estadoOperativo || "Sin iniciar";
              const colores = COLOR_ESTADO[estado] || COLOR_ESTADO["Sin iniciar"];
              const borderColor = BORDER_ESTADO[estado] || "#adb5bd";
              const getSup = (tipo) =>
                (t.items || []).find((i) => i.tipoTrabajo === tipo)?.superficie || 0;

              const acciones = (
                <div className="d-flex gap-1 flex-shrink-0">
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => navigate(`/editar/${t.id}`)}
                  >
                    <i className="bi bi-pencil" style={{ fontSize: 12 }}></i>
                  </button>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => handleEliminar(t)}
                  >
                    <i className="bi bi-trash" style={{ fontSize: 12 }}></i>
                  </button>
                </div>
              );

              const superficies = (
                <div className="d-flex gap-3 flex-wrap" style={{ fontSize: 12, color: "#6c757d" }}>
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
              );

              const badgeEstado = (
                <span
                  className="badge flex-shrink-0"
                  style={{ background: colores.bg, color: colores.text, fontSize: 11 }}
                >
                  {estado}
                </span>
              );

              return (
                <div key={t.id} className="col-12 col-md-6">
                  <div
                    className="card h-100 shadow-sm"
                    style={{ borderLeft: `3px solid ${borderColor}` }}
                  >
                    <div className="card-body py-2 px-3">

                      {/* MOBILE: stacked */}
                      <div className="d-md-none">
                        <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                          <div className="fw-semibold">{t.calle1} y {t.calle2}</div>
                          {acciones}
                        </div>
                        <div className="mb-1">{superficies}</div>
                        {badgeEstado}
                      </div>

                      {/* DESKTOP: fila horizontal */}
                      <div className="d-none d-md-flex align-items-center gap-3">
                        <div className="fw-semibold" style={{ flex: "1 1 180px" }}>
                          {t.calle1} y {t.calle2}
                        </div>
                        <div style={{ flex: "2 1 200px" }}>{superficies}</div>
                        {badgeEstado}
                        {acciones}
                      </div>

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
