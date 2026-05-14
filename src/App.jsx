import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import NuevoTrabajoPage from "./pages/NuevoTrabajoPage";
import ListaPage from "./pages/ListaPage";
import DetallePage from "./pages/DetallePage";
import PinturaNavbar from "./components/PinturaNavbar";
import OfflineBadge from "./components/OfflineBadge";
import LoginScreen from "./pages/LoginScreen";

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
        <Route path="/" element={<Layout><DashboardPage /></Layout>} />
        <Route path="/nuevo" element={<Layout><NuevoTrabajoPage /></Layout>} />
        <Route path="/editar/:id" element={<Layout><NuevoTrabajoPage /></Layout>} />
        <Route path="/lista" element={<Layout><ListaPage /></Layout>} />
        <Route path="/detalle/:id" element={<Layout><DetallePage /></Layout>} />
        <Route path="/mapa" element={
          <Layout fullWidth>
            <Suspense fallback={<Spinner />}><MapaPage /></Suspense>
          </Layout>
        } />
        <Route path="/panel" element={
          <Layout fullWidth>
            <Suspense fallback={<Spinner />}><PanelPage /></Suspense>
          </Layout>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
