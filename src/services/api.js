import { obtenerTrabajos as obtenerTrabajosLocal } from '../db/db';

const IS_DEV = import.meta.env.DEV;
const API_URL = IS_DEV
  ? "http://localhost:3001/api"
  : (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

async function handleResponse(response) {
  const data = await response.json();
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
      return handleResponse(response);
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
  return handleResponse(response);
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

export const sincronizarTrabajos = async (trabajos) => {
  if (IS_DEV) return { ok: true, sincronizados: 0 };
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/trabajos/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ trabajos }),
  });
  return handleResponse(response);
};

export const obtenerTrabajosBackend = async (filtros = {}) => {
  if (IS_DEV) {
    const trabajos = await obtenerTrabajosLocal();
    return { trabajos };
  }
  const token = localStorage.getItem("token");
  const params = new URLSearchParams(filtros).toString();
  const response = await fetch(`${API_URL}/trabajos${params ? `?${params}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
};

export const actualizarTrabajoBackend = async (id, datos) => {
  if (IS_DEV) return { ok: true };
  const response = await fetch(`${API_URL}/trabajos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  return handleResponse(response);
};

export const eliminarTrabajoBackend = async (id) => {
  if (IS_DEV) return { ok: true };
  const response = await fetch(`${API_URL}/trabajos/${id}`, {
    method: "DELETE",
  });
  return handleResponse(response);
};

export const obtenerEstadisticas = async () => {
  if (IS_DEV) return { estadisticas: null };
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/trabajos/estadisticas`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
};
