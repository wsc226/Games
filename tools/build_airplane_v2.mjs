#!/usr/bin/env node
// Builds airplane-v2.html from src/airplane-v2/* and regenerates the "renders"
// list inside airplane_scripts.json (every final spoken sentence + its audio path).
//
//   node tools/build_airplane_v2.mjs
//
// Single-file output is deliberate: the game must also work when opened
// straight from disk (file://), where browsers block fetch() of local JSON.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src/airplane-v2');
const SCRIPTS = path.join(ROOT, 'airplane_scripts.json');
const OUT = path.join(ROOT, 'airplane-v2.html');

const DIG = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const digits = s => String(s).split('').filter(c => /\d/.test(c)).map(c => DIG[+c]).join(' ');
const runwaySpoken = r => {
  const m = String(r).match(/^(\d+)([LRC]?)$/i);
  if (!m) return r;
  const side = { L: ' left', R: ' right', C: ' center' }[m[2].toUpperCase()] || '';
  return digits(m[1].padStart(2, '0')) + side;
};

const airlines = JSON.parse(fs.readFileSync(path.join(SRC, 'airlines.json'), 'utf8'));
const scripts = JSON.parse(fs.readFileSync(SCRIPTS, 'utf8'));
const captain = scripts.variables?.captain_name || 'Asher';

function fill(text, vars) {
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

const renders = [];
for (const line of scripts.lines) {
  const base = { captain_name: captain };
  const variantVals = line.variant ? scripts.variants[line.variant] : [null];
  const airlineList = line.per_airline ? airlines : [null];
  for (const al of airlineList) {
    for (const v of variantVals) {
      const vars = { ...base };
      if (al) Object.assign(vars, {
        airline: al.name, callsign: al.cs, flight_spoken: digits(al.flt),
        runway_spoken: runwaySpoken(al.rwy), gate: al.gate,
      });
      if (v != null) vars.fl_spoken = digits(v);
      const folder = al ? al.id : 'common';
      const suffix = v != null ? '.' + v : '';
      renders.push({
        key: `${folder}|${line.id}${suffix}`,
        line_id: line.id,
        role: line.role,
        airline: al ? al.id : null,
        variant: v,
        text: fill(line.text, vars),
        file: `assets/airplane/voice/${folder}/${line.id}${suffix}.mp3`,
      });
    }
  }
}
const leftover = renders.filter(r => /\{\w+\}/.test(r.text));
if (leftover.length) {
  console.error('Unfilled variables in:', leftover.map(r => r.key).join(', '));
  process.exit(1);
}
scripts.renders = renders;

// Pretty JSON, but one render per line so the file stays scannable.
const { renders: _r, ...head } = scripts;
let json = JSON.stringify(head, null, 2);
json = json.replace(/\n}$/, ',\n  "renders": [\n' +
  renders.map(r => '    ' + JSON.stringify(r)).join(',\n') + '\n  ]\n}\n');
JSON.parse(json); // sanity
fs.writeFileSync(SCRIPTS, json);

// ---- assemble HTML ----
const jsOrder = ['logos.js', ...fs.readdirSync(SRC).filter(f => /^\d\d-.*\.js$/.test(f)).sort()];
const js = jsOrder.map(f => `// ===== ${f} =====\n` + fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
const safe = s => s.replace(/<\/script/gi, '<\\/script');
let html = fs.readFileSync(path.join(SRC, 'template.html'), 'utf8');
html = html
  .replace('%%AIRLINES%%', () => safe(JSON.stringify(airlines)))
  .replace('%%SCRIPTS%%', () => safe(JSON.stringify(scripts)))
  .replace('%%JS%%', () => safe(js));
fs.writeFileSync(OUT, html);
console.log(`renders: ${renders.length}  ->  ${path.relative(ROOT, SCRIPTS)}`);
console.log(`built ${path.relative(ROOT, OUT)} (${(html.length / 1024).toFixed(0)} KB) from ${jsOrder.join(', ')}`);
