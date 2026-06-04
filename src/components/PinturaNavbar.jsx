import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

const NAV_LINKS = [
  { to: '/',               icon: 'bar-chart-line',  label: 'Panel',          roles: ['admin']                        },
  { to: '/turno',          icon: 'clock-history',   label: 'Turno activo',   roles: ['supervisor']                   },
  { to: '/lista',          icon: 'list-ul',          label: 'Lista',          roles: ['admin', 'supervisor', 'cliente']  },
  { to: '/mapa',           icon: 'map',              label: 'Mapa',           roles: ['admin', 'cliente']              },
  { to: '/certificaciones',icon: 'patch-check',      label: 'Certificaciones',roles: ['admin']                        },
  { to: '/nuevo',          icon: 'plus-circle',      label: 'Nuevo trabajo',  roles: ['admin', 'supervisor']           },
  { to: '/usuarios',       icon: 'people',           label: 'Usuarios',       roles: ['admin']                        },
  { to: '/materiales',     icon: 'box-seam',         label: 'Materiales',     roles: ['admin']                        },
  { to: '/tipos-tarea',    icon: 'tags',             label: 'Tipos de tarea', roles: ['admin']                        },
  { to: '/clientes',       icon: 'person-vcard',     label: 'Clientes',       roles: ['admin']                        },
  { to: '/turnos',         icon: 'clock-history',    label: 'Turnos',         roles: ['admin']                        },
  { to: '/cerrar-turno',   icon: 'door-closed',      label: 'Cerrar turno',   roles: ['supervisor']                   },
];

export default function PinturaNavbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);

  const rol = localStorage.getItem('rol');
  const links = NAV_LINKS.filter((l) => l.roles.includes(rol));

  const handleLogout = async () => {
    const turnoId = localStorage.getItem('turnoId');
    if (rol === 'supervisor' && turnoId) {
      await Swal.fire({
        title: 'Turno activo',
        text: 'Tenés un turno abierto. Cerrá el turno antes de cerrar sesión.',
        icon: 'warning',
        confirmButtonColor: '#dc3545',
        confirmButtonText: 'Ir a cerrar turno',
      });
      navigate('/cerrar-turno');
      return;
    }
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

        {/* Logout */}
        <div className="border-top" style={{ padding: '8px' }}>
          <button
            className="btn btn-outline-danger w-100 d-flex align-items-center justify-content-center gap-2"
            style={{ borderRadius: 8, fontSize: '0.9rem' }}
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
            <div className="border-top pt-2 mt-1">
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
