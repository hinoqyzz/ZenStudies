import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const svg = readFileSync(new URL("../src/assets/brand/zenstudies-app-icon.svg", import.meta.url));
mkdirSync(new URL("../src-tauri/icons/", import.meta.url), { recursive: true });
const png = new Resvg(svg, { fitTo: { mode: "width", value: 1024 } }).render().asPng();
writeFileSync(new URL("../src-tauri/icons/source.png", import.meta.url), png);
