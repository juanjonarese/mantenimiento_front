import React, { useState, useEffect, useCallback } from "react";
import Swal from "sweetalert2";
import { obtenerAccesos, obtenerUsuarios } from "../services/api";

const formatFecha = (iso) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

const formatHora = (iso) =>
  new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

const badgeRol = (rol) => {
  if (rol === "admin") return <span className="badge bg-primary">Admin</span>;
  if (rol === "cliente") return <span className="badge bg-success">Cliente</span>;
  return <span className="badge bg-secondary">Supervisor</span>;
};

const AccesosPage = () => {
  const [accesos, setAccesos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({ usuario: "", desde: "", hasta: "" });

  useEffect(() => {
    obtenerUsuarios()
      .then((r) => setUsuarios(r.usuarios || []))
      .catch(() => {});
  }, []);

  const cargarAccesos = useCallback(async () => {
    try {
      setLoading(true);
      const filtrosLimpios = Object.fromEntries(
        Object.entries(filtros).filter(([, v]) => v)
      );
      const response = await obtenerAccesos(filtrosLimpios);
      setAccesos(response.accesos || []);
    } catch {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudieron cargar los accesos" });
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => { cargarAccesos(); }, [cargarAccesos]);

  const limpiarFiltros = () => setFiltros({ usuario: "", desde: "", hasta: "" });

  return (
    <div className="lista-page">
      <div className="page-header bg-white border-bottom px-3 px-lg-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h4 className="fw-bold mb-0">
            <i className="bi bi-shield-lock me-2 text-primary"></i>Accesos al sistema
          </h4>
          <small className="text-muted">
            {accesos.length} acceso{accesos.length !== 1 ? "s" : ""} registrado{accesos.length !== 1 ? "s" : ""}
          </small>
        </div>
      </div>

      <div className="container py-3" style={{ maxWidth: 1400 }}>
        {/* Filtros */}
        <div className="card shadow-sm mb-3">
          <div className="card-body p-3">
            <div className="row g-2 align-items-end">
              <div className="col-12 col-md-4">
                <label className="form-label small fw-semibold mb-1">Usuario</label>
                <select
                  className="form-select"
                  value={filtros.usuario}
                  onChange={(e) => setFiltros((f) => ({ ...f, usuario: e.target.value }))}
                >
                  <option value="">Todos</option>
                  {usuarios.map((u) => (
                    <option key={u._id} value={u._id}>{u.nombre} {u.apellido}</option>
                  ))}
                </select>
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small fw-semibold mb-1">Desde</label>
                <input
                  type="date"
                  className="form-control"
                  value={filtros.desde}
                  onChange={(e) => setFiltros((f) => ({ ...f, desde: e.target.value }))}
                />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small fw-semibold mb-1">Hasta</label>
                <input
                  type="date"
                  className="form-control"
                  value={filtros.hasta}
                  onChange={(e) => setFiltros((f) => ({ ...f, hasta: e.target.value }))}
                />
              </div>
              <div className="col-12 col-md-2">
                <button className="btn btn-outline-secondary w-100" onClick={limpiarFiltros}>
                  <i className="bi bi-x-circle me-1"></i>Limpiar
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card shadow-sm">
          <div className="card-body p-2 p-md-3">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary"></div>
                <p className="mt-3 text-muted small">Cargando...</p>
              </div>
            ) : accesos.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                No hay accesos registrados
              </div>
            ) : (
              <>
                {/* Tabla — pantallas medianas+ */}
                <div className="table-responsive d-none d-md-block">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Usuario</th>
                        <th>Email</th>
                        <th>Rol</th>
                        <th>Día</th>
                        <th>Hora</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accesos.map((a) => (
                        <tr key={a._id}>
                          <td className="fw-semibold">{a.nombre} {a.apellido}</td>
                          <td className="text-muted small">{a.email}</td>
                          <td>{badgeRol(a.rol)}</td>
                          <td>{formatFecha(a.fecha)}</td>
                          <td>{formatHora(a.fecha)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Cards — móvil */}
                <div className="d-md-none">
                  {accesos.map((a) => (
                    <div key={a._id} className="card mb-2">
                      <div className="card-body py-2">
                        <div className="d-flex justify-content-between align-items-start mb-1">
                          <span className="fw-semibold">{a.nombre} {a.apellido}</span>
                          {badgeRol(a.rol)}
                        </div>
                        <div className="text-muted small mb-1">{a.email}</div>
                        <div className="small">
                          <i className="bi bi-calendar3 me-1"></i>{formatFecha(a.fecha)}
                          <span className="mx-2">·</span>
                          <i className="bi bi-clock me-1"></i>{formatHora(a.fecha)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="card-footer bg-white text-muted text-center py-2 small">
            Total: <strong>{accesos.length}</strong> acceso{accesos.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccesosPage;
