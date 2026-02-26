import fs from "fs";
import path from "path";
import Handlebars from "handlebars";
import { globSync } from "glob";

const SRC_DIR = "src/templates"; // input
const OUT_ROOT = "public/js/templates"; // output root

// Lấy tất cả .hbs (recursive)
const files = globSync(`${SRC_DIR}/**/*.hbs`.replaceAll("\\", "/"));

// group = thư mục con cấp 1 (pages/components/partials/...), nếu file nằm ngay SRC_DIR thì group = "root"
function groupName(file) {
  const rel = path.relative(SRC_DIR, file).replaceAll("\\", "/");
  return rel.includes("/") ? rel.split("/")[0] : "root";
}

// key = tên file (không kèm thư mục), bỏ .hbs
function fileKey(file) {
  return path.basename(file).replace(/\.hbs$/, "");
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

// check duplicate keys trong cùng group
function assertNoDuplicateKeys(group, groupFiles) {
  const map = new Map(); // key -> [files]
  for (const f of groupFiles) {
    const key = fileKey(f);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(f);
  }
  const dups = [...map.entries()].filter(([, list]) => list.length > 1);
  if (dups.length) {
    const msg = dups
      .map(([k, list]) => `- key "${k}" trùng ở:\n  ${list.join("\n  ")}`)
      .join("\n");
    throw new Error(
      `Duplicate template keys in group "${group}" (vì key = tên file).\n${msg}\n` +
        `➡️ Hãy đổi tên file hoặc đổi rule đặt key (vd: dùng path tương đối).`,
    );
  }
}

function buildBundleJs(group, groupFiles) {
  // sort để output ổn định
  groupFiles.sort((a, b) => a.localeCompare(b));

  // Validate duplicate keys
  assertNoDuplicateKeys(group, groupFiles);

  let out = "";
  out += `// AUTO-GENERATED: Handlebars bundle for "${group}"\n`;
  out += `(function(){\n`;
  out += `  var template = Handlebars.template;\n`;
  out += `  Handlebars.templates = Handlebars.templates || {};\n`;
  out += `  Handlebars.partials = Handlebars.partials || {};\n\n`;

  for (const file of groupFiles) {
    const key = fileKey(file);
    const rel = path.relative(SRC_DIR, file).replaceAll("\\", "/");
    const source = fs.readFileSync(file, "utf8");
    const pre = Handlebars.precompile(source);

    // Nếu file nằm trong group "partials" hoặc đường dẫn chứa "/partials/" => register partial
    const isPartial = group === "partials" || rel.includes("partials/");

    if (isPartial) {
      out += `  // partial: ${rel}\n`;
      out += `  Handlebars.partials[${JSON.stringify(key)}] = template(${pre});\n\n`;
    } else {
      out += `  // template: ${rel}\n`;
      out += `  Handlebars.templates[${JSON.stringify(key)}] = template(${pre});\n\n`;
    }
  }

  out += `})();\n`;
  return out;
}

// 1) Group files theo thư mục con cấp 1
const groups = new Map(); // group -> files[]
for (const f of files) {
  const g = groupName(f);
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g).push(f);
}

// 2) Output: mỗi group -> OUT_ROOT/<group>/templates.js (root -> OUT_ROOT/root/templates.js)
let total = 0;
for (const [group, groupFiles] of groups.entries()) {
  const outDir = path.join(OUT_ROOT, group);
  ensureDir(outDir);

  const js = buildBundleJs(group, groupFiles);
  const outFile = path.join(outDir, "templates.js");

  fs.writeFileSync(outFile, js, "utf8");
  console.log(`✅ ${group}: ${groupFiles.length} files -> ${outFile}`);
  total += groupFiles.length;
}

console.log(`🎉 Done. Total compiled: ${total}`);
