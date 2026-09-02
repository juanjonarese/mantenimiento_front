import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cerrarTurno, obtenerTurnoActivo, abrirTurno, obtenerMaterialesCatalogo } from "../services/api";
import { obtenerTrabajos } from "../db/db";
import Swal from "sweetalert2";

export default function CerrarTurnoPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const esPendiente = searchParams.get("pendiente") === "1";

  const [turno, setTurno]               = useState(null);
  const [catalogo, setCatalogo]         = useState([]);
  const [listaUsados, setListaUsados]   = useState([]);
  const [selId, setSelId]               = useState("");
  const [cantInput, setCantInput]       = useState("");
  const [errorAgregar, setErrorAgregar] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [cargando, setCargando]         = useState(true);
  const [guardando, setGuardando]       = useState(false);
  const [error, setError]               = useState("");
  const [tieneTrabajos, setTieneTrabajos] = useState(false);

  useEffect(() => {
    const turnoId = localStorage.getItem("turnoId");
    if (!turnoId) { navigate("/login"); return; }

    // Cargamos turno y materiales por separado para que un fallo no bloquee al otro
    const cargarTurno = obtenerTurnoActivo()
      .then(({ turno: t }) => {
        if (t) {
          setTurno(t);
        } else {
          // Sin turno activo en backend pero tenemos turnoId local → mostramos igual
          setTurno({ _id: turnoId, fechaInicio: null });
        }
      })
      .catch(() => {
        setTurno({ _id: turnoId, fechaInicio: null });
      });

    const cargarMateriales = obtenerMaterialesCatalogo()
      .then((res) => {
        const mats = res?.materiales || [];
        setCatalogo(mats);
        if (mats.length > 0) setSelId(String(mats[0]._id));
      })
      .catch(() => {
        setError("No se pudieron cargar los materiales. Verificá la conexión.");
      });

    const cargarTrabajos = obtenerTrabajos()
      .then((todos) => {
        const delTurno = todos.filter((t) => t.turnoId === turnoId);
        setTieneTrabajos(delTurno.length > 0);
      })
      .catch(() => {});

    Promise.all([cargarTurno, cargarMateriales, cargarTrabajos]).finally(() => setCargando(false));
  }, []);

  // ── Agregar material ──────────────────────────────────────────────────────
  function handleAgregar() {
    setErrorAgregar("");
    if (!selId) return setErrorAgregar("Seleccioná un material");
    const cant = parseFloat(cantInput);
    if (!cantInput || isNaN(cant) || cant <= 0) return setErrorAgregar("Ingresá una cantidad mayor a 0");

    const mat = catalogo.find((m) => String(m._id) === selId);
    if (!mat) return;

    setListaUsados((prev) => {
      const existe = prev.find((u) => String(u._id) === selId);
      if (existe) {
        return prev.map((u) => String(u._id) === selId ? { ...u, cantidad: cant } : u);
      }
      return [...prev, { _id: mat._id, nombre: mat.nombre, cantidad: cant, unidad: mat.unidad }];
    });
    setCantInput("");
  }

  function handleEliminar(_id) {
    setListaUsados((prev) => prev.filter((u) => String(u._id) !== String(_id)));
  }

  // ── Cerrar turno ──────────────────────────────────────────────────────────
  async function handleCerrar(e) {
    e.preventDefault();
    if (!turno) return;

    // Validar materiales solo si hubo trabajos en el turno
    if (tieneTrabajos && listaUsados.length === 0) {
      const cantPendiente = parseFloat(cantInput);
      const tienePendiente = cantInput && !isNaN(cantPendiente) && cantPendiente > 0;

      await Swal.fire({
        title: 'Falta registrar materiales',
        html: tienePendiente
          ? 'Escribiste una cantidad pero no la agregaste a la lista.<br>Presioná <strong>Agregar</strong> antes de cerrar el turno.'
          : 'Tenés que registrar al menos un material antes de cerrar el turno.',
        icon: 'error',
        confirmButtonColor: '#0d6efd',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    // Si no hubo trabajos, confirmar cierre sin materiales
    if (!tieneTrabajos) {
      const { isConfirmed } = await Swal.fire({
        title: 'Sin trabajos registrados',
        text: 'No cargaste ningún trabajo en este turno. ¿Querés cerrarlo igual?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, cerrar turno',
        cancelButtonText: 'Cancelar',
      });
      if (!isConfirmed) return;
    }

    // Si tiene cantidad escrita pero no agregada, avisar antes de continuar
    const cantPendiente = parseFloat(cantInput);
    if (cantInput && !isNaN(cantPendiente) && cantPendiente > 0) {
      const { isConfirmed: agregarPendiente } = await Swal.fire({
        title: 'Cantidad sin agregar',
        html: 'Escribiste una cantidad pero no la agregaste a la lista.<br>¿Querés agregarla antes de cerrar?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#0d6efd',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, agregar',
        cancelButtonText: 'No, continuar igual',
      });
      if (agregarPendiente) { handleAgregar(); return; }
    }

    const { isConfirmed } = await Swal.fire({
      title: '¿Cerrar turno?',
      html: `Se registrarán <strong>${listaUsados.length} material${listaUsados.length !== 1 ? 'es' : ''}</strong> y el turno quedará cerrado.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, cerrar turno',
      cancelButtonText: 'Cancelar',
    });

    if (!isConfirmed) return;

    const materialesPayload = listaUsados.map(({ _id, nombre, cantidad, unidad }) => ({
      materialId: String(_id),
      nombre,
      cantidad,
      unidad,
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

  const matSeleccionado = catalogo.find((m) => String(m._id) === selId);

  return (
    <div>

      {/* ── HEADER ── */}
      <div className="page-header bg-white border-bottom px-3 px-lg-4 py-3 mb-0">
        <div className="d-flex align-items-center justify-content-between gap-2">
          <div>
            <h4 className="fw-bold mb-0">
              <i className="bi bi-door-closed me-2 text-danger"></i>Cerrar turno
            </h4>
            {turno?.fechaInicio && (
              <small className="text-muted">
                Iniciado el {formatFecha(turno.fechaInicio)} a las {formatHora(turno.fechaInicio)}
              </small>
            )}
          </div>
          <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate(-1)}>
            <i className="bi bi-arrow-left me-1"></i>Volver
          </button>
        </div>

        {esPendiente && (
          <div className="alert alert-warning d-flex align-items-start gap-2 mb-0 mt-3 py-2">
            <i className="bi bi-exclamation-triangle-fill flex-shrink-0 mt-1"></i>
            <div className="small">
              <span className="fw-semibold">Tenés un turno sin cerrar. </span>
              Completá los materiales y cerralo para iniciar el turno de hoy.
            </div>
          </div>
        )}
      </div>

      {/* ── CONTENIDO ── */}
      <div className="px-3 py-3 pb-5" style={{ maxWidth: 720, margin: "0 auto" }}>

      <form onSubmit={handleCerrar}>

        {/* ── Materiales ───────────────────────────────────────────── */}
        <div className="card mb-3">
          <div className="card-header bg-light fw-semibold small">
            <i className="bi bi-box-seam me-1"></i> Materiales utilizados en el turno
          </div>
          <div className="card-body">

            {!tieneTrabajos ? (
              <div className="alert alert-secondary mb-0 py-2 small d-flex align-items-center gap-2">
                <i className="bi bi-info-circle flex-shrink-0"></i>
                No hay trabajos registrados en este turno, no se puede descontar material.
              </div>
            ) : catalogo.length === 0 ? (
              <p className="text-muted small text-center mb-0">
                No hay materiales configurados. El admin debe cargarlos en la sección Materiales.
              </p>
            ) : (
              <>
                {/* Fila 1: selector material */}
                <select
                  className="form-select mb-2"
                  value={selId}
                  onChange={(e) => { setSelId(e.target.value); setErrorAgregar(""); }}
                >
                  {catalogo.map((m) => (
                    <option key={m._id} value={String(m._id)}>{m.nombre}</option>
                  ))}
                </select>

                {/* Fila 2: cantidad + unidad + botón */}
                <div className="d-flex gap-2 mb-1 align-items-center">
                  <input
                    type="number"
                    className="form-control text-center"
                    style={{ maxWidth: 110 }}
                    min="0"
                    step="any"
                    placeholder="Cantidad"
                    value={cantInput}
                    onChange={(e) => { setCantInput(e.target.value); setErrorAgregar(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAgregar(); } }}
                  />
                  <span className="text-muted small text-nowrap">
                    {matSeleccionado?.unidad || ""}
                  </span>
                  <button type="button" className="btn btn-primary ms-auto" onClick={handleAgregar}>
                    <i className="bi bi-plus-lg me-1"></i>Agregar
                  </button>
                </div>

                {errorAgregar && <div className="text-danger small mb-2">{errorAgregar}</div>}

                {/* Lista de materiales agregados */}
                {listaUsados.length === 0 ? (
                  <p className="text-muted small text-center py-2 mb-0 mt-2">
                    Todavía no agregaste materiales
                  </p>
                ) : (
                  <div className="mt-3 border-top pt-2">
                    {listaUsados.map((u) => (
                      <div key={String(u._id)} className="d-flex align-items-center justify-content-between py-2 border-bottom">
                        <span className="fw-semibold small">{u.nombre}</span>
                        <div className="d-flex align-items-center gap-2">
                          <span className="badge bg-primary fs-6">{u.cantidad} {u.unidad}</span>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger py-0 px-2"
                            onClick={() => handleEliminar(u._id)}
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

        {/* ── Observaciones ─────────────────────────────────────────── */}
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

        <button type="submit" className="btn btn-danger w-100" disabled={guardando}>
          {guardando
            ? <><span className="spinner-border spinner-border-sm me-2"></span>Cerrando turno...</>
            : <><i className="bi bi-check-circle me-2 fs-5"></i>Confirmar cierre de turno</>
          }
        </button>
      </form>
      </div>
    </div>
  );
}
