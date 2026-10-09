// Several tests assert on source text. The codebase is formatted with Prettier, so compare against a
// compact form: whitespace runs collapsed, spaces around punctuation and trailing commas removed.
// SQL files are returned unchanged.
import fs from "node:fs";

export function compactSource(code: string): string {
  return code
    .replace(/\s+/g, " ")
    .replace(/\s*(&&|\|\||\?\?)\s*/g, "$1")
    .replace(/\s*([{}()[\];,:?=<>!+*/.])\s*/g, "$1")
    .replace(/,([}\])])/g, "$1")
    .replace(/\(\s*</g, "<")
    .replace(/>\s*\)/g, ">");
}

export function readSource(file: string | URL): string {
  const text = fs.readFileSync(file, "utf8");
  return String(file).endsWith(".sql") ? text : compactSource(text);
}

/** Raw source, for assertions written against formatted code. */
export function readRawSource(file: string | URL): string {
  return fs.readFileSync(file, "utf8");
}
