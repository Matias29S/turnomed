import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from '../src/db.js';

const here = dirname(fileURLToPath(import.meta.url));

const sql = await readFile(join(here, 'schema.sql'), 'utf8');

try {
  await pool.query(sql);
  console.log('Esquema aplicado correctamente.');
} finally {
  await pool.end();
}
