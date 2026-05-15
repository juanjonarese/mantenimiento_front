import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function PinturaNavbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const esAdmin = localStorage.getItem('rol') === 'admin' || import.meta.env.DEV;

  const navLink = (to, icon, label) => {
    const active = pathname === to;
    return (
      <Link
        to={to}
        className={`btn btn-sm d-flex align-items-center gap-1 ${active ? 'btn-dark' : 'btn-outline-secondary'}`}
      >
        <i className={`bi bi-${icon}`}></i>
        <span className="d-none d-sm-inline">{label}</span>
      </Link>
    );
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  return (
    <nav className="navbar sticky-top border-bottom" style={{ backgroundColor: '#fff' }}>
      <div className="container d-flex align-items-center gap-1 gap-sm-2" style={{ maxWidth: 580 }}>
        <Link to="/" className="me-1">
          <img src="/logocrear.jpeg" alt="CREAR" style={{ height: 36, objectFit: 'contain' }} />
        </Link>
        {navLink('/nuevo', 'plus-circle', 'Nuevo')}
        {navLink('/lista', 'list-ul', 'Lista')}
        {navLink('/mapa', 'map', 'Mapa')}
        {navLink('/panel', 'bar-chart-line', 'Panel')}
        {esAdmin && navLink('/certificaciones', 'patch-check', 'Certif.')}
        {esAdmin && navLink('/usuarios', 'people', 'Usuarios')}
        <button
          className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 ms-auto"
          onClick={handleLogout}
        >
          <i className="bi bi-box-arrow-right"></i>
          <span className="d-none d-sm-inline">Salir</span>
        </button>
      </div>
    </nav>
  );
}
