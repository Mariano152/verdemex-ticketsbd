import { useState, useEffect } from "react";
import api from "../api";
import "../styles/AdminPanel.css";

export default function AdminPanel({ user, onLogout }) {
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form para crear usuario
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    password: "",
    role: "user"
  });

  // Form para crear empresa
  const [newCompany, setNewCompany] = useState({
    name: ""
  });

  const token = sessionStorage.getItem("token");

  useEffect(() => {
    if (tab === "users") loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab === "companies") loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const { data } = await api.get("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(data.users);
    } catch (error) {
      setError("Error cargando usuarios");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      setLoading(true);
      setError("");
      const { data } = await api.get("/api/companies", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCompanies(data.companies);
    } catch (error) {
      setError("Error cargando empresas");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.email || !newUser.password) {
      setError("Completa todos los campos");
      return;
    }

    try {
      setError("");
      setSuccess("");
      const { data } = await api.post("/api/admin/users", newUser, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers([...users, data.user]);
      setNewUser({ username: "", email: "", password: "", role: "user" });
      setSuccess(`Usuario "${newUser.username}" creado exitosamente`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      setError(error.response?.data?.error || "Error creando usuario");
      console.error(error);
    }
  };

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      setError("");
      const { data } = await api.put(`/api/admin/users/${userId}/role`, { role: newRole }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(users.map(u => u.id === userId ? data.user : u));
      setSuccess("Rol actualizado");
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      setError(error.response?.data?.error || "Error actualizando rol");
      console.error(error);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`¿Eliminar usuario "${username}"?`)) return;

    try {
      setError("");
      await api.delete(`/api/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(users.filter(u => u.id !== userId));
      setSuccess(`Usuario "${username}" eliminado`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      setError(error.response?.data?.error || "Error eliminando usuario");
      console.error(error);
    }
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    if (!newCompany.name) {
      setError("Nombre de empresa requerido");
      return;
    }

    try {
      setError("");
      setSuccess("");
      const { data } = await api.post("/api/companies", newCompany, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCompanies([...companies, data.company]);
      setNewCompany({ name: "" });
      setSuccess(`Empresa "${newCompany.name}" creada exitosamente`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      setError(error.response?.data?.error || "Error creando empresa");
      console.error(error);
    }
  };

  const handleDeleteCompany = async (companyId, companyName) => {
    if (!window.confirm(`¿Eliminar empresa "${companyName}"?`)) return;

    try {
      setError("");
      await api.delete(`/api/companies/${companyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCompanies(companies.filter(c => c.id !== companyId));
      setSuccess(`Empresa "${companyName}" eliminada`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      setError(error.response?.data?.error || "Error eliminando empresa");
      console.error(error);
    }
  };

  return (
    <div className="adminPanelContainer">
      <div className="adminHeader">
        <div className="adminTitle">
          <h1>Panel de Administración</h1>
          <p>Gestión de usuarios y empresas</p>
        </div>
        <div className="adminActions">
          <span className="userInfo">Conectado: {user.username}</span>
          <button className="logoutBtn" onClick={onLogout}>Logout</button>
        </div>
      </div>

      <div className="adminTabs">
        <button 
          className={`tab ${tab === "users" ? "active" : ""}`}
          onClick={() => setTab("users")}
        >
          Gestionar Usuarios
        </button>
        <button 
          className={`tab ${tab === "companies" ? "active" : ""}`}
          onClick={() => setTab("companies")}
        >
          Gestionar Empresas
        </button>
      </div>

      <div className="adminContent">
        {error && <div className="errorAlert">{error}</div>}
        {success && <div className="successAlert">{success}</div>}

        {/* USUARIOS */}
        {tab === "users" && (
          <div className="tabContent">
            <div className="adminSection">
              <h2>Crear Nuevo Usuario</h2>
              <form onSubmit={handleCreateUser} className="adminForm">
                <input
                  type="text"
                  placeholder="Usuario"
                  value={newUser.username}
                  onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                  required
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  required
                />
                <input
                  type="password"
                  placeholder="Contraseña (mín 6 caracteres)"
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  required
                  minLength="6"
                />
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                >
                  <option value="user">Usuario Normal</option>
                  <option value="admin">Administrador</option>
                </select>
                <button type="submit">+ Crear Usuario</button>
              </form>
            </div>

            <div className="adminSection">
              <h2>Usuarios Activos ({users.length})</h2>
              {loading ? (
                <p>Cargando...</p>
              ) : users.length === 0 ? (
                <p>No hay usuarios</p>
              ) : (
                <div className="usersList">
                  {users.map(u => (
                    <div key={u.id} className="userItem">
                      <div className="userInfo">
                        <strong>{u.username}</strong>
                        <small>{u.email}</small>
                        <span className="createdDate">{new Date(u.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="userActions">
                        {u.role === 'superadmin' ? (
                          <span style={{
                            padding: '10px 16px',
                            backgroundColor: '#0066cc',
                            color: 'white',
                            borderRadius: '6px',
                            fontSize: '0.95em',
                            fontWeight: 'bold',
                            display: 'inline-block',
                            boxShadow: '0 2px 8px rgba(0, 102, 204, 0.3)'
                          }}>
                            SUPERADMIN
                          </span>
                        ) : (
                          <>
                            <select 
                              value={u.role}
                              onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                              className={u.role === 'admin' ? 'roleAdmin' : 'roleUser'}
                            >
                              <option value="user">Usuario</option>
                              <option value="admin">Admin</option>
                            </select>
                            {u.id !== user.userId && (
                              <button 
                                className="deleteBtn"
                                onClick={() => handleDeleteUser(u.id, u.username)}
                                title="Eliminar usuario"
                              >
                                🗑️
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* EMPRESAS */}
        {tab === "companies" && (
          <div className="tabContent">
            <div className="adminSection">
              <h2>Crear Nueva Empresa</h2>
              <form onSubmit={handleCreateCompany} className="adminForm">
                <input
                  type="text"
                  placeholder="Nombre de la empresa"
                  value={newCompany.name}
                  onChange={(e) => setNewCompany({...newCompany, name: e.target.value})}
                  required
                />
                <button type="submit">+ Crear Empresa</button>
              </form>
            </div>

            <div className="adminSection">
              <h2>Empresas Registradas ({companies.length})</h2>
              {loading ? (
                <p>Cargando...</p>
              ) : companies.length === 0 ? (
                <p>No hay empresas</p>
              ) : (
                <div className="companiesList">
                  {companies.map(c => (
                    <div key={c.id} className="companyItem">
                      <div className="companyInfo">
                        <strong>{c.name}</strong>
                        <small>ID: {c.id}</small>
                        <span className="createdDate">Creada: {new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                      <button 
                        className="deleteBtn"
                        onClick={() => handleDeleteCompany(c.id, c.name)}
                        title="Eliminar empresa"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
