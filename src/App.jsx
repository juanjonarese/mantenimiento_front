import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import NuevoTrabajoPage from "./pages/NuevoTrabajoPage";
import ListaPage from "./pages/ListaPage";
import DetallePage from "./pages/DetallePage";
import PinturaNavbar from "./components/PinturaNavbar";
import OfflineBadge from "./components/OfflineBadge";
import LoginScreen from "./pages/LoginScreen";
import ProtectedRoute from "./components/ProtectedRoute";

const MapaPage            = lazy(() => import("./pages/MapaPage"));
const PanelPage           = lazy(() => import("./pages/PanelPage"));
const CertificacionesPage = lazy(() => import("./pages/CertificacionesPage"));
const UsuariosPage        = lazy(() => import("./pages/UsuariosPage"));
const MaterialesPage      = lazy(() => import("./pages/MaterialesPage"));
const TiposTareaPage      = lazy(() => import("./pages/TiposTareaPage"));
const TurnoPage           = lazy(() => import("./pages/TurnoPage"));
const CerrarTurnoPage     = lazy(() => import("./pages/CerrarTurnoPage"));

const Spinner = () => (
  <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
    <div className="spinner-border text-primary"></div>
  </div>
);

function Layout({ children, fullWidth = false }) {
  return (
    <>
      <PinturaNavbar />
      <div className="main-content-wrapper">
        <OfflineBadge />
        <main>
          {fullWidth ? children : <div className="pintura-content">{children}</div>}
        </main>
      </div>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />

        {/* Admin only */}
        <Route path="/" element={
          <ProtectedRoute roles={['admin']}><Layout fullWidth>
            <Suspense fallback={<Spinner />}><PanelPage /></Suspense>
          </Layout></ProtectedRoute>
        } />
        <Route path="/mapa" element={
          <ProtectedRoute roles={['admin']}><Layout fullWidth>
            <Suspense fallback={<Spinner />}><MapaPage /></Suspense>
          </Layout></ProtectedRoute>
        } />
        <Route path="/certificaciones" element={
          <ProtectedRoute roles={['admin']}><Layout fullWidth>
            <Suspense fallback={<Spinner />}><CertificacionesPage /></Suspense>
          </Layout></ProtectedRoute>
        } />
        <Route path="/usuarios" element={
          <ProtectedRoute roles={['admin']}><Layout fullWidth>
            <Suspense fallback={<Spinner />}><UsuariosPage /></Suspense>
          </Layout></ProtectedRoute>
        } />
        <Route path="/materiales" element={
          <ProtectedRoute roles={['admin']}><Layout fullWidth>
            <Suspense fallback={<Spinner />}><MaterialesPage /></Suspense>
          </Layout></ProtectedRoute>
        } />
        <Route path="/tipos-tarea" element={
          <ProtectedRoute roles={['admin']}><Layout fullWidth>
            <Suspense fallback={<Spinner />}><TiposTareaPage /></Suspense>
          </Layout></ProtectedRoute>
        } />

        {/* Supervisor */}
        <Route path="/turno" element={
          <ProtectedRoute roles={['supervisor']}><Layout>
            <Suspense fallback={<Spinner />}><TurnoPage /></Suspense>
          </Layout></ProtectedRoute>
        } />
        <Route path="/cerrar-turno" element={
          <ProtectedRoute roles={['supervisor']}><Layout>
            <Suspense fallback={<Spinner />}><CerrarTurnoPage /></Suspense>
          </Layout></ProtectedRoute>
        } />

        {/* Admin + Supervisor */}
        <Route path="/nuevo" element={<ProtectedRoute roles={['admin','supervisor']}><Layout><NuevoTrabajoPage /></Layout></ProtectedRoute>} />

        {/* Admin only */}
        <Route path="/editar/:id" element={<ProtectedRoute roles={['admin']}><Layout><NuevoTrabajoPage /></Layout></ProtectedRoute>} />
        <Route path="/lista" element={<ProtectedRoute roles={['admin']}><Layout fullWidth><ListaPage /></Layout></ProtectedRoute>} />
        <Route path="/detalle/:id" element={<ProtectedRoute roles={['admin']}><Layout><DetallePage /></Layout></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/lista" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
