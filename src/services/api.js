import { obtenerTrabajos as obtenerTrabajosLocal } from '../db/db';

const IS_DEV = import.meta.env.DEV;
const API_URL = IS_DEV
  ? "http://localhost:3001/api"
  : (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

async function handleResponse(response, esLogin = false) {
  const data = await response.json();
  if (response.status === 401 && !esLogin) {
    localStorage.clear();
    window.location.href = "/login";
    throw new Error("Sesión expirada");
  }
  if (!response.ok) throw new Error(data.msg || "Error en la petición");
  return data;
}

// ============= USUARIOS =============

export const loginUsuario = async (email, password) => {
  if (IS_DEV) {
    // Intenta backend local; si no está corriendo, usa auth por localStorage
    try {
      const response = await fetch(`${API_URL}/usuarios/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      return handleResponse(response, true);
    } catch {
      // Backend local no disponible — validar contra usuario guardado en localStorage
      const usuarioLocal = JSON.parse(localStorage.getItem("usuarioLocal") || "null");
      if (usuarioLocal && usuarioLocal.email === email && usuarioLocal.password === password) {
        return { token: "dev-token-local", rol: usuarioLocal.rol || "admin", msg: "Sesión local iniciada" };
      }
      throw new Error("Backend local no disponible y no hay usuario local configurado");
    }
  }

  const response = await fetch(`${API_URL}/usuarios/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(response, true);
};

export const obtenerUsuarios = async () => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/usuarios`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
};

export const crearUsuario = async (datos) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/usuarios/registro`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(datos),
  });
  return handleResponse(response);
};

export const actualizarUsuario = async (id, datos) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/usuarios/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(datos),
  });
  return handleResponse(response);
};

export const eliminarUsuario = async (id) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/usuarios/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
};

// ============= TRABAJOS =============

export const subirFoto = async (data, nombre, tipo, calle1 = '', calle2 = '') => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/fotos/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data, nombre, tipo, calle1, calle2 }),
  });
  return handleResponse(response);
};

export const importarTrabajos = async (trabajos) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/trabajos/importar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ trabajos }),
  });
  return handleResponse(response);
};

export const sincronizarTrabajos = async (trabajos) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/trabajos/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ trabajos }),
  });
  return handleResponse(response);
};

export const obtenerTrabajosBackend = async (filtros = {}) => {
  const token = localStorage.getItem("token");
  const params = new URLSearchParams(filtros).toString();
  try {
    const response = await fetch(`${API_URL}/trabajos${params ? `?${params}` : ""}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse(response);
  } catch {
    if (IS_DEV) {
      const trabajos = await obtenerTrabajosLocal();
      return { trabajos };
    }
    throw new Error("No se pudo conectar con el servidor");
  }
};

export const obtenerTrabajosPorTurno = async (turnoId) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/trabajos?turno=${turnoId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
};

export const actualizarTrabajoBackend = async (id, datos) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/trabajos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(datos),
  });
  return handleResponse(response);
};

export const eliminarTrabajoBackend = async (id) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/trabajos/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
};

export const obtenerEstadisticas = async () => {
  const token = localStorage.getItem("token");
  try {
    const response = await fetch(`${API_URL}/trabajos/estadisticas`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse(response);
  } catch {
    return { estadisticas: null };
  }
};

// ============= TURNOS =============

export const abrirTurno = async () => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/turnos/abrir`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
};

export const obtenerTurnoActivo = async () => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/turnos/activo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
};

export const cerrarTurno = async (id, datos) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/turnos/${id}/cerrar`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(datos),
  });
  return handleResponse(response);
};

export const obtenerTodosTurnos = async () => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/turnos`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
};

// ============= MATERIALES CATÁLOGO =============

export const obtenerMaterialesCatalogo = async () => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/materiales`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
};

export const obtenerTodosMaterialesCatalogo = async () => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/materiales/todos`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
};

export const crearMaterialCatalogo = async (datos) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/materiales`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(datos),
  });
  return handleResponse(response);
};

export const actualizarMaterialCatalogo = async (id, datos) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/materiales/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(datos),
  });
  return handleResponse(response);
};

export const eliminarMaterialCatalogo = async (id) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/materiales/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
};

export const obtenerConsumoMaterialesTrabajos = async () => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/trabajos/consumo-materiales`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
};

export const obtenerTotalesEntradas = async () => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/materiales/totales-entradas`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
};

export const registrarEntradaStock = async (materialId, datos) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/materiales/${materialId}/entrada`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(datos),
  });
  return handleResponse(response);
};

export const obtenerHistorialEntradas = async (materialId) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/materiales/${materialId}/entradas`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
};

// ============= CLIENTES =============

export const obtenerClientes = async () => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/clientes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
};

export const crearCliente = async (datos) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/clientes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(datos),
  });
  return handleResponse(response);
};

export const actualizarCliente = async (id, datos) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/clientes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(datos),
  });
  return handleResponse(response);
};

export const obtenerTodosClientes = async () => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/clientes/todos`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
};

export const toggleCliente = async (id) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/clientes/${id}/toggle`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
};

export const obtenerConsumoMateriales = async () => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/turnos/consumo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
};

export const eliminarTurnos = async (ids) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/turnos`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ids }),
  });
  return handleResponse(response);
};

export const obtenerTurnosConTrabajos = async () => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/turnos/con-trabajos`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
};

// ============= TIPOS DE TAREA =============

export const obtenerTiposTarea = async (todos = false) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/tipos-tarea${todos ? "?todos=true" : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
};

export const crearTipoTarea = async (datos) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/tipos-tarea`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(datos),
  });
  return handleResponse(response);
};

export const actualizarTipoTarea = async (id, datos) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/tipos-tarea/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(datos),
  });
  return handleResponse(response);
};

export const toggleTipoTarea = async (id) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/tipos-tarea/${id}/toggle`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
};
