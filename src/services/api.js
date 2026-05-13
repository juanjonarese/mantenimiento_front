const API_URL = import.meta.env.VITE_API_URL;

// Helper para obtener el token del localStorage
const getAuthToken = () => {
  return localStorage.getItem("token");
};

// Helper para headers con autenticación
const getAuthHeaders = () => {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

// Manejo de errores
const handleResponse = async (response, shouldRedirectOn401 = true) => {
  const data = await response.json();

  if (!response.ok) {
    // Si el token expiró o es inválido, redirigir al login (excepto en login)
    if (response.status === 401 && shouldRedirectOn401) {
      localStorage.clear();
      // Usar replace para no crear entradas en el historial y evitar loops
      window.location.replace("/login");
    }
    throw new Error(data.msg || "Error en la petición");
  }

  return data;
};

// ============= USUARIOS =============

export const loginUsuario = async (email, password) => {
  const response = await fetch(`${API_URL}/usuarios/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  // No redirigir en login - un 401 aquí es credenciales incorrectas, no token expirado
  return handleResponse(response, false);
};

export const obtenerUsuarios = async () => {
  const response = await fetch(`${API_URL}/usuarios`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const crearUsuario = async (usuarioData) => {
  const response = await fetch(`${API_URL}/usuarios/registro`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(usuarioData),
  });
  return handleResponse(response, false);
};

export const actualizarUsuario = async (id, usuarioData) => {
  const response = await fetch(`${API_URL}/usuarios/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(usuarioData),
  });
  return handleResponse(response);
};

export const eliminarUsuario = async (id) => {
  const response = await fetch(`${API_URL}/usuarios/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= TRABAJOS =============

export const sincronizarTrabajos = async (trabajos) => {
  const response = await fetch(`${API_URL}/trabajos/sync`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ trabajos }),
  });
  return handleResponse(response);
};

export const obtenerTrabajosBackend = async (filtros = {}) => {
  const params = new URLSearchParams(filtros).toString();
  const response = await fetch(`${API_URL}/trabajos${params ? `?${params}` : ""}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const actualizarTrabajoBackend = async (id, datos) => {
  const response = await fetch(`${API_URL}/trabajos/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(datos),
  });
  return handleResponse(response);
};

export const eliminarTrabajoBackend = async (id) => {
  const response = await fetch(`${API_URL}/trabajos/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const obtenerEstadisticas = async () => {
  const response = await fetch(`${API_URL}/trabajos/estadisticas`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};
