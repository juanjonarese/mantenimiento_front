import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./index.css";

// Limpia caché de chunks JS viejos para evitar errores de módulo no encontrado tras deploys
if ("caches" in window) {
  caches.keys().then((names) => names.forEach((name) => caches.delete(name)));
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
