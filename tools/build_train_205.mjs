#!/usr/bin/env node
// Builds train-205.html from src/train-205/* and regenerates the "renders"
// list inside train_205_scripts.json (every final spoken sentence + its audio path).
//
//   node tools/build_train_205.mjs
//
// Single-file output is deliberate: the game must also work when opened
// straight from disk (file://), where browsers block fetch() of local JSON.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src/train-205');
const SCRIPTS = path.join(ROOT, 'train_205_scripts.json');
const OUT = path.join(ROOT, 'train-205.html');

const stations = JSON.parse(fs.readFileSync(path.join(SRC, 'stations.json'), 'utf8'));
const scripts = JSON.parse(fs.readFileSync(SCRIPTS, 'utf8'));

const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

// Every line is rendered once per language. Lines marked per_station are
// rendered once per station (variables: {name} {next} {code} {line_no}).
const renders = [];
for (const line of scripts.lines || []) {
  const last = stations[stations.length - 1];
  const list = !line.per_station ? [null] : stations.filter(s =>
    !(line.skip_last && s === last) && !(line.skip_first && s === stations[0]) &&
    !(line.only === 'last' && s !== last) && !(line.only === 'transfer' && !s.transfer_ja));
  for (const st of list) {
    for (const lang of ['ja', 'en']) {
      if (!line[lang]) continue;
      let vars = {};
      if (st) {
        const i = stations.indexOf(st), nx = stations[i + 1] || st;
        vars = lang === 'ja'
          ? { name: st.ja_read || st.ja, next: nx.ja_read || nx.ja, code: st.no, line_no: st.no, transfer: st.transfer_ja || '' }
          : { name: st.en, next: nx.en, code: st.no, line_no: st.no, transfer: st.transfer_en || '' };
      }
      const folder = st ? st.id : 'common';
      renders.push({
        key: `${folder}|${line.id}|${lang}`,
        line_id: line.id, role: line.role, lang, station: st ? st.id : null, when: line.when,
        text: fill(line[lang], vars),
        file: `audio/train-205/${lang}/${folder}/${line.id}.mp3`,
      });
    }
  }
}
const leftover = renders.filter(r => /\{\w+\}/.test(r.text));
if (leftover.length) { console.error('Unfilled variables in:', leftover.map(r => r.key).join(', ')); process.exit(1); }
scripts.renders = renders;

const { renders: _r, ...head } = scripts;
let json = JSON.stringify(head, null, 2);
json = json.replace(/\n}$/, ',\n  "renders": [\n' + renders.map(r => '    ' + JSON.stringify(r)).join(',\n') + '\n  ]\n}\n');
JSON.parse(json);
fs.writeFileSync(SCRIPTS, json);

const jsOrder = fs.readdirSync(SRC).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
const js = jsOrder.map(f => `// ===== ${f} =====\n` + fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
const safe = s => s.replace(/<\/script/gi, '<\\/script');
let html = fs.readFileSync(path.join(SRC, 'template.html'), 'utf8');
html = html
  .replace('%%STATIONS%%', () => safe(JSON.stringify(stations)))
  .replace('%%SCRIPTS%%', () => safe(JSON.stringify(scripts)))
  .replace('%%JS%%', () => safe(js));
fs.writeFileSync(OUT, html);
console.log(`renders: ${renders.length}  ->  ${path.relative(ROOT, SCRIPTS)}`);
console.log(`built ${path.relative(ROOT, OUT)} (${(html.length / 1024).toFixed(0)} KB) from ${jsOrder.join(', ')}`);
