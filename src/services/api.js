const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

async function handleResponse(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.msg || "Error en la petición");
  return data;
}

// ============= USUARIOS =============

export const loginUsuario = async (email, password) => {
  const response = await fetch(`${API_URL}/usuarios/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(response);
};

// ============= TRABAJOS =============

export const sincronizarTrabajos = async (trabajos) => {
  const response = await fetch(`${API_URL}/trabajos/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trabajos }),
  });
  return handleResponse(response);
};

export const obtenerTrabajosBackend = async (filtros = {}) => {
  const params = new URLSearchParams(filtros).toString();
  const response = await fetch(`${API_URL}/trabajos${params ? `?${params}` : ""}`);
  return handleResponse(response);
};

export const actualizarTrabajoBackend = async (id, datos) => {
  const response = await fetch(`${API_URL}/trabajos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  return handleResponse(response);
};

export const eliminarTrabajoBackend = async (id) => {
  const response = await fetch(`${API_URL}/trabajos/${id}`, {
    method: "DELETE",
  });
  return handleResponse(response);
};

export const obtenerEstadisticas = async () => {
  const response = await fetch(`${API_URL}/trabajos/estadisticas`);
  return handleResponse(response);
};
