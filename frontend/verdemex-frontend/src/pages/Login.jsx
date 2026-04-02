import { useState } from "react";
import api from "../api";
import "../styles/Login.css";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data } = await api.post("/api/auth/login", { username, password });
      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("user", JSON.stringify(data.user));
      onLogin(data.token, data.user);
    } catch (err) {
      setError(err.response?.data?.error || "Error de login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="loginContainer">
      <div className="loginBox">
        <div className="loginHeader">
          <h1>🍃 Verdemex</h1>
          <p>Control de Residuos</p>
        </div>

        {error && <div className="errorAlert">{error}</div>}
        
        <form onSubmit={handleSubmit} className="loginForm">
          <div className="formGroup">
            <label>Usuario</label>
            <input
              type="text"
              placeholder="Ingresa tu usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="formGroup">
            <label>Contraseña</label>
            <input
              type="password"
              placeholder="Ingresa tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button type="submit" disabled={loading} className="loginButton">
            {loading ? "Verificando..." : "Ingresar"}
          </button>
        </form>

        <div className="loginFooter">
          <small>© 2026 Verdemex - Sistema de Control de Residuos</small>
        </div>
      </div>
    </div>
  );
}
