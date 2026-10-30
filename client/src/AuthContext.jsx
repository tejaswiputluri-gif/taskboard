import { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api.js";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api.me().then((r) => setUser(r.user)).catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);

  const authenticate = async (fn, body) => {
    const { token, user } = await fn(body);
    setToken(token);
    setUser(user);
  };

  const value = {
    user,
    loading,
    login: (b) => authenticate(api.login, b),
    register: (b) => authenticate(api.register, b),
    logout: () => { setToken(null); setUser(null); },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
