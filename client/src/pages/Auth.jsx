import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";

export default function Auth({ mode }) {
  const { login, register } = useAuth();
  const isLogin = mode === "login";
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await (isLogin ? login({ email: form.email, password: form.password }) : register(form));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <h1 className="brand">Taskboard</h1>
      <p className="muted">{isLogin ? "Sign in to see your tasks." : "Create an account to start tracking tasks."}</p>
      <form onSubmit={submit} className="stack">
        {!isLogin && (
          <label>Name<input value={form.name} onChange={set("name")} autoComplete="name" required /></label>
        )}
        <label>Email<input type="email" value={form.email} onChange={set("email")} autoComplete="email" required /></label>
        <label>Password<input type="password" minLength={6} value={form.password} onChange={set("password")} autoComplete={isLogin ? "current-password" : "new-password"} required /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? "Please wait…" : isLogin ? "Sign in" : "Create account"}</button>
      </form>
      <p className="muted">
        {isLogin ? "No account yet? " : "Already registered? "}
        <Link to={isLogin ? "/register" : "/login"}>{isLogin ? "Create one" : "Sign in"}</Link>
      </p>
    </main>
  );
}
