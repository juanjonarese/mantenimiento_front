# CLAUDE.md — Frontend

Instrucciones para Claude Code trabajando en este repositorio.
**Estas instrucciones tienen prioridad sobre el comportamiento por defecto.**

## Qué es este proyecto

Frontend del **Sistema de Gestión de Pintura Vial**: los operarios cargan trabajos de
pintura de calles desde el celular, en la calle, muchas veces sin señal. La oficina
gestiona clientes, materiales, turnos y certificaciones desde el mismo panel.

Backend separado: repo `mantenimiento_back`.

## Comandos

```bash
npm run dev       # Vite en http://localhost:5173
npm run build     # build de producción
npm run preview   # previsualizar el build
npm run lint      # ESLint
```

`.env` se copia de `.env.example`. Variable clave: `VITE_API_URL`
(ej. `http://localhost:3001/api`) — **sin barra al final**.

## 🚨 Reglas de Git — OBLIGATORIAS, sin excepción

**Contexto (septiembre 2026):** el historial de `main` fue reescrito con force-push para
sacar un archivo que tenía credenciales de producción. Por eso estas reglas son estrictas.

### ❌ Comandos PROHIBIDOS

Nunca ejecutar, nunca proponer, nunca "sugerir como última opción":

| Prohibido | Por qué |
|---|---|
| `git push --force` / `-f` / `--force-with-lease` | Puede reintroducir las credenciales purgadas o borrar el trabajo del otro |
| `git push --all` / `git push --tags` | Sube ramas viejas contaminadas |
| `git push <rama>` con rama distinta de `main` | Este proyecto trabaja solo sobre `main` |
| `git reset --hard` con cambios sin pushear | Se pierde trabajo sin vuelta atrás |
| `git rebase -i`, `filter-branch`, `filter-repo`, BFG | Reescriben historial |
| `git checkout -- .` / `git restore .` masivo | Borra cambios del otro que estén sin commitear |

Si alguno de estos **parece** ser la solución → **PARAR y avisarle a Juanjo.**
No es una decisión que se toma sola.

### ✅ La única rutina para subir cambios

Siempre igual, siempre en este orden:

```bash
git pull --rebase          # 1. traer lo del otro ANTES de tocar nada
                           # 2. ... trabajar ...
git status                 # 3. MIRAR qué se va a subir
git add -A
git commit -m "mensaje claro en español"
git pull --rebase          # 4. traer de nuevo por las dudas
git push                   # 5. subir
```

### 🔴 Si `git push` es rechazado

Un rechazo significa: *el remoto tiene algo que vos no tenés*. **Nunca es motivo para forzar.**

1. `git pull --rebase`
2. Si hay conflictos → resolverlos y `git rebase --continue`
3. `git push`
4. Si **sigue** fallando → **parar y avisarle a Juanjo.** Nada de `--force`.

### 🔐 Antes de cada commit

Revisar siempre qué se está por subir:

```bash
git status
git diff --cached --stat
```

**Nunca commitear:** `.env`, `.env.*`, `DOCUMENTACION-APP-CREA.md`, backups de la base,
claves, tokens, connection strings de Mongo, credenciales de R2, contraseñas.

Si aparece algo así en el staging → sacarlo (`git restore --staged <archivo>`), agregarlo
al `.gitignore` y avisar. Los secretos van **solo** en `.env` local, nunca en el código,
nunca en un `.md`, nunca en un comentario.

### 👥 Somos dos trabajando

Juanjo y Damián pushean desde máquinas distintas sobre el mismo `main`.

- **Commitear solo lo propio.** Si `git status` muestra archivos modificados que no tocaste,
  dejarlos y avisar — son del otro.
- Commits **chicos y frecuentes**, mejor que uno gigante al final.
- Mensajes en español, describiendo el cambio: `fix: ordenar la lista por fecha`,
  no `cambios` ni `update`.

### 🧹 Limpieza pendiente (hacer una sola vez, en cada máquina)

Si existe una rama `backup-old-main`, **contiene las credenciales viejas**. Borrarla:

```bash
git branch -D backup-old-main
git reflog expire --expire=now --all
git gc --prune=now
```

## ⚠️ Mobile-first — regla crítica

**La app la usan operarios en la calle, desde celulares Android, bajo el sol.**

- Diseñar **primero** para pantalla de ~390px de ancho. El escritorio viene después.
- Botones grandes, tocables con el dedo: `btn-lg`, mínimo 44px de alto.
- Formularios en **una sola columna**. Nunca scroll horizontal.
- Contraste alto — tiene que leerse bajo luz solar directa.
- Nunca asumir mouse, teclado físico ni pantalla grande.
- Usar clases responsivas de Bootstrap: `col-12 col-md-6`, `d-flex flex-wrap`, etc.

Antes de dar por terminada una pantalla, verificarla mentalmente a 390px.

## Arquitectura

- **`src/App.jsx`** — React Router; rutas protegidas con `ProtectedRoute`
- **`src/pages/`** — una página por pantalla: `LoginScreen`, `ListaPage`, `NuevoTrabajoPage`,
  `DetallePage`, `MapaPage`, `PanelPage`, `TurnoPage`, `CerrarTurnoPage`, `TurnosAdminPage`,
  `ClientesPage`, `MaterialesPage`, `TiposTareaPage`, `CertificacionesPage`, `UsuariosPage`,
  `RegistroPage`, `AccesosPage`
- **`src/components/`** — `PinturaNavbar`, `ProtectedRoute`, `EditarTrabajoModal`,
  `ImportarExcelModal`, `OfflineBadge`, `Footer`
- **`src/services/api.js`** — cliente HTTP central. Adjunta el JWT desde `localStorage`
  como `Authorization: Bearer <token>` y redirige a `/login` ante un 401.
  **Toda llamada a la API pasa por acá**, nunca `fetch` suelto en una página.
- **`src/db/db.js`** — IndexedDB para trabajar sin conexión
- **`src/hooks/`** — `useGPS` (ubicación), `useSync` (sincronización offline→online),
  `useUsuariosMap`
- **`src/utils/comprimirMedia.js`** — comprime fotos antes de subirlas (los operarios
  tienen datos limitados)
- **`src/constants.js`** — constantes compartidas

### Offline

La app tiene que funcionar sin señal. Los trabajos se guardan en IndexedDB y `useSync`
los sube cuando vuelve la conexión. **Al tocar el flujo de carga de trabajos, verificar
siempre que el camino offline siga funcionando.**

Abrir IndexedDB **sin fijar número de versión** — fijarla rompe la app en los celulares
que ya tienen la base en una versión distinta.

## Autenticación

1. Login → el backend devuelve un JWT (expira en 1 hora)
2. Se guarda en `localStorage`
3. `api.js` lo adjunta en cada request
4. Ante un 401, `api.js` redirige a `/login`

## Contraseñas

Se validan igual en front y back: empiezan con mayúscula, tienen letras y números,
mínimo 6 caracteres.

Regex: `/^[A-Z](?=.*[a-z])(?=.*\d)[A-Za-z\d]{5,}$/`

## Sin tests

No hay suite de tests configurada. La verificación es manual: levantar la app y probar
el flujo en el navegador, con el viewport en modo celular.
