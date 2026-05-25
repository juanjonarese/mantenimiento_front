import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children, roles }) => {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;

  if (roles) {
    const rol = localStorage.getItem("rol");
    if (!roles.includes(rol)) {
      const home = rol === 'supervisor' ? '/turno' : '/lista';
      return <Navigate to={home} replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
