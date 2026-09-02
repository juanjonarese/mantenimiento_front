import { openDB } from 'idb';

const DB_NAME = 'pintura-vial-db';
const STORE = 'trabajos';

// Abrimos sin fijar versión: los navegadores que usaron versiones anteriores de
// la app tienen esta base en v2, y IndexedDB no permite abrirla pidiendo una
// versión menor (falla con VersionError). Si la base que encontramos no tiene el
// store, la reabrimos subiendo una versión para crearlo.
const dbPromise = (async () => {
  let db = await openDB(DB_NAME);

  if (!db.objectStoreNames.contains(STORE)) {
    const siguiente = db.version + 1;
    db.close();
    db = await openDB(DB_NAME, siguiente, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) {
          d.createObjectStore(STORE, { keyPath: 'id' });
        }
      },
    });
  }

  return db;
})();

export const obtenerTrabajos = async () => {
  const db = await dbPromise;
  return db.getAll(STORE);
};

export const guardarTrabajo = async (t) => {
  const db = await dbPromise;
  await db.put(STORE, t);
  return t;
};

export const obtenerTrabajoPorId = async (id) => {
  const db = await dbPromise;
  const directo = await db.get(STORE, id);
  if (directo) return directo;
  const todos = await db.getAll(STORE);
  return todos.find((x) => x.id === id || x._id === id) || null;
};

export const eliminarTrabajo = async (id) => {
  const db = await dbPromise;
  const todos = await db.getAll(STORE);
  const aBorrar = todos.filter((x) => x.id === id || x._id === id);
  const tx = db.transaction(STORE, 'readwrite');
  await Promise.all(aBorrar.map((t) => tx.store.delete(t.id)));
  await tx.done;
};

export const importarDesdeBackend = async (data) => {
  const db = await dbPromise;
  const actuales = await db.getAll(STORE);

  const delBackend = data.map((t) => ({ ...t, id: t._id || t.id, sincronizado: true }));
  // idLocal de los trabajos que el backend ya tiene
  const yaEnBackend = new Set(delBackend.map((t) => t.idLocal).filter((x) => x != null));
  // Conservar los trabajos locales aún NO sincronizados que el backend todavía no tiene,
  // para no perder lo recién creado (sobre todo cuando se trabaja offline).
  const pendientesLocales = actuales.filter(
    (t) => !t.sincronizado && !yaEnBackend.has(t.id)
  );

  const finales = [...delBackend, ...pendientesLocales];

  const tx = db.transaction(STORE, 'readwrite');
  await tx.store.clear();
  await Promise.all(finales.map((t) => tx.store.put(t)));
  await tx.done;

  return finales;
};

export const obtenerNoSincronizados = async () => {
  const db = await dbPromise;
  const todos = await db.getAll(STORE);
  return todos.filter((x) => !x.sincronizado);
};

export const marcarTodosSincronizados = async (ids) => {
  const db = await dbPromise;
  const tx = db.transaction(STORE, 'readwrite');
  await Promise.all(ids.map(async (id) => {
    const t = await tx.store.get(id);
    if (t) {
      t.sincronizado = true;
      await tx.store.put(t);
    }
  }));
  await tx.done;
};

export const obtenerMateriales = async () => [];
