import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { importarTrabajos } from '../services/api';

const MESES = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

function parseFecha(val) {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    try {
      const p = XLSX.SSF.parse_date_code(val);
      if (p) return new Date(p.y, p.m - 1, p.d || 15);
    } catch { /* fall through */ }
  }
  const s = String(val).trim().toLowerCase();
  const m = s.match(/^([a-záéíóú]+)-(\d{2,4})$/);
  if (m) {
    const mes = MESES[m[1]];
    if (mes !== undefined) {
      const year = m[2].length <= 2 ? 2000 + parseInt(m[2]) : parseInt(m[2]);
      return new Date(year, mes, 15);
    }
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

function parseCoordsStr(str) {
  const m = String(str || '').trim().match(/^(-?\d+(?:[.,]\d+)?)\s*[,;]\s*(-?\d+(?:[.,]\d+)?)$/);
  if (!m) return null;
  const lat = parseFloat(m[1].replace(',', '.'));
  const lng = parseFloat(m[2].replace(',', '.'));
  return isNaN(lat) || isNaN(lng) ? null : { lat, lng };
}

function parsearInterseccion(str) {
  const s = String(str || '').trim();
  if (!s) return { calle1: '', calle2: '', coords: null };
  const coords = parseCoordsStr(s);
  if (coords) return { calle1: '', calle2: '', coords };
  const partes = s.split(/\s+y\s+/i);
  return {
    calle1: (partes[0] || s).trim(),
    calle2: (partes[1] || '').trim(),
    coords: null,
  };
}

function numVal(v) {
  if (v === null || v === undefined || v === '') return 0;
  return parseFloat(String(v).replace(',', '.')) || 0;
}

function norm(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '');
}

function findCol(headers, ...terms) {
  return headers.find((h) => terms.some((t) => norm(h).includes(norm(t))));
}

function mapEstado(str) {
  const s = norm(str);
  if (s.includes('termin') || s.includes('finali')) return 'Terminado';
  if (s.includes('proceso')) return 'En proceso';
  return 'Sin iniciar';
}

function mapCertif(str) {
  const s = String(str || '').trim().toUpperCase();
  return ['SI', 'SÍ', 'YES', '1'].includes(s) ? 'Certificado' : 'Sin certificar';
}

async function reverseGeocode(lat, lng) {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`,
      { headers: { 'User-Agent': 'PinturaVialApp/1.0' } }
    );
    if (!r.ok) return '';
    const data = await r.json();
    const a = data.address || {};
    return a.road || a.pedestrian || a.path || data.display_name?.split(',')[0] || '';
  } catch {
    return '';
  }
}

export default function ImportarExcelModal({ onClose, onImportado }) {
  const [step, setStep] = useState('idle');
  const [filas, setFilas] = useState([]);
  const [progreso, setProgreso] = useState({ current: 0, total: 0, texto: '' });
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);
  const fileRef = useRef();

  async function procesarArchivo(file) {
    setError('');
    setStep('procesando');
    setProgreso({ current: 0, total: 0, texto: 'Leyendo archivo...' });

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!rows.length) {
        setError('El archivo está vacío o no tiene encabezados reconocibles.');
        setStep('idle');
        return;
      }

      const headers = Object.keys(rows[0]);
      const COL = {
        fecha:    findCol(headers, 'fecha'),
        inter:    findCol(headers, 'intersec', 'calles', 'interseccion'),
        lat:      findCol(headers, 'latitud', 'lat'),
        lng:      findCol(headers, 'longitud', 'lon', 'lng'),
        sendas:   findCol(headers, 'senda'),
        rampas:   findCol(headers, 'rampa'),
        cordones: findCol(headers, 'cordon'),
        estado:   findCol(headers, 'estado'),
        certif:   findCol(headers, 'certif'),
      };

      const parsed = rows.map((row) => {
        const inter = parsearInterseccion(row[COL.inter]);
        const latExcel = numVal(row[COL.lat]);
        const lngExcel = numVal(row[COL.lng]);

        const lat = latExcel !== 0 ? latExcel : (inter.coords?.lat ?? 0);
        const lng = lngExcel !== 0 ? lngExcel : (inter.coords?.lng ?? 0);
        const needsGeocode = !inter.calle1 && (lat !== 0 || lng !== 0);

        const sendas   = numVal(row[COL.sendas]);
        const rampas   = numVal(row[COL.rampas]);
        const cordones = numVal(row[COL.cordones]);

        const items = [];
        if (sendas   > 0) items.push({ tipoTrabajo: 'SENDAS',   superficie: sendas });
        if (rampas   > 0) items.push({ tipoTrabajo: 'RAMPAS',   superficie: rampas });
        if (cordones > 0) items.push({ tipoTrabajo: 'CORDONES', superficie: cordones });

        return {
          fechaCarga:      parseFecha(row[COL.fecha]),
          calle1:          inter.calle1,
          calle2:          inter.calle2,
          lat,
          lng,
          needsGeocode,
          items,
          superficie:      sendas + rampas + cordones,
          estadoOperativo: mapEstado(row[COL.estado]),
          estadoAdmin:     mapCertif(row[COL.certif]),
        };
      });

      const toGeocode = parsed.filter((f) => f.needsGeocode);
      if (toGeocode.length > 0) {
        setProgreso({ current: 0, total: toGeocode.length, texto: 'Geocodificando intersecciones...' });
        for (let i = 0; i < toGeocode.length; i++) {
          const f = toGeocode[i];
          const road = await reverseGeocode(f.lat, f.lng);
          f.calle1 = road || `${f.lat}, ${f.lng}`;
          f.needsGeocode = false;
          setProgreso((p) => ({ ...p, current: i + 1 }));
          if (i < toGeocode.length - 1) {
            await new Promise((r) => setTimeout(r, 1100));
          }
        }
      }

      setFilas(parsed);
      setStep('preview');
    } catch (e) {
      console.error(e);
      setError('Error al leer el archivo. Verificá que sea un Excel (.xlsx) válido.');
      setStep('idle');
    }
  }

  async function handleImportar() {
    setStep('importando');
    try {
      const trabajos = filas.map((f) => ({
        fechaCarga:      f.fechaCarga,
        calle1:          f.calle1 || 'Sin nombre',
        calle2:          f.calle2 || '-',
        lat:             f.lat,
        lng:             f.lng,
        items:           f.items,
        superficie:      f.superficie,
        estadoOperativo: f.estadoOperativo,
        estadoAdmin:     f.estadoAdmin,
        usuario:         'importado',
      }));
      const res = await importarTrabajos(trabajos);
      setResultado(res);
      setStep('listo');
    } catch (e) {
      setError(e.message);
      setStep('preview');
    }
  }

  const pct = progreso.total > 0 ? Math.round((progreso.current / progreso.total) * 100) : 0;
  const bloqueado = step === 'procesando' || step === 'importando';

  return (
    <div
      className="modal d-block"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !bloqueado) onClose(); }}
    >
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">

          <div className="modal-header">
            <h5 className="modal-title">
              <i className="bi bi-file-earmark-excel me-2 text-success"></i>
              Importar desde Excel
            </h5>
            {!bloqueado && (
              <button type="button" className="btn-close" onClick={onClose}></button>
            )}
          </div>

          <div className="modal-body">

            {/* ── idle: seleccionar archivo ── */}
            {step === 'idle' && (
              <div className="text-center py-4 px-2">
                <i className="bi bi-file-earmark-spreadsheet display-3 text-success d-block mb-3"></i>
                <p className="text-muted mb-1 small">El archivo debe tener estas columnas:</p>
                <p className="fw-semibold small mb-4">
                  Fecha · INTERSECCIÓN DE CALLES · Latitud · Longitud · SENDAS · RAMPAS · CORDONES · ESTADO · CERTIFICADO
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="d-none"
                  onChange={(e) => e.target.files[0] && procesarArchivo(e.target.files[0])}
                />
                <button className="btn btn-success btn-lg px-4" onClick={() => fileRef.current.click()}>
                  <i className="bi bi-folder2-open me-2"></i>Seleccionar archivo
                </button>
                {error && <div className="alert alert-danger mt-3 text-start">{error}</div>}
              </div>
            )}

            {/* ── procesando: parsing + geocoding ── */}
            {step === 'procesando' && (
              <div className="text-center py-5">
                <div className="spinner-border text-success mb-3" style={{ width: 48, height: 48 }}></div>
                <p className="fw-semibold">{progreso.texto}</p>
                {progreso.total > 0 && (
                  <>
                    <p className="text-muted small mb-2">
                      {progreso.current} de {progreso.total} intersecciones geocodificadas
                    </p>
                    <div className="progress mx-auto" style={{ maxWidth: 320, height: 10 }}>
                      <div
                        className="progress-bar progress-bar-striped progress-bar-animated bg-success"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
                      Esto puede tardar {progreso.total} segundo{progreso.total !== 1 ? 's' : ''} (límite de Nominatim)
                    </p>
                  </>
                )}
              </div>
            )}

            {/* ── preview: tabla de revisión ── */}
            {step === 'preview' && (
              <>
                <div className="alert alert-success d-flex align-items-center gap-2 mb-3 py-2">
                  <i className="bi bi-check-circle-fill flex-shrink-0"></i>
                  <span>
                    <strong>{filas.length}</strong> filas procesadas. Revisá los datos antes de confirmar.
                  </span>
                </div>
                {error && <div className="alert alert-danger py-2">{error}</div>}
                <div className="table-responsive">
                  <table className="table table-sm table-bordered table-hover align-middle mb-0" style={{ fontSize: 12 }}>
                    <thead className="table-light">
                      <tr>
                        <th>#</th>
                        <th>Fecha</th>
                        <th>Calle 1</th>
                        <th>Calle 2</th>
                        <th>Lat</th>
                        <th>Lng</th>
                        <th className="text-end">Sendas m²</th>
                        <th className="text-end">Rampas m²</th>
                        <th className="text-end">Cordones m²</th>
                        <th>Estado</th>
                        <th>Certif.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((f, i) => (
                        <tr key={i}>
                          <td className="text-muted">{i + 1}</td>
                          <td className="text-nowrap">
                            {f.fechaCarga instanceof Date
                              ? f.fechaCarga.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })
                              : '—'}
                          </td>
                          <td className="fw-semibold">
                            {f.calle1 || <span className="text-warning">sin nombre</span>}
                          </td>
                          <td>{f.calle2 || <span className="text-muted">—</span>}</td>
                          <td className="text-muted">{f.lat || '—'}</td>
                          <td className="text-muted">{f.lng || '—'}</td>
                          <td className="text-end">{f.items.find((x) => x.tipoTrabajo === 'SENDAS')?.superficie ?? '—'}</td>
                          <td className="text-end">{f.items.find((x) => x.tipoTrabajo === 'RAMPAS')?.superficie ?? '—'}</td>
                          <td className="text-end">{f.items.find((x) => x.tipoTrabajo === 'CORDONES')?.superficie ?? '—'}</td>
                          <td>
                            <span className={`badge bg-${f.estadoOperativo === 'Terminado' ? 'success' : 'secondary'}`}>
                              {f.estadoOperativo}
                            </span>
                          </td>
                          <td>
                            <span className={`badge bg-${f.estadoAdmin === 'Certificado' ? 'success' : 'warning text-dark'}`}>
                              {f.estadoAdmin}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="table-light fw-semibold">
                      <tr>
                        <td colSpan={6} className="small">Total</td>
                        <td className="text-end small">
                          {filas.reduce((a, f) => a + (f.items.find((x) => x.tipoTrabajo === 'SENDAS')?.superficie || 0), 0).toFixed(2)}
                        </td>
                        <td className="text-end small">
                          {filas.reduce((a, f) => a + (f.items.find((x) => x.tipoTrabajo === 'RAMPAS')?.superficie || 0), 0).toFixed(2)}
                        </td>
                        <td className="text-end small">
                          {filas.reduce((a, f) => a + (f.items.find((x) => x.tipoTrabajo === 'CORDONES')?.superficie || 0), 0).toFixed(2)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}

            {/* ── importando ── */}
            {step === 'importando' && (
              <div className="text-center py-5">
                <div className="spinner-border text-primary mb-3" style={{ width: 48, height: 48 }}></div>
                <p className="fw-semibold">Guardando {filas.length} trabajos...</p>
              </div>
            )}

            {/* ── listo ── */}
            {step === 'listo' && resultado && (
              <div className="text-center py-4">
                <i className="bi bi-check-circle-fill display-3 text-success d-block mb-3"></i>
                <h5>¡Importación completada!</h5>
                <p className="text-muted">
                  <strong>{resultado.importados}</strong> trabajos importados correctamente.
                  {resultado.fallidos > 0 && (
                    <span className="text-warning d-block small mt-1">
                      {resultado.fallidos} registros fallaron (posibles duplicados).
                    </span>
                  )}
                </p>
              </div>
            )}

          </div>

          <div className="modal-footer">
            {step === 'idle' && (
              <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            )}
            {step === 'preview' && (
              <>
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => { setFilas([]); setError(''); setStep('idle'); }}
                >
                  <i className="bi bi-arrow-left me-1"></i>Otro archivo
                </button>
                <button
                  className="btn btn-success btn-lg"
                  onClick={handleImportar}
                  disabled={filas.length === 0}
                >
                  <i className="bi bi-cloud-upload me-2"></i>
                  Importar {filas.length} trabajos
                </button>
              </>
            )}
            {step === 'listo' && (
              <button
                className="btn btn-primary"
                onClick={() => { onImportado(); onClose(); }}
              >
                <i className="bi bi-check me-1"></i>Cerrar y actualizar lista
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
