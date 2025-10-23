const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function parseCsvLine(line) {
  const cells = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { cells.push(cur); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur);
  return cells.map(s => s.trim());
}

function makeXlsxFromCsv(csvPath, xlsxPath) {
  const csv = fs.readFileSync(csvPath, 'utf8');
  const rows = csv.split(/\r?\n/).filter(Boolean).map(parseCsvLine);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'products');
  XLSX.writeFile(wb, xlsxPath);
}

(function main() {
  const tplDir = path.join(__dirname, '..', 'templates');
  ensureDir(tplDir);
  const csvPath = path.join(tplDir, 'products-bulk-sku.csv');
  const xlsxPath = path.join(tplDir, 'products-bulk-sku.xlsx');
  if (!fs.existsSync(csvPath)) {
    console.error('CSV template missing at', csvPath);
    process.exit(1);
  }
  makeXlsxFromCsv(csvPath, xlsxPath);
  console.log('Wrote', xlsxPath);
})();
