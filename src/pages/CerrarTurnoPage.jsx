import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cerrarTurno, obtenerTurnoActivo, abrirTurno } from "../services/api";
import { obtenerMateriales } from "../db/db";

export default function CerrarTurnoPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const esPendiente = searchParams.get("pendiente") === "1";

  const [turno, setTurno]           = useState(null);
  const [catalogo, setCatalogo]     = useState([]);   // materiales disponibles
  const [listaUsados, setListaUsados] = useState([]); // { id, nombre, cantidad, unidad }
  const [selId, setSelId]           = useState("");   // id del select
  const [cantInput, setCantInput]   = useState("");   // cantidad del input
  const [errorAgregar, setErrorAgregar] = useState("");

  const [observaciones, setObservaciones] = useState("");
  const [cargando, setCargando]     = useState(true);
  const [guardando, setGuardando]   = useState(false);
  const [error, setError]           = useState("");

  useEffect(() => {
    if (!localStorage.getItem("turnoId")) { navigate("/login"); return; }

    Promise.all([obtenerTurnoActivo(), obtenerMateriales()])
      .then(([{ turno: t }, mats]) => {
        if (!t) { navigate("/login"); return; }
        setTurno(t);
        setCatalogo(mats);
        if (mats.length > 0) setSelId(String(mats[0].id));
      })
      .catch(() => setError("No se pudo cargar la información. Verificá tu conexión."))
      .finally(() => setCargando(false));
  }, []);

  // ── Agregar material a la lista ─────────────────────────────────────────
  function handleAgregar() {
    setErrorAgregar("");
    if (!selId) return setErrorAgregar("Seleccioná un material");
    const cant = parseFloat(cantInput);
    if (!cantInput || isNaN(cant) || cant <= 0) return setErrorAgregar("Ingresá una cantidad mayor a 0");

    const mat = catalogo.find((m) => String(m.id) === selId);
    if (!mat) return;

    // Si ya está en la lista, actualiza la cantidad
    setListaUsados((prev) => {
      const existe = prev.find((u) => String(u.id) === selId);
      if (existe) {
        return prev.map((u) =>
          String(u.id) === selId ? { ...u, cantidad: cant } : u
        );
      }
      return [...prev, { id: mat.id, nombre: mat.nombre, cantidad: cant, unidad: mat.unidad }];
    });
    setCantInput("");
  }

  function handleEliminar(id) {
    setListaUsados((prev) => prev.filter((u) => String(u.id) !== String(id)));
  }

  // ── Cerrar turno ────────────────────────────────────────────────────────
  async function handleCerrar(e) {
    e.preventDefault();
    if (!turno) return;

    const materialesPayload = listaUsados.map(({ nombre, cantidad, unidad }) => ({
      nombre, cantidad, unidad,
    }));

    setGuardando(true);
    setError("");
    try {
      await cerrarTurno(turno._id, { materiales: materialesPayload, observaciones });
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

  function formatHora(f) {
    if (!f) return "—";
    return new Date(f).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  }
  function formatFecha(f) {
    if (!f) return "";
    return new Date(f).toLocaleDateString("es-AR", { day: "numeric", month: "long" });
  }

  if (cargando) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: "60vh" }}>
        <div className="spinner-border text-danger"></div>
      </div>
    );
  }

  const matSeleccionado = catalogo.find((m) => String(m.id) === selId);

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
        <i className="bi bi-door-closed me-2 text-danger"></i>Cerrar turno
      </h5>
      {turno && (
        <div className="text-muted small mb-4">
          Turno iniciado el {formatFecha(turno.fechaInicio)} a las {formatHora(turno.fechaInicio)}
        </div>
      )}

      <form onSubmit={handleCerrar}>

        {/* ── Materiales ── */}
        <div className="card mb-3">
          <div className="card-header bg-light fw-semibold small">
            <i className="bi bi-box-seam me-1"></i> Materiales utilizados en el turno
          </div>
          <div className="card-body">

            {catalogo.length === 0 ? (
              <p className="text-muted small text-center mb-0">
                No hay materiales configurados.
              </p>
            ) : (
              <>
                {/* Fila agregar */}
                <div className="d-flex gap-2 mb-1">
                  <select
                    className="form-select"
                    value={selId}
                    onChange={(e) => { setSelId(e.target.value); setErrorAgregar(""); }}
                  >
                    {catalogo.map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="form-control text-center"
                    style={{ width: 90, flexShrink: 0 }}
                    min="0"
                    step="any"
                    placeholder="Cant."
                    value={cantInput}
                    onChange={(e) => { setCantInput(e.target.value); setErrorAgregar(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAgregar(); } }}
                  />
                  <span className="text-muted small d-flex align-items-center text-nowrap" style={{ minWidth: 40 }}>
                    {matSeleccionado?.unidad || ""}
                  </span>
                  <button
                    type="button"
                    className="btn btn-primary flex-shrink-0"
                    onClick={handleAgregar}
                  >
                    <i className="bi bi-plus-lg"></i>
                  </button>
                </div>

                {errorAgregar && (
                  <div className="text-danger small mb-2">{errorAgregar}</div>
                )}

                {/* Lista de materiales agregados */}
                {listaUsados.length === 0 ? (
                  <p className="text-muted small text-center py-2 mb-0">
                    Todavía no agregaste materiales
                  </p>
                ) : (
                  <div className="mt-3">
                    {listaUsados.map((u) => (
                      <div key={u.id} className="d-flex align-items-center justify-content-between py-2 border-bottom">
                        <span className="fw-semibold small">{u.nombre}</span>
                        <div className="d-flex align-items-center gap-2">
                          <span className="badge bg-primary fs-6">
                            {u.cantidad} {u.unidad}
                          </span>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger py-0 px-2"
                            onClick={() => handleEliminar(u.id)}
                          >
                            <i className="bi bi-x-lg"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Observaciones ── */}
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
            {guardando
              ? <><span className="spinner-border spinner-border-sm me-2"></span>Cerrando turno...</>
              : <><i className="bi bi-check-circle me-2 fs-5"></i>Confirmar cierre de turno</>
            }
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
