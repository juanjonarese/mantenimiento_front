import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function PinturaNavbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const email = localStorage.getItem('email') || '';
  const nombreCorto = email.split('@')[0];

  function handleLogout() {
    localStorage.clear();
    navigate('/login');
  }

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
          <div className="dropdown">
            <button
              className="btn btn-sm btn-outline-light dropdown-toggle d-flex align-items-center gap-1"
              data-bs-toggle="dropdown"
            >
              <i className="bi bi-person-circle"></i>
              <span className="d-none d-md-inline">{nombreCorto}</span>
            </button>
            <ul className="dropdown-menu dropdown-menu-end shadow">
              <li>
                <span className="dropdown-item-text small text-muted">{email}</span>
              </li>
              <li><hr className="dropdown-divider my-1" /></li>
              {/* <li>
                <Link className="dropdown-item d-flex align-items-center gap-2" to="/usuarios">
                  <i className="bi bi-people"></i>Gestión de usuarios
                </Link>
              </li>
              <li><hr className="dropdown-divider my-1" /></li> */}
              <li>
                <button className="dropdown-item text-danger d-flex align-items-center gap-2" onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right"></i>Cerrar sesión
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </nav>
  );
}
