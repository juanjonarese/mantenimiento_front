import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cerrarTurno, obtenerTurnoActivo, abrirTurno } from "../services/api";
import { obtenerMateriales } from "../db/db";

export default function CerrarTurnoPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const esPendiente = searchParams.get("pendiente") === "1";

  const [turno, setTurno] = useState(null);
  const [materiales, setMateriales] = useState([]);
  const [cantidades, setCantidades] = useState({});
  const [observaciones, setObservaciones] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const turnoId = localStorage.getItem("turnoId");
    if (!turnoId) {
      navigate("/login");
      return;
    }

    Promise.all([
      obtenerTurnoActivo(),
      obtenerMateriales(),
    ])
      .then(([{ turno: t }, mats]) => {
        if (!t) {
          navigate("/login");
          return;
        }
        setTurno(t);
        setMateriales(mats);
        const inicial = {};
        mats.forEach((m) => { inicial[m.id] = ""; });
        setCantidades(inicial);
      })
      .catch(() => {
        setError("No se pudo cargar la información. Verificá tu conexión.");
      })
      .finally(() => setCargando(false));
  }, []);

  async function handleCerrar(e) {
    e.preventDefault();
    if (!turno) return;

    const materialesUsados = materiales
      .filter((m) => cantidades[m.id] !== "" && parseFloat(cantidades[m.id]) > 0)
      .map((m) => ({
        nombre: m.nombre,
        cantidad: parseFloat(cantidades[m.id]),
        unidad: m.unidad,
      }));

    setGuardando(true);
    setError("");
    try {
      await cerrarTurno(turno._id, { materiales: materialesUsados, observaciones });
      localStorage.removeItem("turnoId");

      if (esPendiente) {
        const { turno: nuevoTurno } = await abrirTurno();
        localStorage.setItem("turnoId", nuevoTurno._id);
        navigate("/turno");
      } else {
        localStorage.clear();
        navigate("/login");
      }
    } catch (err) {
      setError(err.message || "Error al cerrar el turno. Intentá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  function formatHora(fecha) {
    if (!fecha) return "—";
    return new Date(fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  }

  function formatFecha(fecha) {
    if (!fecha) return "";
    return new Date(fecha).toLocaleDateString("es-AR", { day: "numeric", month: "long" });
  }

  if (cargando) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: "60vh" }}>
        <div className="spinner-border text-danger"></div>
      </div>
    );
  }

  return (
    <div className="container-fluid p-3 pb-5">

      {/* Aviso turno pendiente */}
      {esPendiente && (
        <div className="alert alert-warning d-flex align-items-start gap-2 mb-4">
          <i className="bi bi-exclamation-triangle-fill fs-5 flex-shrink-0 mt-1"></i>
          <div>
            <div className="fw-semibold">Tenés un turno sin cerrar</div>
            <div className="small">
              Iniciado el {formatFecha(turno?.fechaInicio)} a las {formatHora(turno?.fechaInicio)}.
              Completá los materiales y cerralo para iniciar el turno de hoy.
            </div>
          </div>
        </div>
      )}

      <h5 className="fw-bold mb-1">
        <i className="bi bi-door-closed me-2 text-danger"></i>
        Cerrar turno
      </h5>
      {turno && (
        <div className="text-muted small mb-4">
          Turno iniciado el {formatFecha(turno.fechaInicio)} a las {formatHora(turno.fechaInicio)}
        </div>
      )}

      <form onSubmit={handleCerrar}>

        {/* Materiales usados */}
        <div className="card mb-3">
          <div className="card-header bg-light fw-semibold small">
            <i className="bi bi-box-seam me-1"></i> Materiales utilizados en el turno
          </div>
          <div className="card-body">
            {materiales.length === 0 ? (
              <div className="text-muted small text-center py-3">
                <i className="bi bi-box-seam me-1"></i>
                No hay materiales configurados.{" "}
                <a href="/materiales" className="text-primary">Ir a Materiales</a>
              </div>
            ) : (
              materiales.map((mat) => (
                <div key={mat.id} className="d-flex align-items-center gap-3 mb-3">
                  <div className="flex-grow-1">
                    <div className="fw-semibold small">{mat.nombre}</div>
                    <div className="text-muted" style={{ fontSize: 12 }}>
                      Stock disponible: {mat.stock} {mat.unidad}
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <input
                      type="number"
                      className="form-control text-center"
                      style={{ width: 90 }}
                      min="0"
                      step="any"
                      placeholder="0"
                      value={cantidades[mat.id] ?? ""}
                      onChange={(e) =>
                        setCantidades((prev) => ({ ...prev, [mat.id]: e.target.value }))
                      }
                    />
                    <span className="text-muted small text-nowrap" style={{ minWidth: 45 }}>
                      {mat.unidad}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Observaciones */}
        <div className="card mb-4">
          <div className="card-header bg-light fw-semibold small">
            <i className="bi bi-chat-left-text me-1"></i> Observaciones del turno
          </div>
          <div className="card-body">
            <textarea
              className="form-control"
              rows={3}
              placeholder="Notas adicionales sobre el turno (opcional)"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="alert alert-danger mb-3">
            <i className="bi bi-exclamation-triangle me-2"></i>{error}
          </div>
        )}

        <div className="d-flex flex-column gap-2">
          <button
            type="submit"
            className="btn btn-danger btn-lg w-100 py-3"
            disabled={guardando}
          >
            {guardando ? (
              <><span className="spinner-border spinner-border-sm me-2"></span>Cerrando turno...</>
            ) : (
              <><i className="bi bi-check-circle me-2 fs-5"></i>Confirmar cierre de turno</>
            )}
          </button>

          {!esPendiente && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-lg w-100"
              onClick={() => navigate(-1)}
              disabled={guardando}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
