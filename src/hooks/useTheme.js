import { useState } from 'react';

export function useTheme() {
  const [tema, setTema] = useState(() => {
    const guardado = localStorage.getItem('tema') || 'light';
    document.documentElement.setAttribute('data-bs-theme', guardado);
    return guardado;
  });

  const toggleTema = () => {
    setTema((t) => {
      const nuevo = t === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-bs-theme', nuevo);
      localStorage.setItem('tema', nuevo);
      return nuevo;
    });
  };

  return { tema, toggleTema };
}
