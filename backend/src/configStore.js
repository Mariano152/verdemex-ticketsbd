const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "..", "data", "config.json");

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`No existe config.json en: ${CONFIG_PATH}`);
  }
  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  return JSON.parse(raw);
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

module.exports = { loadConfig, saveConfig, CONFIG_PATH };
