import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';

const NAV_LINKS = [
  { to: '/',               icon: 'bar-chart-line',  label: 'Panel',          roles: ['admin']                        },
  { to: '/turno',          icon: 'clock-history',   label: 'Turno activo',   roles: ['supervisor']                   },
  { to: '/lista',          icon: 'list-ul',          label: 'Lista',          roles: ['admin']                          },
  { to: '/mapa',           icon: 'map',              label: 'Mapa',           roles: ['admin']                        },
  { to: '/certificaciones',icon: 'patch-check',      label: 'Certificaciones',roles: ['admin']                        },
  { to: '/nuevo',          icon: 'plus-circle',      label: 'Nuevo trabajo',  roles: ['admin', 'supervisor']           },
  { to: '/usuarios',       icon: 'people',           label: 'Usuarios',       roles: ['admin']                        },
  { to: '/materiales',     icon: 'box-seam',         label: 'Materiales',     roles: ['admin']                        },
  { to: '/tipos-tarea',    icon: 'tags',             label: 'Tipos de tarea', roles: ['admin']                        },
  { to: '/cerrar-turno',   icon: 'door-closed',      label: 'Cerrar turno',   roles: ['supervisor']                   },
];

export default function PinturaNavbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);

  const { tema, toggleTema } = useTheme();
  const rol = localStorage.getItem('rol');
  const links = NAV_LINKS.filter((l) => l.roles.includes(rol));

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const cerrar = () => setAbierto(false);

  return (
    <>
      {/* ══════════════════════════════════════
          DESKTOP — Sidebar vertical (md+)
      ══════════════════════════════════════ */}
      <aside className="sidebar d-none d-md-flex flex-column">
        {/* Logo */}
        <div className="p-3 border-bottom">
          <Link to="/" onClick={cerrar}>
            <img src="/logocrear.jpeg" alt="CREAR" style={{ height: 40, objectFit: 'contain' }} />
          </Link>
        </div>

        {/* Links */}
        <nav className="flex-grow-1 py-2">
          {links.map(({ to, icon, label }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`sidebar-link${active ? ' active' : ''}`}
              >
                <i className={`bi bi-${icon} fs-5`}></i>
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Modo noche + Logout */}
        <div className="p-3 border-top d-flex flex-column gap-2">
          <button
            className="btn btn-outline-secondary w-100 d-flex align-items-center justify-content-center gap-2"
            onClick={toggleTema}
          >
            <i className={`bi bi-${tema === 'dark' ? 'sun' : 'moon-stars'}`}></i>
            <span>{tema === 'dark' ? 'Modo claro' : 'Modo noche'}</span>
          </button>
          <button
            className="btn btn-outline-danger w-100 d-flex align-items-center justify-content-center gap-2"
            onClick={handleLogout}
          >
            <i className="bi bi-box-arrow-right"></i>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════
          MOBILE — Top bar con hamburguesa
      ══════════════════════════════════════ */}
      <nav className="d-md-none navbar sticky-top border-bottom bg-white" style={{ zIndex: 300 }}>
        <div className="container-fluid px-3">
          <Link to="/" className="navbar-brand p-0 me-2" onClick={cerrar}>
            <img src="/logocrear.jpeg" alt="CREAR" style={{ height: 36, objectFit: 'contain' }} />
          </Link>
          <button
            className="navbar-toggler border-0 ms-auto"
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-label="Menú"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
        </div>

        {/* Menú desplegable mobile */}
        {abierto && (
          <div className="border-top bg-white w-100 px-3 py-2">
            {links.map(({ to, icon, label }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={cerrar}
                  className={`d-flex align-items-center gap-2 px-3 py-2 rounded text-decoration-none mb-1 ${
                    active ? 'fw-semibold text-dark bg-light' : 'text-secondary'
                  }`}
                >
                  <i className={`bi bi-${icon}`}></i>
                  {label}
                </Link>
              );
            })}
            <div className="border-top pt-2 mt-1 d-flex flex-column gap-2">
              <button
                className="btn btn-outline-secondary btn-sm w-100 d-flex align-items-center justify-content-center gap-2"
                onClick={toggleTema}
              >
                <i className={`bi bi-${tema === 'dark' ? 'sun' : 'moon-stars'}`}></i>
                <span>{tema === 'dark' ? 'Modo claro' : 'Modo noche'}</span>
              </button>
              <button
                className="btn btn-outline-danger btn-sm w-100 d-flex align-items-center justify-content-center gap-2"
                onClick={handleLogout}
              >
                <i className="bi bi-box-arrow-right"></i>
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
