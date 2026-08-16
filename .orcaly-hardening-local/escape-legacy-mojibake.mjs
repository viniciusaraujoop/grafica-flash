import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const targets = [
  "scripts/aplicar-segmentos-modulos-painel.cjs",
  "scripts/pre-validacao-patcher.cjs",
];

function escapeNonAsciiSource(input) {
  let output = "";

  for (const character of input) {
    const codePoint = character.codePointAt(0);

    if (codePoint <= 0x7f) {
      output += character;
      continue;
    }

    if (codePoint <= 0xffff) {
      output += `\\u${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
      continue;
    }

    const adjusted = codePoint - 0x10000;
    const high = 0xd800 + (adjusted >> 10);
    const low = 0xdc00 + (adjusted & 0x3ff);

    output += `\\u${high.toString(16).toUpperCase().padStart(4, "0")}`;
    output += `\\u${low.toString(16).toUpperCase().padStart(4, "0")}`;
  }

  return output;
}

for (const relative of targets) {
  const absolute = path.join(root, relative);

  if (!fs.existsSync(absolute)) {
    throw new Error(`Arquivo legado nao encontrado: ${relative}`);
  }

  const original = fs.readFileSync(absolute, "utf8");
  const converted = escapeNonAsciiSource(original);

  fs.writeFileSync(absolute, converted, "utf8");

  if (/[^\x00-\x7F]/.test(converted)) {
    throw new Error(`Fonte ainda possui caractere nao ASCII: ${relative}`);
  }

  console.log(`[ASCII-ESCAPE] ${relative}`);
}