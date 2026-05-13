import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginScreen from "./pages/LoginScreen";
import RegistroPage from "./pages/RegistroPage";
import UsuariosPage from "./pages/UsuariosPage";
import DashboardPage from "./pages/DashboardPage";
import NuevoTrabajoPage from "./pages/NuevoTrabajoPage";
import ListaPage from "./pages/ListaPage";
import DetallePage from "./pages/DetallePage";
import ProtectedRoute from "./components/ProtectedRoute";
import PinturaNavbar from "./components/PinturaNavbar";
import OfflineBadge from "./components/OfflineBadge";

const MapaPage   = lazy(() => import("./pages/MapaPage"));
const PanelPage  = lazy(() => import("./pages/PanelPage"));

function PinturaLayout({ children, fullWidth = false }) {
  return (
    <>
      <OfflineBadge />
      <PinturaNavbar />
      <main>
        {fullWidth ? children : <div className="pintura-content">{children}</div>}
      </main>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Públicas */}
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/registro" element={<RegistroPage />} />

        {/* Pintura Vial - rutas principales */}
        <Route path="/" element={
          <ProtectedRoute>
            <PinturaLayout><DashboardPage /></PinturaLayout>
          </ProtectedRoute>
        } />
        <Route path="/nuevo" element={
          <ProtectedRoute>
            <PinturaLayout><NuevoTrabajoPage /></PinturaLayout>
          </ProtectedRoute>
        } />
        <Route path="/editar/:id" element={
          <ProtectedRoute>
            <PinturaLayout><NuevoTrabajoPage /></PinturaLayout>
          </ProtectedRoute>
        } />
        <Route path="/lista" element={
          <ProtectedRoute>
            <PinturaLayout><ListaPage /></PinturaLayout>
          </ProtectedRoute>
        } />
        <Route path="/detalle/:id" element={
          <ProtectedRoute>
            <PinturaLayout><DetallePage /></PinturaLayout>
          </ProtectedRoute>
        } />

        <Route path="/mapa" element={
          <ProtectedRoute>
            <PinturaLayout fullWidth>
              <Suspense fallback={
                <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
                  <div className="spinner-border text-primary"></div>
                </div>
              }>
                <MapaPage />
              </Suspense>
            </PinturaLayout>
          </ProtectedRoute>
        } />

        <Route path="/panel" element={
          <ProtectedRoute>
            <PinturaLayout fullWidth>
              <Suspense fallback={
                <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
                  <div className="spinner-border text-primary"></div>
                </div>
              }>
                <PanelPage />
              </Suspense>
            </PinturaLayout>
          </ProtectedRoute>
        } />

        {/* Admin - gestión de usuarios */}
        <Route path="/usuarios" element={
          <ProtectedRoute>
            <UsuariosPage />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
