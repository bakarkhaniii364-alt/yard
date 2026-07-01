import fs from 'fs';
import path from 'path';
import { SourceMapConsumer } from 'source-map';

const distAssets = path.resolve(process.cwd(), 'dist', 'assets');

async function tryMap(mapPath, line, column) {
  const raw = fs.readFileSync(mapPath, 'utf8');
  const sm = await new SourceMapConsumer(JSON.parse(raw));
  try {
    const pos = sm.originalPositionFor({ line, column });
    return pos;
  } finally {
    sm.destroy();
  }
}

async function probe() {
  const indexMap = path.join(distAssets, 'index-Vdbe4RN4.js.map');
  const pos = await tryMap(indexMap, 376, 9005);
  console.log('Mapped position:', pos);
}

probe().catch(console.error);
