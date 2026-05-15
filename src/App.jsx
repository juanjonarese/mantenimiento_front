import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import NuevoTrabajoPage from "./pages/NuevoTrabajoPage";
import ListaPage from "./pages/ListaPage";
import DetallePage from "./pages/DetallePage";
import PinturaNavbar from "./components/PinturaNavbar";
import OfflineBadge from "./components/OfflineBadge";
import LoginScreen from "./pages/LoginScreen";
import ProtectedRoute from "./components/ProtectedRoute";

const MapaPage  = lazy(() => import("./pages/MapaPage"));
const PanelPage = lazy(() => import("./pages/PanelPage"));

const Spinner = () => (
  <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
    <div className="spinner-border text-primary"></div>
  </div>
);

function Layout({ children, fullWidth = false }) {
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
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/" element={<ProtectedRoute><Layout><DashboardPage /></Layout></ProtectedRoute>} />
        <Route path="/nuevo" element={<ProtectedRoute><Layout><NuevoTrabajoPage /></Layout></ProtectedRoute>} />
        <Route path="/editar/:id" element={<ProtectedRoute><Layout><NuevoTrabajoPage /></Layout></ProtectedRoute>} />
        <Route path="/lista" element={<ProtectedRoute><Layout><ListaPage /></Layout></ProtectedRoute>} />
        <Route path="/detalle/:id" element={<ProtectedRoute><Layout><DetallePage /></Layout></ProtectedRoute>} />
        <Route path="/mapa" element={
          <ProtectedRoute><Layout fullWidth>
            <Suspense fallback={<Spinner />}><MapaPage /></Suspense>
          </Layout></ProtectedRoute>
        } />
        <Route path="/panel" element={
          <ProtectedRoute><Layout fullWidth>
            <Suspense fallback={<Spinner />}><PanelPage /></Suspense>
          </Layout></ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
