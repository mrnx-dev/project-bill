import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
// The two components that legitimately hold SOW/SPK copy (spec §6.2/§6.3): the printed
// document's id titles, and the acceptance token [SOW] in the invoice agreement dialog.
const ALLOWED = new Set([
  "src/components/contract-document.tsx",
  "src/app/(public)/invoices/[id]/terms-agreement.tsx",
]);
// Identifiers, routes and audit values keep their SOW/SPK names on purpose (spec §6.3):
// /sow/ routes, sow-template settings, SOWTemplate, sowTemplates, isSow*, SOW_TEMPLATE, ACCEPT_SOW.
// The SPK_STARTER/SPK_SAMPLE engine identifiers are imported by editors, not copy.
const IGNORED_PATHS = /sow-template|sowTemplates|SOWTemplate|ACCEPT_SOW|SOW_TEMPLATE|is[Ss]ow|\/sow\/|SPK_STARTER|SPK_SAMPLE|SOW_TEMPLATE/;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return p.endsWith(".tsx") ? [p] : [];
  });
}

test("no user-visible SOW/SPK string outside the two copy-holding components", () => {
  const hits = walk(join(ROOT, "src", "app"))
    .concat(walk(join(ROOT, "src", "components")))
    .map((file) => file.replace(ROOT, "").replace(/^[/\\]/, "").replace(/\\/g, "/"))
    .filter((file) => !ALLOWED.has(file) && !IGNORED_PATHS.test(file))
    .flatMap((file) =>
      readFileSync(join(ROOT, file), "utf8")
        .split("\n")
        .map((line, i) => `${file}:${i + 1}: ${line}`)
        .filter((l) => /SOW|SPK/.test(l))
        // The overwrite-dialog line is a code comment, not copy (spec §6.2).
        // Identifier lines keep their SOW/SPK names on purpose (spec §6.3): audit values,
        // engine identifiers, and route names — none of these are user-visible copy.
        .filter((l) => !/SOW Template Overwrite Dialog|SOW_TEMPLATE|SPK_SAMPLE_DATA/.test(l))
    )
    .map((l) => l.replace(/:[0-9]+:/, ":"));
  expect([...new Set(hits)].sort()).toEqual([]);
});
