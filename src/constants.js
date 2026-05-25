export const TIPOS_TRABAJO = [
  'Senda peatonal',
  'Cordón',
  'Rampa',
  'Ochava',
  'Flecha',
  'Línea divisoria',
  'Estacionamiento',
  'Otros',
];

export const ESTADOS_OPERATIVO = ['Sin iniciar', 'En proceso', 'Terminado'];

export const ESTADOS_ADMIN = ['Sin certificar', 'En revisión', 'Certificado', 'Rechazado', 'Facturado'];

export const COLORES_ESTADO_OP = {
  'Sin iniciar': 'secondary',
  'En proceso': 'warning',
  'Terminado': 'success',
  'Finalizado': 'success', // backward compat datos viejos
};

export const COLORES_ESTADO_ADMIN = {
  'Sin certificar': 'secondary',
  'En revisión': 'warning',
  'Certificado': 'success',
  'Rechazado': 'danger',
  'Facturado': 'info',
};
