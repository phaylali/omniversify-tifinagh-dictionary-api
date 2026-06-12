/**
 * Downloads dictionary datasets from Hugging Face and merges them.
 *
 * Sources:
 *   - prothmane/amawal-dataset (CC-BY-4.0) — 15K Amazigh + Arabic + pronunciation
 *   - abdelhaqueidali/ircam-dglai-dataset (permission needed) — 17K entries + English
 *
 * French fields are stripped entirely — never read, never stored.
 *
 * Usage:
 *   bun run download-dataset
 */

const PAGE_SIZE = 100;

interface AmawalRow {
  amazigh: string;
  pronunciation: string;
  arabic: string | null;
}

interface DglaiRow {
  lexie: string;
  api: string;
  sensar: string | null;
  senseng: string | null;
}

async function fetchAllPages<T>(
  dataset: string,
  limit: number,
  mapRow: (r: any) => T,
): Promise<T[]> {
  const pages = Math.ceil((limit || 999999) / PAGE_SIZE);
  const ranges = Array.from({ length: pages }, (_, i) => i * PAGE_SIZE);

  const chunks = await Promise.all(
    ranges.map(async (offset) => {
      const url = `https://datasets-server.huggingface.co/rows?dataset=${dataset}&config=default&split=train&offset=${offset}&length=${PAGE_SIZE}`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.rows || []).map((r: any) => mapRow(r.row));
      } catch {
        return [];
      }
    }),
  );

  return chunks.flat();
}

console.info("Downloading amawal dataset...");
const amawal = await fetchAllPages<AmawalRow>(
  "prothmane/amawal-dataset",
  15655,
  (row) => ({
    amazigh: row.amazigh || "",
    pronunciation: row.pronunciation || "",
    arabic: row.arabic || null,
  }),
);

// Filter out entries with no Arabic (can't use French per project rules)
const amawalFiltered = amawal.filter((e) => e.amazigh && e.arabic);
console.info(`  ${amawal.length} total, ${amawalFiltered.length} with Arabic`);

console.info("Downloading IRCAM DGLAI dataset...");
const dglai = await fetchAllPages<DglaiRow>(
  "abdelhaqueidali/ircam-dglai-dataset",
  17511,
  (row) => ({
    lexie: row.lexie || "",
    api: row.api || "",
    sensar: row.sensar || null,
    senseng: row.senseng || null,
  }),
);

const dglaiFiltered = dglai.filter((e) => e.lexie && (e.sensar || e.senseng));
console.info(`  ${dglai.length} total, ${dglaiFiltered.length} with Arabic or English`);

const output = {
  amawal: amawalFiltered,
  dglai: dglaiFiltered,
};

const outPath = `${import.meta.dir}/../data/dictionary.json`;
await Bun.write(outPath, JSON.stringify(output, null, 2));

console.info(`\nSaved ${amawalFiltered.length + dglaiFiltered.length} entries to data/dictionary.json`);
