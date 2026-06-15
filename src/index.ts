import { Hono } from "hono";
import { cors } from "hono/cors";
import { loadSync, loadFromUrl, isLoaded, searchArabic, searchEnglish, searchAmazigh, getRandomEntry } from "./dictionary.ts";
import { retype, type Script } from "./retype.ts";

const app = new Hono();
app.use("/*", cors());

const PORT = parseInt(process.env.PORT || "3001", 10);

let initPromise: Promise<void> | null = null;

async function ensureDictionary(): Promise<void> {
  if (isLoaded()) return;
  if (!initPromise) {
    initPromise = process.env.DICTIONARY_URL
      ? loadFromUrl(process.env.DICTIONARY_URL)
      : loadSync();
  }
  return initPromise;
}

app.get("/", (c) => c.redirect("/help"));

app.get("/help", async (c) => {
  await ensureDictionary();
  return c.json({
    service: "Omniversify Tifinagh Dictionary API",
    version: "1.0.0",
    endpoints: {
      "GET /help": "Show this help message",
      "POST /retype": {
        description: "Transliterate between scripts",
        body: {
          text: "string (required) — the text to convert",
          from: '"arabic" | "latin" | "tifinagh" (optional — auto-detected)',
          to: '"arabic" | "latin" | "tifinagh" (optional — auto-detected)',
        },
        example: {
          request: { text: "ⵎⵔⵃⴱⴰ", from: "tifinagh", to: "arabic" },
          response: { input: { text: "ⵎⵔⵃⴱⴰ", script: "tifinagh" }, output: { text: "مرحبا", script: "arabic" } },
        },
      },
      "GET /api/random": {
        description: "Get a random dictionary entry",
      },
      "POST /translate": {
        description: "Look up a word in the Tifinagh dictionary",
        body: {
          text: "string (required) — the word to look up",
          from: '"arabic" | "english" | "tifinagh" (optional — auto-detected)',
          to: '"arabic" | "english" | "tifinagh" (optional — defaults to all)',
        },
        example: {
          request: { text: "ⴰⵏⵥⴰⵔ", from: "tifinagh" },
          response: { query: "ⴰⵏⵥⴰⵔ", results: [{ word: "ⴰⵏⵥⴰⵔ", pronunciation: "anẓar", arabic: "مطر", english: "rain" }] },
        },
      },
    },
    dictionary: isLoaded() ? "loaded" : "loading...",
  });
});

app.get("/api/random", async (c) => {
  await ensureDictionary();

  if (!isLoaded()) {
    return c.json({ error: "Dictionary not loaded." }, 503);
  }

  const entry = getRandomEntry();
  if (!entry) {
    return c.json({ error: "No entries available." }, 404);
  }

  return c.json(entry);
});

app.post("/retype", async (c) => {
  const body = await c.req.json<{ text?: string; from?: string; to?: string }>();
  if (!body.text) {
    return c.json({ error: "Missing required field: text" }, 400);
  }

  const src = body.from as Script | undefined;
  const dst = body.to as Script | undefined;

  try {
    const output = retype(body.text, src, dst);

    return c.json({
      input: {
        text: body.text,
        script: src || "auto-detected",
      },
      output: {
        text: output,
        script: dst || "auto-detected",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: `Transliteration failed: ${message}` }, 500);
  }
});

app.post("/translate", async (c) => {
  const body = await c.req.json<{ text?: string; from?: string }>();
  if (!body.text) {
    return c.json({ error: "Missing required field: text" }, 400);
  }

  await ensureDictionary();

  if (!isLoaded()) {
    return c.json({ error: "Dictionary not loaded. Run `bun run download-dataset` first." }, 503);
  }

  const from = (body.from || "auto").toLowerCase();
  let results: import("./dictionary.ts").DictEntry[] = [];

  if (from === "arabic" || (from === "auto" && /[\u0600-\u06FF]/.test(body.text))) {
    results = searchArabic(body.text);
  } else if (from === "english" || from === "auto") {
    results = searchEnglish(body.text);
  } else if (from === "tifinagh" || (from === "auto" && /[\u2D30-\u2D7F]/.test(body.text))) {
    results = searchAmazigh(body.text);
  }

  if (results.length === 0 && from === "auto") {
    results = [...searchArabic(body.text), ...searchEnglish(body.text), ...searchAmazigh(body.text)];
  }

  if (results.length === 0) {
    return c.json({ query: body.text, results: [] });
  }

  return c.json({
    query: body.text,
    results: results.slice(0, 10),
  });
});

export default app;

if (typeof Bun !== "undefined") {
  ensureDictionary().then(() => {
    console.info(`Server starting on http://localhost:${PORT}`);
    Bun.serve({
      port: PORT,
      fetch: app.fetch,
    });
  });
}
