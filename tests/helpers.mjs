import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const readText = p => readFileSync(path.join(ROOT, p), 'utf8');
export const readJson = p => JSON.parse(readText(p));
export const recipeFiles = () => readdirSync(path.join(ROOT, 'recetas'))
  .filter(f => f.endsWith('.json') && f !== 'index.json' && f !== 'receta.schema.json');
export const loadRecipes = () => recipeFiles().map(f => ({ file: f, recipe: readJson('recetas/' + f) }));
