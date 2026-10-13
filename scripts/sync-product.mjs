import { readFileSync, writeFileSync } from "node:fs";

const product = JSON.parse(readFileSync(new URL("../product.json", import.meta.url), "utf8"));
const packagePath = new URL("../package.json", import.meta.url);
const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
pkg.version = product.version;
writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

const configPath = new URL("../src-tauri/tauri.conf.json", import.meta.url);
const config = JSON.parse(readFileSync(configPath, "utf8"));
config.productName = product.productName;
config.version = product.version;
config.identifier = product.identifier;
if (config.app?.windows?.[0]) config.app.windows[0].title = product.title;
writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
