import { useState, useEffect } from "react";
import api from "../api";
import "../styles/CompanySelect.css";

export default function CompanySelect({ user, onSelectCompany }) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [error, setError] = useState("");
  const [section, setSection] = useState("companies"); // "companies" o "users"
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    password: "",
    role: "user"
  });
  const [success, setSuccess] = useState("");
  const token = sessionStorage.getItem("token");

  useEffect(() => {
    loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (section === "users" && (user?.role === 'admin' || user?.role === 'superadmin')) {
      loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  const loadUsers = async () => {
    try {
      setError("");
      const { data } = await api.get("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(data.users);
    } catch (error) {
      setError("Error cargando usuarios");
      console.error(error);
    }
  };

  const loadCompanies = async () => {
    try {
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

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    
    try {
      setError("");
      const { data } = await api.post("/api/companies", 
        { name: newCompanyName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCompanies([...companies, data.company]);
      setNewCompanyName("");
      setShowNewCompany(false);
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
    } catch (error) {
      setError(error.response?.data?.error || "Error eliminando empresa");
      console.error(error);
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

  if (loading) return <div className="loadingContainer">Cargando...</div>;

  return (
    <div className="companySelectContainer">
      <div className="companyHeader">
        <div>
          <h2>Bienvenido, <span>{user.username}</span></h2>
          <p className="roleLabel">{user.role === 'superadmin' ? 'Superadmin' : user.role === 'admin' ? 'Administrador' : 'Usuario'}</p>
        </div>
        {section === "users" && (
          <button 
            className="backBtn"
            onClick={() => setSection("companies")}
            title="Volver a empresas"
          >
            ← Atrás
          </button>
        )}
      </div>

      {(user.role === 'admin' || user.role === 'superadmin') && (
        <div className="sectionTabs">
          <button 
            className={`sectionTab ${section === "companies" ? "active" : ""}`}
            onClick={() => setSection("companies")}
          >
            Empresas
          </button>
          <button 
            className={`sectionTab ${section === "users" ? "active" : ""}`}
            onClick={() => setSection("users")}
          >
            Administración de Usuarios
          </button>
        </div>
      )}

      <div className="companyContent">
        {error && <div className="errorAlert">{error}</div>}
        {success && <div className="successAlert">{success}</div>}

        {/* SECCIÓN EMPRESAS */}
        {section === "companies" && (
          <>
            <h3>Selecciona una empresa:</h3>

            <div className="companiesList">
              {companies.length === 0 ? (
                <p className="noCompanies">
                  {user.role === 'admin' ? 'No hay empresas aún. Crea una nueva.' : 'No hay empresas disponibles aún.'}
                </p>
              ) : (
                companies.map((comp) => (
                  <div key={comp.id} className="companyCard">
                    <div className="companyInfo">
                      <h4>{comp.name}</h4>
                      <small>{new Date(comp.created_at).toLocaleDateString()}</small>
                    </div>
                    <div className="companyActions">
                      <button 
                        className="enterBtn"
                        onClick={() => onSelectCompany(comp.id, comp.name)}
                      >
                        Entrar →
                      </button>
                      {(user.role === 'admin' || user.role === 'superadmin') && (
                        <button 
                          className="deleteBtn"
                          onClick={() => handleDeleteCompany(comp.id, comp.name)}
                          title="Eliminar empresa"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {(user.role === 'admin' || user.role === 'superadmin') && (
              <div className="createCompanySection">
                {!showNewCompany ? (
                  <button 
                    className="createBtn"
                    onClick={() => setShowNewCompany(true)}
                  >
                    + Nueva Empresa
                  </button>
                ) : (
                  <form onSubmit={handleCreateCompany} className="createForm">
                    <input
                      type="text"
                      placeholder="Nombre de la empresa"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      autoFocus
                    />
                    <div className="formActions">
                      <button type="submit" className="submitBtn">Crear</button>
                      <button 
                        type="button"
                        className="cancelBtn"
                        onClick={() => {
                          setShowNewCompany(false);
                          setNewCompanyName("");
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </>
        )}

        {/* SECCIÓN USUARIOS */}
        {section === "users" && (user?.role === 'admin' || user?.role === 'superadmin') && (
          <>
            <h3>Administración de Usuarios</h3>

            <div className="adminUserSection">
              <h4>Crear Nuevo Usuario</h4>
              <form onSubmit={handleCreateUser} className="userForm">
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

            <div className="adminUserSection">
              <h4>Usuarios Activos ({users.length})</h4>
              {users.length === 0 ? (
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
          </>
        )}
      </div>
    </div>
  );
}
