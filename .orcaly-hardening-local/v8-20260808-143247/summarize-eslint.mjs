import fs from "node:fs";

const [input, output] = process.argv.slice(2);
const report = JSON.parse(fs.readFileSync(input, "utf8"));

const files = [];
const rules = new Map();
let errors = 0;
let warnings = 0;

for (const row of report) {
  const messages = row.messages || [];
  if (!messages.length) continue;

  const fileErrors = messages.filter((item) => item.severity === 2).length;
  const fileWarnings = messages.filter((item) => item.severity === 1).length;
  errors += fileErrors;
  warnings += fileWarnings;

  files.push({
    path: row.filePath,
    errors: fileErrors,
    warnings: fileWarnings,
    messages: messages.map((item) => ({
      line: item.line || 0,
      column: item.column || 0,
      severity: item.severity === 2 ? "error" : "warning",
      rule: item.ruleId || "unknown",
      message: String(item.message || "").split("\n")[0],
    })),
  });

  for (const item of messages) {
    const key = `${item.severity === 2 ? "error" : "warning"} :: ${item.ruleId || "unknown"}`;
    rules.set(key, (rules.get(key) || 0) + 1);
  }
}

files.sort((a, b) => b.errors - a.errors || b.warnings - a.warnings || a.path.localeCompare(b.path));

const ruleRows = [...rules.entries()].sort((a, b) => b[1] - a[1]);

const lines = [];
lines.push(`ESLINT_TOTAL_ERRORS=${errors}`);
lines.push(`ESLINT_TOTAL_WARNINGS=${warnings}`);
lines.push("");
lines.push("RULES:");
for (const [rule, count] of ruleRows) lines.push(`${count}\t${rule}`);

lines.push("");
lines.push("FILES:");
for (const file of files) {
  lines.push("");
  lines.push(`${file.path} :: errors=${file.errors} warnings=${file.warnings}`);
  for (const item of file.messages) {
    lines.push(`  ${item.severity}\t${item.line}:${item.column}\t${item.rule}\t${item.message}`);
  }
}

fs.writeFileSync(output, lines.join("\n") + "\n", "utf8");
console.log(`ESLINT_TOTAL_ERRORS=${errors}`);
console.log(`ESLINT_TOTAL_WARNINGS=${warnings}`);
console.log(`ESLINT_FILES_WITH_ISSUES=${files.length}`);