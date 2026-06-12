interface RawEntry {
  amazigh: string;
  arabic: string;
  pronunciation: string;
}

interface RawDglaiEntry {
  lexie: string;
  api: string;
  sensar: string;
  senseng: string;
}

export interface DictEntry {
  word: string;
  pronunciation: string;
  type: string;
  arabic: string;
  english: string;
}

type Index = Map<string, DictEntry[]>;

let entries: DictEntry[] = [];
let byAmazigh: Index = new Map();
let byArabic: Index = new Map();
let byEnglish: Index = new Map();

export function isLoaded(): boolean {
  return entries.length > 0;
}

function buildIndexes(data: { amawal: RawEntry[]; dglai: RawDglaiEntry[] }): void {
  const seen = new Set<string>();

  for (const e of data.amawal) {
    const word = e.amazigh.trim();
    if (!word || seen.has(word)) continue;
    seen.add(word);
    const entry: DictEntry = {
      word,
      pronunciation: (e.pronunciation || "").trim(),
      type: "",
      arabic: (e.arabic || "").trim(),
      english: "",
    };
    entries.push(entry);
  }

  for (const e of data.dglai) {
    const word = e.lexie.trim();
    if (!word || seen.has(word)) continue;
    seen.add(word);
    const entry: DictEntry = {
      word,
      pronunciation: (e.api || "").trim(),
      type: "",
      arabic: (e.sensar || "").trim(),
      english: (e.senseng || "").trim(),
    };
    entries.push(entry);
  }

  for (const entry of entries) {
    pushIndex(byAmazigh, entry.word, entry);
    if (entry.arabic) {
      for (const t of entry.arabic.split(/[,;|]/)) {
        pushIndex(byArabic, t.trim(), entry);
      }
    }
    if (entry.english) {
      for (const t of entry.english.split(/[,;|]/)) {
        pushIndex(byEnglish, t.trim(), entry);
      }
    }
  }

  console.info(`Loaded ${entries.length} dictionary entries`);
}

export async function loadSync(): Promise<void> {
  try {
    const { readFileSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");

    const dir = import.meta.dir ?? process.cwd();
    const dataPath = join(dir, "..", "data", "dictionary.json");

    if (!existsSync(dataPath)) {
      console.warn("No dictionary file found at data/dictionary.json. Run `bun run download-dataset` first.");
      return;
    }

    const raw = readFileSync(dataPath, "utf-8");
    const data = JSON.parse(raw);
    buildIndexes(data);
  } catch (err) {
    console.warn("Dictionary not loaded via filesystem:", (err as Error)?.message ?? err);
  }
}

export async function loadFromUrl(url: string): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    buildIndexes(data);
  } catch (err) {
    console.error("Failed to load dictionary from URL:", err);
  }
}

function pushIndex(map: Index, key: string, entry: DictEntry): void {
  if (!key) return;
  const k = key.toLowerCase();
  const existing = map.get(k);
  if (existing) {
    existing.push(entry);
  } else {
    map.set(k, [entry]);
  }
}

function fuzzyMatch(text: string, index: Index): DictEntry[] {
  const t = text.toLowerCase().trim();
  const results: DictEntry[] = [];

  if (index.has(t)) {
    results.push(...index.get(t)!);
  }

  for (const [key, vals] of index) {
    if (key.startsWith(t) && key !== t) {
      results.push(...vals);
    }
  }

  for (const [key, vals] of index) {
    if (key.includes(t) && !key.startsWith(t) && key !== t) {
      results.push(...vals);
    }
  }

  return results;
}

export function searchAmazigh(text: string): DictEntry[] {
  return fuzzyMatch(text, byAmazigh);
}

export function searchArabic(text: string): DictEntry[] {
  return fuzzyMatch(text, byArabic);
}

export function searchEnglish(text: string): DictEntry[] {
  return fuzzyMatch(text, byEnglish);
}
