import { useMemo, useState } from "react";
import Drivers from "./pages/Drivers";
import GenerateExcel from "./pages/GenerateExcel";
import GenerateTicketsTxt from "./pages/GenerateTicketsTxt";
import PreviousMovements from "./pages/PreviousMovements";

const TABS = [
  { key: "drivers", label: "Conductores" },
  { key: "excel", label: "Generar Excel" },
  { key: "tickets", label: "Generar Tickets TXT" },
  { key: "history", label: "Movimientos Anteriores" },
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
  const [tab, setTab] = useState("drivers");

  const Page = useMemo(() => {
    if (tab === "excel") return <GenerateExcel />;
    if (tab === "tickets") return <GenerateTicketsTxt />;
    if (tab === "history") return <PreviousMovements />;
    return <Drivers />;
  }, [tab]);

  return (
    <div className="container">
      <div className="hero">
        <div className="heroTop">
          <div className="brand">
            <div className="logoMark">
              <LeafIcon />
            </div>
            <div className="brandTitle">
              <b>Control de Residuos</b>
              <span>Generador de Tickets</span>
            </div>
          </div>

          <span className="badge">localStorage (por PC)</span>
        </div>

        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={"tab " + (tab === t.key ? "tabActive" : "")}
              onClick={() => setTab(t.key)}
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
