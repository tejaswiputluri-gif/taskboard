import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import Auth from "./pages/Auth.jsx";
import Tasks from "./pages/Tasks.jsx";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="center muted">Loading…</p>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Auth mode="login" />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Auth mode="register" />} />
      <Route path="/" element={<Protected><Tasks /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
