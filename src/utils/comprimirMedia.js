const MAX_ANCHO_PX = 1280;   // ancho máximo de imagen
const CALIDAD_JPEG = 0.75;   // 75% calidad — buen equilibrio peso/calidad
const MAX_VIDEO_MB = 50;     // límite de video en MB

function comprimirImagen(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;

        // Reducir si supera el ancho máximo
        if (width > MAX_ANCHO_PX) {
          height = Math.round((height * MAX_ANCHO_PX) / width);
          width = MAX_ANCHO_PX;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);

        const data = canvas.toDataURL('image/jpeg', CALIDAD_JPEG);
        const pesoOriginalKB = Math.round(file.size / 1024);
        const pesoFinalKB = Math.round((data.length * 3) / 4 / 1024);

        resolve({
          nombre: file.name.replace(/\.[^.]+$/, '.jpg'),
          tipo: 'image/jpeg',
          data,
          subido: false,
          pesoOriginalKB,
          pesoFinalKB,
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function procesarVideo(file) {
  const mb = file.size / (1024 * 1024);
  if (mb > MAX_VIDEO_MB) {
    return Promise.reject(
      new Error(`El video "${file.name}" pesa ${mb.toFixed(0)} MB. Máximo permitido: ${MAX_VIDEO_MB} MB.`)
    );
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      resolve({
        nombre: file.name,
        tipo: file.type,
        data: e.target.result,
        subido: false,
        pesoFinalKB: Math.round(file.size / 1024),
      });
    };
    reader.readAsDataURL(file);
  });
}

export async function comprimirMedia(file) {
  if (file.type.startsWith('image/')) return comprimirImagen(file);
  if (file.type.startsWith('video/')) return procesarVideo(file);
  throw new Error(`Tipo de archivo no soportado: ${file.type}`);
}
