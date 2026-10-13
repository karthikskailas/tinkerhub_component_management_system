// Dev-only: generates fake component rows into a local JSON file so the
// component picker's scroll/search performance can be checked with a
// realistic row count. Never touches Supabase or the cloud project —
// this is purely local fixture data for src/dev/PickerBench.tsx.
//
// Usage: node scripts/generate-fake-components.mjs [count]
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const count = Number(process.argv[2]) || 3000;
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dev-data");
const outFile = join(outDir, "fake-components.json");

const ADJECTIVES = ["Red", "Blue", "Mini", "Heavy-duty", "Precision", "Universal", "Dual", "Compact"];
const NOUNS = [
  "Resistor",
  "Capacitor",
  "Arduino Board",
  "Jumper Wire Pack",
  "Breadboard",
  "Sensor Module",
  "Motor Driver",
  "LED Strip",
  "Relay",
  "Stepper Motor",
];

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

const rows = Array.from({ length: count }, (_, i) => {
  const available = Math.floor(Math.random() * 50);
  return {
    id: randomUUID(),
    name: `${randomItem(ADJECTIVES)} ${randomItem(NOUNS)} #${i + 1}`,
    description: Math.random() > 0.3 ? `Sample description for row ${i + 1}.` : null,
    returnable: Math.random() > 0.2,
    available,
  };
});

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, JSON.stringify(rows));
console.log(`Wrote ${rows.length} fake components to ${outFile}`);
