import { convert, Abjad } from "abjad-convert";
import { transliterateToLatin, transliterateToTifinagh } from "tamazight";

export type Script = "arabic" | "latin" | "tifinagh";

function isTifinagh(text: string): boolean {
  return /[\u2D30-\u2D7F]/.test(text);
}

function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

export function detectScript(text: string): Script {
  if (isTifinagh(text)) return "tifinagh";
  if (isArabic(text)) return "arabic";
  return "latin";
}

export function retype(text: string, from?: Script, to?: Script): string {
  const src = from || detectScript(text);
  const dst = to || (src === "tifinagh" ? "latin" : "tifinagh");

  if (src === dst) return text;

  // Direct pairs
  if (src === "arabic" && dst === "tifinagh") {
    return convert(text, Abjad.Arabic, Abjad.Tifinagh);
  }

  if (src === "tifinagh" && dst === "arabic") {
    return convert(text, Abjad.Tifinagh, Abjad.Arabic);
  }

  if (src === "latin" && dst === "tifinagh") {
    return transliterateToTifinagh(text);
  }

  if (src === "tifinagh" && dst === "latin") {
    return transliterateToLatin(text);
  }

  // Chained pairs (no direct converter, go through Tifinagh)
  if (src === "arabic" && dst === "latin") {
    const tif = convert(text, Abjad.Arabic, Abjad.Tifinagh);
    return transliterateToLatin(tif);
  }

  if (src === "latin" && dst === "arabic") {
    const tif = transliterateToTifinagh(text);
    return convert(tif, Abjad.Tifinagh, Abjad.Arabic);
  }

  return text;
}
