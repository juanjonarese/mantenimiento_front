import { openDB } from 'idb';

const DB_NAME = 'pintura-vial-db';
const DB_VERSION = 1;
const STORE = 'trabajos';

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('sincronizado', 'sincronizado');
      store.createIndex('fechaCarga', 'fechaCarga');
    },
  });
}

export async function guardarTrabajo(trabajo) {
  const db = await getDB();
  await db.put(STORE, trabajo);
}

export async function obtenerTrabajos() {
  const db = await getDB();
  const todos = await db.getAll(STORE);
  return todos.sort((a, b) => new Date(b.fechaCarga) - new Date(a.fechaCarga));
}

export async function obtenerTrabajoPorId(id) {
  const db = await getDB();
  return db.get(STORE, id);
}

export async function eliminarTrabajo(id) {
  const db = await getDB();
  return db.delete(STORE, id);
}

export async function obtenerNoSincronizados() {
  const db = await getDB();
  return db.getAllFromIndex(STORE, 'sincronizado', false);
}

export async function marcarSincronizado(id) {
  const db = await getDB();
  const trabajo = await db.get(STORE, id);
  if (!trabajo) return;
  await db.put(STORE, { ...trabajo, sincronizado: true });
}

export async function marcarTodosSincronizados(ids) {
  const db = await getDB();
  const tx = db.transaction(STORE, 'readwrite');
  await Promise.all(
    ids.map(async (id) => {
      const trabajo = await tx.store.get(id);
      if (trabajo) await tx.store.put({ ...trabajo, sincronizado: true });
    })
  );
  await tx.done;
}
