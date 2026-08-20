/**
 * Minimal markdown-fence splitter + C# tokenizer used to render AiChatHub's
 * streamed answers with VS Code Dark+-style code blocks. Re-parses the full
 * accumulated answer on every chunk rather than diffing incrementally - the
 * strings involved are chat-answer sized, so this stays cheap.
 */

export interface CodeToken {
  text: string;
  cls: 'keyword' | 'type' | 'string' | 'comment' | 'number' | 'method' | 'plain';
}

export interface InlineTextPart {
  text: string;
  bold: boolean;
  code: boolean;
}

export type MessageSegment =
  | { type: 'text'; parts: InlineTextPart[] }
  | { type: 'code'; lang: string; tokens: CodeToken[] };

const CSHARP_KEYWORDS = new Set([
  'public', 'private', 'protected', 'internal', 'static', 'readonly', 'const', 'sealed',
  'abstract', 'override', 'virtual', 'class', 'interface', 'struct', 'enum', 'namespace',
  'using', 'partial', 'void', 'var', 'new', 'return', 'if', 'else', 'for', 'foreach',
  'while', 'do', 'switch', 'case', 'break', 'continue', 'default', 'try', 'catch',
  'finally', 'throw', 'async', 'await', 'yield', 'in', 'out', 'ref', 'params', 'is',
  'as', 'typeof', 'nameof', 'get', 'set', 'required', 'this', 'base', 'null', 'true',
  'false', 'string', 'int', 'bool', 'double', 'float', 'long', 'short', 'byte', 'char',
  'object', 'decimal', 'uint', 'ulong', 'ushort', 'event', 'delegate', 'operator',
]);

// comment | string (incl. $"..." and @"...") | number | identifier | run of other chars.
// The fallback group excludes "/" (with its own single-char alternative) so a
// greedy run of punctuation never swallows a "//" or "/*" before the comment
// alternative gets a chance to match starting at that position.
const CSHARP_TOKEN_PATTERN =
  /(\/\/.*|\/\*[\s\S]*?\*\/)|(\$?@?"(?:[^"\\]|\\.)*")|(\b\d+\.?\d*[fFdDmMuUlL]?\b)|([A-Za-z_]\w*)|([ \t]+|\r?\n|[^\w"/]+|\/)/g;

export function tokenizeCSharp(code: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  CSHARP_TOKEN_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = CSHARP_TOKEN_PATTERN.exec(code)) !== null) {
    const [, comment, string, number, identifier, other] = match;

    if (comment !== undefined) {
      tokens.push({ text: comment, cls: 'comment' });
    } else if (string !== undefined) {
      tokens.push({ text: string, cls: 'string' });
    } else if (number !== undefined) {
      tokens.push({ text: number, cls: 'number' });
    } else if (identifier !== undefined) {
      const followedByParen = code.slice(CSHARP_TOKEN_PATTERN.lastIndex).match(/^\s*\(/);
      if (followedByParen) {
        tokens.push({ text: identifier, cls: 'method' });
      } else if (CSHARP_KEYWORDS.has(identifier)) {
        tokens.push({ text: identifier, cls: 'keyword' });
      } else if (/^[A-Z]/.test(identifier)) {
        tokens.push({ text: identifier, cls: 'type' });
      } else {
        tokens.push({ text: identifier, cls: 'plain' });
      }
    } else if (other !== undefined) {
      tokens.push({ text: other, cls: 'plain' });
    }
  }

  return tokens;
}

// "**" and "`" are independent toggles rather than a flat split, so a code
// span nested inside a bold run (e.g. "**Registers `X` → `Y`**") ends up
// tagged bold *and* code instead of losing the bold styling partway through.
const INLINE_TOKEN_PATTERN = /\*\*|`|[^`*]+|\*/g;

export function parseInline(text: string): InlineTextPart[] {
  const parts: InlineTextPart[] = [];
  let bold = false;
  let code = false;

  INLINE_TOKEN_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_TOKEN_PATTERN.exec(text)) !== null) {
    const token = match[0];

    if (token === '**') {
      bold = !bold;
    } else if (token === '`') {
      code = !code;
    } else {
      parts.push({ text: token, bold, code });
    }
  }

  return parts;
}

function tokenizeByLanguage(lang: string, code: string): CodeToken[] {
  const normalized = lang.trim().toLowerCase();
  if (normalized === 'csharp' || normalized === 'cs' || normalized === 'c#') {
    return tokenizeCSharp(code);
  }
  return [{ text: code, cls: 'plain' }];
}

/** Splits raw streamed markdown into text/code segments on ``` fences. An
 * unterminated trailing fence (still streaming in) is treated as an
 * in-progress code block rather than left as literal text. */
export function parseMessageSegments(raw: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const fenceRegex = /```(\w*)\n?/g;

  let cursor = 0;
  let inCode = false;
  let codeLang = '';
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(raw)) !== null) {
    const before = raw.slice(cursor, match.index);

    if (inCode) {
      if (before) {
        segments.push({ type: 'code', lang: codeLang, tokens: tokenizeByLanguage(codeLang, before) });
      }
      inCode = false;
      codeLang = '';
    } else {
      if (before) {
        segments.push({ type: 'text', parts: parseInline(before) });
      }
      inCode = true;
      codeLang = match[1] ?? '';
    }

    cursor = fenceRegex.lastIndex;
  }

  const rest = raw.slice(cursor);
  if (rest) {
    segments.push(
      inCode
        ? { type: 'code', lang: codeLang, tokens: tokenizeByLanguage(codeLang, rest) }
        : { type: 'text', parts: parseInline(rest) },
    );
  }

  return segments;
}
