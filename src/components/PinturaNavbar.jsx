import { Link, useLocation } from 'react-router-dom';

export default function PinturaNavbar() {
  const { pathname } = useLocation();

  const navLink = (to, icon, label) => {
    const active = pathname === to;
    return (
      <Link
        to={to}
        className={`btn btn-sm d-flex align-items-center gap-1 ${active ? 'btn-light' : 'btn-outline-light'}`}
      >
        <i className={`bi bi-${icon}`}></i>
        <span className="d-none d-sm-inline">{label}</span>
      </Link>
    );
  };

  return (
    <nav className="navbar navbar-dark bg-success sticky-top">
      <div className="container" style={{ maxWidth: 580 }}>
        <Link className="navbar-brand fw-bold py-1 d-flex align-items-center gap-2" to="/">
          <i className="bi bi-brush-fill"></i>
          <span>Pintura Vial</span>
        </Link>
        <div className="d-flex align-items-center gap-1 gap-sm-2">
          {navLink('/nuevo', 'plus-circle', 'Nuevo')}
          {navLink('/lista', 'list-ul', 'Lista')}
          {navLink('/mapa', 'map', 'Mapa')}
          {navLink('/panel', 'bar-chart-line', 'Panel')}
        </div>
      </div>
    </nav>
  );
}
