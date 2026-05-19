import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children, roles }) => {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;

  if (roles) {
    const rol = localStorage.getItem("rol");
    const esDev = import.meta.env.DEV;
    if (!esDev && !roles.includes(rol)) {
      return <Navigate to="/lista" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
