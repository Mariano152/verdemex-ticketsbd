import { useMemo, useState, useCallback } from "react";
import Login from "./pages/Login";
import CompanySelect from "./pages/CompanySelect";
import Drivers from "./pages/Drivers";
import GenerateExcel from "./pages/GenerateExcel";
import GenerateTicketsTxt from "./pages/GenerateTicketsTxt";
import PreviousMovements from "./pages/PreviousMovements";
import PhotoReport from "./pages/PhotoReport";
import AdminPanel from "./pages/AdminPanel";

const TABS = [
  { key: "drivers", label: "Conductores" },
  { key: "excel", label: "Generar Excel" },
  { key: "tickets", label: "Generar Tickets TXT" },
  { key: "photos", label: "📸 Reporte Fotográfico" },
  { key: "history", label: "Movimientos Anteriores", adminOnly: true },
  { key: "admin", label: "👥 Panel Admin", adminOnly: true },
];

function LeafIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 3c-7.5 0-12 4.5-14 8.5C4.2 14.5 4.5 18 4.5 20c2 0 5.5-.3 8.5-1.5C17.5 16.5 22 12 22 4c0-.55-.45-1-1-1h-1Z"
        stroke="white"
        strokeWidth="1.6"
      />
      <path d="M6 19c3-5 7-9 14-14" stroke="white" strokeWidth="1.6" />
    </svg>
  );
}

export default function App() {
  const [token, setToken] = useState(() => {
    const stored = sessionStorage.getItem("token");
    const user = sessionStorage.getItem("user");
    if (!stored || !user) {
      sessionStorage.clear();
      return null;
    }
    return stored;
  });
  
  const [user, setUser] = useState(() => {
    const stored = sessionStorage.getItem("user");
    const token = sessionStorage.getItem("token");
    if (!stored || !token) {
      sessionStorage.clear();
      return null;
    }
    return JSON.parse(stored);
  });
  
  const [companyId, setCompanyId] = useState(sessionStorage.getItem("companyId"));
  const [companyName, setCompanyName] = useState(sessionStorage.getItem("companyName"));
  
  // Obtener rol del usuario del sessionStorage para inicializar el tab correctamente
  const storedUser = sessionStorage.getItem("user");
  const userRole = storedUser ? JSON.parse(storedUser).role : null;
  const [tab, setTab] = useState(userRole === 'admin' || userRole === 'superadmin' ? "drivers" : "photos");

  // Declarar funciones ANTES de usarlas en hooks
  const handleLogout = useCallback(() => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("companyId");
    sessionStorage.removeItem("companyName");
    setToken(null);
    setUser(null);
    setCompanyId(null);
  }, []);

  const handleLogin = useCallback((newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
  }, []);

  const handleSelectCompany = (newCompanyId, newCompanyName) => {
    sessionStorage.setItem("companyId", newCompanyId);
    sessionStorage.setItem("companyName", newCompanyName);
    setCompanyId(newCompanyId);
    setCompanyName(newCompanyName);
    // Para usuarios normales, asegurar que el tab sea "photos"
    if (user?.role !== 'admin' && user?.role !== 'superadmin') {
      setTab('photos');
    }
  };

  // Callback para cambiar tab con validación
  const handleTabChange = useCallback((newTab) => {
    // Usuarios normales solo pueden acceder a photos
    if (user?.role !== 'admin' && user?.role !== 'superadmin' && newTab !== 'photos') {
      return;
    }
    setTab(newTab);
  }, [user?.role]);

  // Cargar la página correspondiente - Hook must be called unconditionally before any returns
  const Page = useMemo(() => {
    if (tab === "excel") return <GenerateExcel companyId={companyId} />;
    if (tab === "tickets") return <GenerateTicketsTxt companyId={companyId} />;
    if (tab === "photos") return <PhotoReport companyId={companyId} />;
    if (tab === "history" && (user?.role === 'admin' || user?.role === 'superadmin')) return <PreviousMovements companyId={companyId} />;
    if (tab === "admin" && (user?.role === 'admin' || user?.role === 'superadmin')) return <AdminPanel user={user} onLogout={handleLogout} />;
    return <Drivers companyId={companyId} />;
  }, [tab, companyId, user, handleLogout]);

  // Si no está autenticado, mostrar login
  if (!token || !user) {
    return <Login onLogin={handleLogin} />;
  }

  // Si no ha seleccionado empresa, mostrar selector
  if (!companyId) {
    return <CompanySelect user={user} onSelectCompany={handleSelectCompany} />;
  }

  // Filtrar tabs según el rol
  // Admin/Superadmin: ven todos los tabs
  // Usuario normal: solo ve Reporte Fotográfico
  const visibleTabs = (user?.role === 'admin' || user?.role === 'superadmin')
    ? TABS 
    : TABS.filter(t => t.key === 'photos');

  return (
    <div className="container">
      <div className="hero">
        <div className="heroTop">
          <div className="brand">
            <div className="logoMark">
              <LeafIcon />
            </div>
            <div className="brandTitle">
              <b>{companyName}</b>
              <span>{user.username} ({user.role === 'superadmin' ? 'Superadmin' : user.role === 'admin' ? 'Administrador' : 'Usuario'})</span>
            </div>
          </div>

          <div className="headerActions">
            <button 
              className="changeCompanyBtn"
              onClick={() => {
                sessionStorage.removeItem("companyId");
                sessionStorage.removeItem("companyName");
                setCompanyId(null);
              }}
              title="Cambiar empresa"
            >
              Cambiar Empresa
            </button>
            <button 
              className="logoutBtn"
              onClick={handleLogout}
              title="Cerrar sesión"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="tabs">
          {visibleTabs.map((t) => (
            <button
              key={t.key}
              className={"tab " + (tab === t.key ? "tabActive" : "")}
              onClick={() => handleTabChange(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="wave" />
      </div>

      <div className="page">{Page}</div>
    </div>
  );
}
