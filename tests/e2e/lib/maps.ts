import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMap, type MapFile } from "./mapfile.js";

const HERE = dirname(fileURLToPath(import.meta.url));
export const MAPS_DIR = join(HERE, "..", "maps");

/** Loads every map file once and caches the result. */
export function loadMaps(dir = MAPS_DIR): MapFile[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".txt"))
    .sort()
    .map((f) => parseMap(readFileSync(join(dir, f), "utf8"), f));
}

/** Loads a single map file by base name (without the .txt extension). */
export function loadMap(name: string, dir = MAPS_DIR): MapFile {
  return parseMap(readFileSync(join(dir, `${name}.txt`), "utf8"), `${name}.txt`);
}