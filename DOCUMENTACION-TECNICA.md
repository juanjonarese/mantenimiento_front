# Sistema de Gestión de Pintura Vial
### Documentación técnica y de entrega

---

## 1. Resumen

Sistema web de gestión de trabajos de pintura vial y señalización horizontal. Permite a los supervisores registrar trabajos en la calle desde el celular (con GPS, fotos y video), y a la oficina administrar el ciclo completo: turnos, consumo de materiales, certificación y facturación, con visualización en mapa.

Está compuesto por **dos aplicaciones independientes**:

| Aplicación | Rol | Repositorio |
|---|---|---|
| **Frontend** | Interfaz web (celular y escritorio) | `mantenimiento_front` |
| **Backend** | API REST + base de datos | `mantenimiento_back` |

---

## 2. Lenguaje y tecnologías

**El sistema está desarrollado íntegramente en JavaScript** (estándar ECMAScript 2022), tanto del lado del servidor como del cliente. Es el mismo lenguaje en todo el stack, lo que simplifica el mantenimiento y la búsqueda de desarrolladores.

### Frontend

| Tecnología | Versión | Función |
|---|---|---|
| **React** | 19.2 | Librería de interfaz de usuario |
| **Vite** | 7.2 | Compilador y servidor de desarrollo |
| **React Router** | 7.9 | Navegación entre pantallas |
| **Bootstrap** | 5.3 | Sistema de diseño responsivo |
| **Leaflet / React-Leaflet** | 1.9 / 5.0 | Mapas interactivos |
| **Recharts** | 3.5 | Gráficos del panel de control |
| **SweetAlert2** | 11.26 | Diálogos y alertas |
| **SheetJS (xlsx)** | 0.18 | Importación y exportación de Excel |
| **idb** | 8.0 | Almacenamiento local del navegador |

### Backend

| Tecnología | Versión | Función |
|---|---|---|
| **Node.js** | ≥ 18 | Entorno de ejecución |
| **Express** | 4.18 | Framework de API REST |
| **MongoDB / Mongoose** | 8.0 | Base de datos y modelado de datos |
| **jsonwebtoken (JWT)** | 9.0 | Autenticación por token |
| **Argon2** | 0.44 | Cifrado de contraseñas |
| **Multer** | 2.1 | Recepción de archivos |
| **AWS SDK S3** | 3.x | Cliente de almacenamiento (Cloudflare R2) |
| **fluent-ffmpeg** | 2.1 | Procesamiento de video |
| **express-rate-limit** | 8.4 | Protección contra ataques de fuerza bruta |

### Infraestructura

| Servicio | Uso |
|---|---|
| **Vercel** | Hosting del frontend y del backend |
| **MongoDB Atlas** | Base de datos en la nube |
| **Cloudflare R2** | Almacenamiento de fotos y videos |

---

## 3. Arquitectura

```
   Celular / PC del usuario
            │
            ▼
   ┌──────────────────────┐
   │  FRONTEND (React)    │   Vercel
   │  mantenimiento_front │
   └─────────┬────────────┘
             │ HTTPS + JWT
             ▼
   ┌──────────────────────┐
   │  BACKEND (Express)   │   Vercel
   │  mantenimiento_back  │
   └──┬────────────────┬──┘
      │                │
      ▼                ▼
 ┌──────────┐   ┌──────────────┐
 │ MongoDB  │   │  Cloudflare  │
 │  Atlas   │   │      R2      │
 │ (datos)  │   │(fotos/videos)│
 └──────────┘   └──────────────┘
```

El backend sigue el patrón **MVC en capas**:

```
routes/  →  controllers/  →  services/  →  models/
 (URL)      (validación)     (lógica)     (base de datos)
```

---

## 4. Roles y permisos

El sistema define cuatro roles con accesos diferenciados:

| Rol | Acceso |
|---|---|
| **admin** | Acceso total: panel, mapa, certificaciones, usuarios, materiales, clientes, tipos de tarea y turnos |
| **supervisor** | Apertura y cierre de turno, carga y edición de trabajos, lista y detalle |
| **cliente** | Solo lectura: mapa, lista y detalle de sus propios trabajos |
| **usuario** | Rol base heredado, sin pantallas asignadas |

El control se aplica en **dos niveles**: en el frontend mediante el componente `ProtectedRoute` (que oculta las pantallas no permitidas) y en el backend mediante los middlewares `verificarToken` y `verificarAdmin`, que rechazan la petición aunque se intente acceder directamente a la API.

---

## 5. Módulos funcionales

| Módulo | Descripción |
|---|---|
| **Turnos** | El supervisor abre un turno declarando los materiales que carga. Al cerrarlo, el consumo se distribuye automáticamente entre los trabajos realizados. |
| **Trabajos** | Registro con GPS automático, geocodificación inversa (calle y esquina), tipo de tarea, medidas, materiales, fotos y video. |
| **Mapa** | Visualización geográfica de todos los trabajos con marcadores por estado. |
| **Panel de control** | Estadísticas y gráficos: trabajos por día, superficie ejecutada, consumo de materiales. |
| **Certificaciones** | Circuito administrativo: sin certificar → en revisión → certificado → facturado (o rechazado). |
| **Materiales** | Catálogo con stock, unidades, entradas de stock y consumo histórico. |
| **Clientes** | Alta de clientes con CUIT y datos de contacto; asignación de trabajos por cliente. |
| **Tipos de tarea** | Catálogo configurable de tareas con su unidad de medida (m², metros lineales, etc.). |
| **Usuarios** | Alta, edición, cambio de rol y baja de usuarios. |
| **Importación Excel** | Carga masiva de trabajos desde planilla. |
| **Modo offline** | Los trabajos cargados sin señal quedan guardados en el dispositivo y se sincronizan al recuperar conexión. |

---

## 6. Estados de un trabajo

**Estado operativo** (lo maneja el supervisor en la calle):

`Sin iniciar` → `En proceso` → `Finalizado` → `Terminado`

**Estado administrativo** (lo maneja la oficina):

`Sin certificar` → `En revisión` → `Certificado` → `Facturado`

(con `Rechazado` como desvío, que registra el motivo)

---

## 7. Variables de entorno

> ⚠️ **Importante:** los valores reales son secretos y **no están en el repositorio** (los archivos `.env` están excluidos por `.gitignore`). Deben entregarse por un canal seguro, nunca por email ni dentro del código.

### Backend (`back/.env`)

| Variable | Descripción | Ejemplo |
|---|---|---|
| `PORT` | Puerto del servidor | `3001` |
| `MONGO_CONNECT` | Cadena de conexión a MongoDB | `mongodb+srv://usuario:clave@cluster.mongodb.net/pintura_vial` |
| `JWT_SECRET` | Clave secreta para firmar los tokens de sesión | *(cadena aleatoria larga)* |
| `NODE_ENV` | Entorno de ejecución | `development` / `production` |
| `FRONT_URL` | URL del frontend autorizada por CORS | `https://mantenimiento-front.vercel.app` |
| `R2_ENDPOINT` | Endpoint de Cloudflare R2 | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | Clave de acceso de R2 | *(secreto)* |
| `R2_SECRET_ACCESS_KEY` | Clave secreta de R2 | *(secreto)* |
| `R2_BUCKET` | Nombre del bucket | `pintura-vial` |
| `R2_PUBLIC_URL` | URL pública del bucket, **sin barra final** | `https://pub-xxxxxxxx.r2.dev` |

Si falta alguna variable de R2, la subida de archivos responde `503` — no hay almacenamiento alternativo.

### Frontend (`front/.env`)

| Variable | Descripción | Ejemplo |
|---|---|---|
| `VITE_API_URL` | URL de la API, **sin barra final** | `https://mantenimiento-back.vercel.app/api` |

> En desarrollo el frontend apunta automáticamente a `http://localhost:3001/api`, sin necesidad de configurar nada.

---

## 8. Instalación local

**Requisitos previos:** Node.js 18 o superior, y acceso a una base MongoDB (local o Atlas).

```bash
# 1. Clonar los repositorios
git clone https://github.com/<usuario>/mantenimiento_back.git
git clone https://github.com/<usuario>/mantenimiento_front.git

# 2. Backend
cd mantenimiento_back
npm install
cp .env.example .env      # completar con los valores reales
npm run dev               # queda escuchando en http://localhost:3001

# 3. Frontend (en otra terminal)
cd mantenimiento_front
npm install
cp .env.example .env
npm run dev               # abre en http://localhost:5173
```

### Comandos disponibles

**Backend**

| Comando | Función |
|---|---|
| `npm run dev` | Desarrollo con recarga automática |
| `npm start` | Producción |

**Frontend**

| Comando | Función |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación para producción (genera `dist/`) |
| `npm run preview` | Previsualizar la compilación |
| `npm run lint` | Revisión de calidad de código |

---

## 9. Despliegue en producción

Ambas aplicaciones se despliegan en **Vercel**, conectadas directamente a sus repositorios de GitHub: cada `push` a la rama `main` publica automáticamente una nueva versión.

**Backend** — la configuración está en `vercel.json`; se ejecuta como función serverless. La conexión a MongoDB se reutiliza entre invocaciones mediante una capa de reconexión en `db/config.db.js`.

**Frontend** — Vercel ejecuta `npm run build` y publica `dist/`. Todas las rutas se redirigen a `index.html` para que funcione la navegación del lado del cliente.

**Las variables de entorno se cargan en el panel de Vercel** (Settings → Environment Variables), nunca en el repositorio.

> **Nota sobre CORS:** el backend solo acepta peticiones desde los orígenes declarados en `FRONT_URL` y los puertos locales de desarrollo. Si cambia el dominio del frontend, hay que actualizar esa variable.

---

## 10. Seguridad

| Medida | Implementación |
|---|---|
| **Contraseñas** | Cifradas con Argon2 (algoritmo ganador del Password Hashing Competition). Nunca se almacenan en texto plano ni se devuelven en las respuestas de la API. |
| **Sesiones** | Token JWT con expiración de 1 hora. Al vencer, la aplicación redirige automáticamente al login. |
| **Fuerza bruta** | Máximo 10 intentos de login cada 15 minutos por IP. |
| **Autorización** | Verificación de token y de rol en cada endpoint protegido del servidor. |
| **CORS** | Lista blanca de orígenes autorizados. |
| **Secretos** | Fuera del repositorio, gestionados como variables de entorno. |
| **Límite de carga** | 15 MB por petición. |

**Reglas de contraseña** (validadas en frontend y backend): debe comenzar con mayúscula, contener letras y al menos un número, y tener un mínimo de 6 caracteres.

Expresión regular: `/^[A-Z](?=.*[a-z])(?=.*\d)[A-Za-z\d]{5,}$/`

---

## 11. API REST

Base: `https://<dominio-backend>/api`

Todos los endpoints protegidos requieren la cabecera `Authorization: Bearer <token>`.

### Usuarios

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/usuarios/login` | Público *(límite: 10 intentos / 15 min)* |
| POST | `/usuarios/registro` | Admin |
| GET | `/usuarios` | Admin |
| GET | `/usuarios/:id` | Autenticado |
| PUT | `/usuarios/:id` | Admin |
| DELETE | `/usuarios/:id` | Admin |

### Trabajos

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/trabajos` | Autenticado |
| GET | `/trabajos/:id` | Autenticado |
| GET | `/trabajos/estadisticas` | Autenticado |
| GET | `/trabajos/consumo-materiales` | Autenticado |
| POST | `/trabajos` | Autenticado |
| POST | `/trabajos/sync` | Autenticado *(sincronización offline)* |
| POST | `/trabajos/importar` | Autenticado *(importación Excel)* |
| PUT | `/trabajos/:id` | Autenticado |
| DELETE | `/trabajos/:id` | Autenticado |

### Turnos

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/turnos/abrir` | Autenticado |
| GET | `/turnos/activo` | Autenticado |
| PUT | `/turnos/:id/cerrar` | Autenticado |
| GET | `/turnos` | Admin |
| GET | `/turnos/con-trabajos` | Admin |
| GET | `/turnos/consumo` | Admin |
| DELETE | `/turnos` | Admin |

### Materiales

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/materiales` | Autenticado |
| GET | `/materiales/todos` | Admin |
| GET | `/materiales/totales-entradas` | Admin |
| GET | `/materiales/:id/entradas` | Admin |
| POST | `/materiales` | Admin |
| POST | `/materiales/:id/entrada` | Admin |
| PUT | `/materiales/:id` | Admin |
| DELETE | `/materiales/:id` | Admin |

### Clientes

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/clientes` | Autenticado |
| GET | `/clientes/todos` | Admin |
| POST | `/clientes` | Admin |
| PUT | `/clientes/:id` | Admin |
| PATCH | `/clientes/:id/toggle` | Admin |

### Tipos de tarea

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/tipos-tarea` | Autenticado |
| POST | `/tipos-tarea` | Admin |
| PUT | `/tipos-tarea/:id` | Admin |
| PATCH | `/tipos-tarea/:id/toggle` | Admin |

### Archivos

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/fotos/estado` | Público *(diagnóstico de almacenamiento)* |
| POST | `/fotos/upload` | Autenticado |
| POST | `/fotos/upload-video` | Autenticado |
| DELETE | `/fotos` | Autenticado |

---

## 12. Modelo de datos

Siete colecciones en MongoDB:

| Colección | Contenido |
|---|---|
| **usuarios** | nombre, apellido, email, contraseña cifrada, rol, cliente asociado |
| **trabajos** | ubicación GPS, calles, ítems ejecutados (tipo, medidas, superficie), materiales, fotos, estado operativo, estado administrativo, datos de certificación y facturación, cliente, turno |
| **turnos** | supervisor, fecha de inicio y fin, estado, materiales cargados, observaciones |
| **materiales_catalogo** | código, nombre, stock, unidad, tamaño, tipos de tarea asociados |
| **stock_entradas** | material, cantidad, fecha y descripción de cada ingreso |
| **tipos_tarea** | nombre, unidad de medida, activo |
| **clientes** | nombre, CUIT, contacto, teléfono, email, dirección, activo |

Todas las colecciones registran fecha de creación y modificación automáticamente. La colección `trabajos` tiene índices sobre usuario, estados y fecha de carga para acelerar las consultas.

---

## 13. Diseño mobile-first

La aplicación fue diseñada **partiendo del celular**, porque es donde se usa: operarios y supervisores cargando trabajos en la vía pública, con una mano, bajo luz solar directa.

- Botones grandes (mínimo 44 px de alto)
- Formularios en una sola columna, sin desplazamiento horizontal
- Alto contraste para legibilidad exterior
- Sin dependencia de mouse ni teclado físico
- Carga diferida de pantallas pesadas (mapa, panel, reportes) para ahorrar datos móviles

---

## 14. Scripts de mantenimiento

Ubicados en `back/scripts/`, se ejecutan con `node scripts/<archivo>.js`:

| Script | Función |
|---|---|
| `crear-usuario.js` | Crea un usuario administrador inicial |
| `hacer-admin.js` | Promueve un usuario existente a administrador |
| `limpiar-db.js` | Vacía la base de datos *(uso exclusivo en desarrollo)* |
| `test-r2.js` | Verifica la conexión con Cloudflare R2 |
| `migrar-cloudinary-a-r2.js` | Migración histórica de archivos entre proveedores |
| `actualizar-trabajos-importados.js` | Normaliza trabajos cargados por importación |

---

## 15. Consideraciones y estado actual

- **Sin suite de pruebas automatizadas.** La validación es manual sobre la aplicación en ejecución. Incorporar tests es la mejora recomendada de mayor impacto si el sistema va a seguir creciendo.
- **Almacenamiento único en Cloudflare R2.** No hay respaldo alternativo: si R2 no está configurado o no responde, la subida de archivos falla de forma controlada (`503`).
- **Respaldos de base de datos.** Se recomienda activar los backups automáticos de MongoDB Atlas.
- **Rotación de credenciales.** Al transferir el proyecto conviene regenerar `JWT_SECRET`, las claves de R2 y el usuario de MongoDB. Regenerar `JWT_SECRET` cierra todas las sesiones abiertas, lo cual es deseable en una transferencia.

---

*Documento generado el 2 de septiembre de 2026.*
