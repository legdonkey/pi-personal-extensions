export interface ProtectedSource {
  readonly text: string;
  readonly values: readonly string[];
}

const INLINE_CODE_RE = /(`+)([^`\n]+?)\1/g;
const URL_RE = /https?:\/\/[^\s<>]+/g;
const WINDOWS_PATH_RE = /\b[A-Za-z]:\\(?:[^\\\s:*?"<>|\r\n]+\\)*[^\\\s:*?"<>|\r\n]+(?::\d+(?::\d+)?)?/g;
const POSIX_PATH_RE = /(?<![\w.@%+,-])(?:~\/|\/)(?:[\w.@%+,-]+\/)*[\w.@%+,-]+(?::\d+(?::\d+)?)?/g;
const RELATIVE_PATH_RE = /(?<![\w@/.-])(?:\.{1,2}\/)?(?:[\w.@%+,-]+\/)+[\w.@%+,-]+(?::\d+(?::\d+)?)?/g;
const BARE_FILE_RE = /(?<![\w@/.-])[\w@%+,-]+(?:\.[A-Za-z][\w-]*)+(?::\d+(?::\d+)?)?/g;
const FILE_REFERENCE_RE = /(?<![\w@])@(?:[\w.-]+\/)*[\w.-]+\.[A-Za-z][\w-]*(?::\d+(?::\d+)?)?/g;
const PLACEHOLDER_RE = /__PI_THINKING_ZH_\d+__/g;

const placeholderFor = (index: number): string =>
  `__PI_THINKING_ZH_${String(index).padStart(4, "0")}__`;

export function protectSource(source: string): ProtectedSource {
  const values: string[] = [];
  const protect = (value: string): string => {
    const placeholder = placeholderFor(values.length);
    values.push(value);
    return placeholder;
  };

  let text = protectFencedCode(source, protect);
  text = text.replace(INLINE_CODE_RE, protect);
  text = protectMarkdownLinkTargets(text, protect);
  text = text.replace(URL_RE, protect);
  text = text.replace(WINDOWS_PATH_RE, protect);
  text = text.replace(POSIX_PATH_RE, protect);
  text = text.replace(RELATIVE_PATH_RE, protect);
  text = text.replace(FILE_REFERENCE_RE, protect);
  text = text.replace(BARE_FILE_RE, protect);

  return { text, values };
}

function protectMarkdownLinkTargets(
  source: string,
  protect: (value: string) => string,
): string {
  const output: string[] = [];
  let cursor = 0;
  let marker = source.indexOf("](");

  while (marker >= 0) {
    const targetStart = marker + 2;
    let depth = 0;
    let targetEnd = -1;
    for (let index = targetStart; index < source.length; index += 1) {
      const character = source[index];
      if (character === "\n") break;
      if (character === "\\") {
        index += 1;
        continue;
      }
      if (character === "(") {
        depth += 1;
        continue;
      }
      if (character !== ")") continue;
      if (depth > 0) {
        depth -= 1;
        continue;
      }
      targetEnd = index;
      break;
    }

    if (targetEnd < 0) {
      marker = source.indexOf("](", targetStart);
      continue;
    }
    const target = source.slice(targetStart, targetEnd);
    output.push(source.slice(cursor, targetStart));
    output.push(target ? protect(target) : target);
    output.push(")");
    cursor = targetEnd + 1;
    marker = source.indexOf("](", cursor);
  }

  output.push(source.slice(cursor));
  return output.join("");
}

function protectFencedCode(
  source: string,
  protect: (value: string) => string,
): string {
  const lines = source.split(/(?<=\n)/);
  const output: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const opening = /^ {0,3}(`{3,}|~{3,})[^\n]*(?:\n)?$/.exec(line);
    if (!opening?.[1]) {
      output.push(line);
      continue;
    }

    const openingFence = opening[1];
    let closingIndex = lines.length - 1;
    for (let candidate = index + 1; candidate < lines.length; candidate += 1) {
      const closing = /^ {0,3}(`+|~+)[ \t]*(?:\n)?$/.exec(
        lines[candidate] ?? "",
      )?.[1];
      if (
        closing?.[0] === openingFence[0] &&
        closing.length >= openingFence.length
      ) {
        closingIndex = candidate;
        break;
      }
    }

    output.push(protect(lines.slice(index, closingIndex + 1).join("")));
    index = closingIndex;
  }

  return output.join("");
}

export function shouldTranslateSource(source: ProtectedSource): boolean {
  const prose = source.text
    .replace(PLACEHOLDER_RE, " ")
    .replace(/[#>*_~[\](){}`!-]/g, " ");
  const latinCount = prose.match(/\p{Script=Latin}/gu)?.length ?? 0;
  const hanCount = prose.match(/\p{Script=Han}/gu)?.length ?? 0;

  if (latinCount < 4) return false;
  return !(hanCount >= 4 && hanCount * 2 >= latinCount);
}

export function restoreProtectedSource(
  source: ProtectedSource,
  translated: string,
): string {
  const expected = source.values.map((_value, index) => placeholderFor(index));
  const expectedSet = new Set(expected);
  const actual = translated.match(PLACEHOLDER_RE) ?? [];

  const valid =
    actual.length === expected.length &&
    actual.every((placeholder) => expectedSet.has(placeholder)) &&
    expected.every(
      (placeholder) =>
        actual.filter((candidate) => candidate === placeholder).length === 1,
    );
  if (!valid) throw new Error("思考译文占位符不完整");

  let restored = translated;
  source.values.forEach((value, index) => {
    restored = restored.replace(placeholderFor(index), value);
  });
  return restored;
}
