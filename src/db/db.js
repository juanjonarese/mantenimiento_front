let _trabajos = [];

export const obtenerTrabajos = async () => [..._trabajos];

export const guardarTrabajo = async (t) => {
  const idx = _trabajos.findIndex((x) => x.id === t.id);
  if (idx >= 0) _trabajos[idx] = t; else _trabajos.push(t);
  return t;
};

export const obtenerTrabajoPorId = async (id) =>
  _trabajos.find((x) => x.id === id || x._id === id) || null;

export const eliminarTrabajo = async (id) => {
  _trabajos = _trabajos.filter((x) => x.id !== id && x._id !== id);
};

export const importarDesdeBackend = async (data) => {
  _trabajos = data.map((t) => ({ ...t, id: t._id || t.id, sincronizado: true }));
  return _trabajos;
};

export const obtenerNoSincronizados = async () =>
  _trabajos.filter((x) => !x.sincronizado);

export const marcarTodosSincronizados = async (ids) => {
  ids.forEach((id) => {
    const t = _trabajos.find((x) => x.id === id);
    if (t) t.sincronizado = true;
  });
};

export const obtenerMateriales = async () => [];
