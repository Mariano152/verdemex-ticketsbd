const KEY = "verdemex_config_v1";

export function loadLocalConfig() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveLocalConfig(cfg) {
  localStorage.setItem(KEY, JSON.stringify(cfg));
}

export function getDefaultConfig() {
  return {
    company: {
      title: "GRUPO VerdeMex",
      reportTitle: "REPORTE MENSUAL",
      basculaCertificada: "U202303Z0003992",
      precioPorTon: 520.33
    },
    rules: {
      skipSundays: true,
      decimalsPesoTon: 3,
      kgRounding: "round"
    },
    drivers: []
  };
}
