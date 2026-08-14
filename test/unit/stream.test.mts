import { test, expect, describe } from 'vitest';

import { AhoCorasick, Replacer } from '../../src/stream/stream.mts'
import { Boundary, type BoundaryEntry } from '../../src/stream/base.mts'
import { AhoCorasick as AhoCorasickWebStream } from '../../src/stream/web/stream-web.mts'
import { AhoCorasick as AhoCorasickNodeStream } from '../../src/stream/node/stream-node.mts'

describe('replaceSync with boundary', () => {
  // every keyword is matched as a whole word: no \w char may touch either edge
  const wordBoundary: BoundaryEntry = {
    target: () => true,
    boundary: (left, right) => !(/\w/.test(left) && /\w/.test(right)),
  };
  const bracket = (match: string) => `[${match}]`;
  const replaceWord = (keywords: string[], chunks: string[]) =>
    Array.from(new AhoCorasick(keywords, wordBoundary).replaceSync(chunks, bracket)).join('');

  test('standalone keyword is replaced, keyword inside a larger word is kept', () => {
    expect(replaceWord(['cat'], ['a cat and category'])).toBe('a [cat] and category');
  });

  test('keyword followed by a word character is kept', () => {
    expect(replaceWord(['cat'], ['cats'])).toBe('cats');
  });

  test('keyword preceded by a word character is kept', () => {
    expect(replaceWord(['cat'], ['scat'])).toBe('scat');
  });

  test('text start and end count as boundaries', () => {
    expect(replaceWord(['cat'], ['cat sat'])).toBe('[cat] sat');
    expect(replaceWord(['cat'], ['the cat'])).toBe('the [cat]');
    expect(replaceWord(['cat'], ['cat'])).toBe('[cat]');
  });

  test('punctuation adjacent to the keyword counts as a boundary', () => {
    expect(replaceWord(['cat'], ['(cat) cat.'])).toBe('([cat]) [cat].');
  });

  test('boundary is checked across chunk edges', () => {
    // "scat cat": the 1st cat is preceded by 's' from the previous chunk -> kept,
    // the 2nd is preceded by ' ' from the previous chunk and ends the text -> replaced
    expect(replaceWord(['cat'], ['s', 'cat', ' ca', 't'])).toBe('scat [cat]');
  });

  test('right neighbor arriving in the next chunk decides the match', () => {
    expect(replaceWord(['cat'], ['a cat', 's'])).toBe('a cats');
    expect(replaceWord(['cat'], ['a cat', ' x'])).toBe('a [cat] x');
  });

  test('target controls which keywords require the boundary', () => {
    // only "cat" is matched as a whole word; "at" matches anywhere
    const entry: BoundaryEntry = {
      target: (keyword) => keyword === 'cat',
      boundary: (left, right) => !(/\w/.test(left) && /\w/.test(right)),
    };
    const aho = new AhoCorasick(['cat', 'at'], entry);
    const result = Array.from(aho.replaceSync(['scat cat'], bracket)).join('');
    expect(result).toBe('sc[at] [cat]');
  });

  test('rejected match does not suppress later matches', () => {
    expect(replaceWord(['cat'], ['catcat cat'])).toBe('catcat [cat]');
  });

  test('greedy longest match works with boundary', () => {
    expect(replaceWord(['cat', 'cats'], ['cats cat'])).toBe('[cats] [cat]');
  });

  test('non-word characters around multibyte keywords count as boundaries', () => {
    // kanji is not a \w word character, so every occurrence is boundary-delimited
    expect(replaceWord(['東京'], ['東京と東京都'])).toBe('[東京]と[東京]都');
  });

  test('omitted boundary replaces everywhere', () => {
    const aho = new AhoCorasick(['cat']);
    const result = Array.from(aho.replaceSync(['scats'], bracket)).join('');
    expect(result).toBe('s[cat]s');
  });

  test('reposition differential: chunked output equals single-chunk output', () => {
    const mulberry32 = (seed: number) => () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };

    for (let seed = 1; seed <= 50; seed++) {
      const rand = mulberry32(seed);
      const alphabet = 'ab c';
      const randStr = (len: number) => Array.from({ length: len }, () => alphabet[Math.floor(rand() * alphabet.length)]).join('');

      const keywords = Array.from({ length: 1 + Math.floor(rand() * 4) }, () => randStr(1 + Math.floor(rand() * 8)));
      const text = randStr(200 + Math.floor(rand() * 300));
      const aho = new AhoCorasick(keywords, wordBoundary);
      // single chunk never repositions mid-stream, so it serves as the reference
      const expected = Array.from(aho.replaceSync([text], bracket)).join('');

      for (const chunkLen of [1, 3, 7, 30]) {
        const chunks: string[] = [];
        for (let i = 0; i < text.length; i += chunkLen) {
          chunks.push(text.slice(i, i + chunkLen));
        }
        const result = Array.from(aho.replaceSync(chunks, bracket)).join('');
        expect(result, `seed=${seed} chunkLen=${chunkLen} keywords=${JSON.stringify(keywords)}`).toBe(expected);
      }
    }
  });

  test('boundary with long text across amortization reposition', () => {
    const aho = new AhoCorasick(['cat'], wordBoundary);
    const unit = 'cat scat cats concatenate cat, ';
    let text = '';
    for (let i = 0; i < 200; i++) {
      text += unit;
    }
    const expected = text.replace(/\bcat\b/g, '[cat]');

    for (const chunkLen of [1, 3, 7, 13, 50]) {
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += chunkLen) {
        chunks.push(text.slice(i, i + chunkLen));
      }
      const result = Array.from(aho.replaceSync(chunks, bracket)).join('');
      expect(result, `chunkLen=${chunkLen}`).toBe(expected);
    }
  });
});

describe('replaceAsync with boundary', () => {
  const wordBoundary: BoundaryEntry = {
    target: () => true,
    boundary: (left, right) => !(/\w/.test(left) && /\w/.test(right)),
  };

  const replaceAsyncAll = async (aho: AhoCorasick, chunks: string[]) => {
    async function* gen() { for (const chunk of chunks) { yield chunk; } }
    const parts: string[] = [];
    for await (const part of aho.replaceAsync(gen(), (match) => `[${match}]`)) {
      parts.push(part);
    }
    return parts.join('');
  };

  test('standalone keyword is replaced, keyword inside a larger word is kept', async () => {
    const aho = new AhoCorasick(['cat'], wordBoundary);
    expect(await replaceAsyncAll(aho, ['a cat and category'])).toBe('a [cat] and category');
  });

  test('match finalized at flush still respects the boundary', async () => {
    const aho = new AhoCorasick(['cat'], wordBoundary);
    // the match ends at the end of the stream, so it is decided in cleanup
    expect(await replaceAsyncAll(aho, ['scat'])).toBe('scat');
    expect(await replaceAsyncAll(aho, ['the cat'])).toBe('the [cat]');
  });

  test('boundary is checked across chunk edges', async () => {
    const aho = new AhoCorasick(['cat'], wordBoundary);
    expect(await replaceAsyncAll(aho, ['s', 'cat', ' ca', 't'])).toBe('scat [cat]');
  });

  test('omitted boundary replaces everywhere', async () => {
    const aho = new AhoCorasick(['cat']);
    expect(await replaceAsyncAll(aho, ['scats'])).toBe('s[cat]s');
  });
});

describe('Boundary.WhiteSpace', () => {
  const replace = (keywords: string[], chunks: string[], replacement: string) =>
    Array.from(new AhoCorasick(keywords, Boundary.WhiteSpace()).replaceSync(chunks, () => replacement)).join('');

  test('replaces a space-delimited word', () => {
    expect(replace(['cat'], ['a cat and category'], 'DOG')).toBe('a DOG and category');
  });

  test('word at start and end of text', () => {
    expect(replace(['cat'], ['cat and cat'], 'DOG')).toBe('DOG and DOG');
  });

  test('non-whitespace punctuation is NOT a boundary (unlike AsciiTerm)', () => {
    // '(' and ')' are not whitespace, so "(cat)" is not a whole word
    expect(replace(['cat'], ['(cat) cat'], 'DOG')).toBe('(cat) DOG');
  });

  test('tabs and newlines count as boundaries', () => {
    expect(replace(['cat'], ['\tcat\ncat '], 'DOG')).toBe('\tDOG\nDOG ');
  });

  test('boundary spanning chunk edges', () => {
    // text is "x cat cat" split across chunks; both cats are space-delimited
    expect(replace(['cat'], ['x cat', ' ca', 't'], 'DOG')).toBe('x DOG DOG');
  });
});

describe('Boundary.AsciiTerm', () => {
  const replace = (keywords: string[], chunks: string[], replacement: string) =>
    Array.from(new AhoCorasick(keywords, Boundary.AsciiTerm()).replaceSync(chunks, () => replacement)).join('');

  test('replaces standalone word but keeps substring inside a larger word', () => {
    expect(replace(['cat'], ['a cat and category'], 'DOG')).toBe('a DOG and category');
  });

  test('word at the very start is replaced', () => {
    expect(replace(['cat'], ['cat sat'], 'DOG')).toBe('DOG sat');
  });

  test('word at the very end is replaced', () => {
    expect(replace(['cat'], ['the cat'], 'DOG')).toBe('the DOG');
  });

  test('brackets and spaces count as boundaries', () => {
    expect(replace(['cat'], ['(cat) cat'], 'DOG')).toBe('(DOG) DOG');
  });

  test('adjacent word characters (letters and digits) block the match', () => {
    expect(replace(['cat'], ['cat1 scat concatenate'], 'DOG')).toBe('cat1 scat concatenate');
  });

  test('underscore is a word character and blocks the match', () => {
    expect(replace(['cat'], ['_cat_ cat'], 'DOG')).toBe('_cat_ DOG');
  });

  test('technical-term symbols (&, +, #, -) are word characters and block the match', () => {
    // '&' '+' '#' '-' adjacent to cat mean it is part of a larger term; '.' is a boundary
    expect(replace(['cat'], ['cat.js cat&dog cat+ #cat co-cat cat'], 'DOG')).toBe('DOG.js cat&dog cat+ #cat co-cat DOG');
  });

  test('a keyword that is itself a technical term matches on symbol boundaries', () => {
    // "C&C" surrounded by spaces is replaced; the 2nd is joined to 'e' and '.' -> blocked
    expect(replace(['C&C'], ['use C&C here', 'C&C.'], 'X')).toBe('use X hereC&C.');
  });

  test('a symbol-containing keyword is matched as a whole term', () => {
    // "co/jp" delimited by spaces is a whole term ('/' is a word char); "x/co/jp" is part of a larger term
    expect(replace(['co/jp'], ['use co/jp and x/co/jp'], 'X')).toBe('use X and x/co/jp');
  });

  test('non-ASCII keywords are never subject to the whole-term check', () => {
    // Japanese is not word-delimited, so both occurrences match
    expect(replace(['東京'], ['東京と東京都'], 'X')).toBe('XとX都');
  });

  test('boundary that spans chunk edges is respected', () => {
    // the 1st "cat" is preceded by 's' (prev chunk) -> blocked;
    // the 2nd is preceded by ' ' (prev chunk) and ends the text -> replaced
    expect(replace(['cat'], ['s', 'cat', ' ca', 't'], 'DOG')).toBe('scat DOG');
  });

  test('a keyword containing whitespace is still treated as a whole term', () => {
    expect(replace(['ABC CD'], ['go ABC CD go'], 'X')).toBe('go X go');
    // followed by a word character -> part of a larger term -> blocked
    expect(replace(['ABC CD'], ['go ABC CDE go'], 'X')).toBe('go ABC CDE go');
    // any \s inside the term is allowed
    expect(replace(['ABC\tCD'], ['go ABC\tCD go'], 'X')).toBe('go X go');
  });

  test('a keyword with leading / trailing whitespace is not a whole term', () => {
    // " ABC " is not an ascii term, so it matches anywhere
    expect(replace([' ABC '], ['x ABC x'], 'X')).toBe('xXx');
  });

  test('falls back to a shorter keyword when the longer one is blocked by the boundary', () => {
    const aho = new AhoCorasick(['ABC CD', 'ABC'], Boundary.AsciiTerm());
    // "ABC CD" is present but followed by 'E', so it is not a whole term;
    // the earlier "ABC" match must survive instead
    const result = Array.from(aho.replaceSync(['ABC CDE'], (match) => `[${match}]`)).join('');
    expect(result).toBe('[ABC] CDE');
  });

  test('the longer keyword wins when it is a whole term', () => {
    const aho = new AhoCorasick(['ABC CD', 'ABC'], Boundary.AsciiTerm());
    const result = Array.from(aho.replaceSync(['ABC CD END'], (match) => `[${match}]`)).join('');
    expect(result).toBe('[ABC CD] END');
  });

  test('fallback to the shorter keyword works across chunk edges', () => {
    const aho = new AhoCorasick(['ABC CD', 'ABC'], Boundary.AsciiTerm());
    const result = Array.from(aho.replaceSync(['ABC C', 'DE'], (match) => `[${match}]`)).join('');
    expect(result).toBe('[ABC] CDE');
  });
});

describe('Boundary.AsciiEdge', () => {
  const replace = (keywords: string[], chunks: string[], replacement: string) =>
    Array.from(new AhoCorasick(keywords, Boundary.AsciiEdge()).replaceSync(chunks, () => replacement)).join('');

  test('replaces standalone word but keeps substring inside a larger word', () => {
    expect(replace(['cat'], ['a cat and category'], 'DOG')).toBe('a DOG and category');
  });

  test('adjacent word characters block the match', () => {
    expect(replace(['cat'], ['cat1 scat concatenate'], 'DOG')).toBe('cat1 scat concatenate');
  });

  test('brackets and spaces count as boundaries', () => {
    expect(replace(['cat'], ['(cat) cat'], 'DOG')).toBe('(DOG) DOG');
  });

  test('non-ASCII keyword edges always pass', () => {
    // the keyword edges themselves are non-ascii, so surrounding ascii cannot block
    expect(replace(['東京'], ['ab東京cd'], 'X')).toBe('abXcd');
  });

  test('unlike AsciiTerm, the edge check applies to every keyword', () => {
    // '@' makes "ab@cd" not an ascii term: AsciiTerm skips the check, AsciiEdge does not
    const term = Array.from(new AhoCorasick(['ab@cd'], Boundary.AsciiTerm()).replaceSync(['xab@cdy'], () => 'X')).join('');
    expect(term).toBe('xXy');
    expect(replace(['ab@cd'], ['xab@cdy'], 'X')).toBe('xab@cdy');
    expect(replace(['ab@cd'], ['x ab@cd y'], 'X')).toBe('x X y');
  });
});

describe('Boundary.By', () => {
  test('custom separator regex controls the boundary', () => {
    // only '/' separates words
    const aho = new AhoCorasick(['cat'], Boundary.By(/\//));
    const result = Array.from(aho.replaceSync(['/cat/ a cat'], () => 'X')).join('');
    // "/cat/" is delimited by '/' on both sides -> replaced;
    // " cat" ends the text (right ok) but left is ' ' which is NOT a separator -> kept
    expect(result).toBe('/X/ a cat');
  });

  test('whitespace separator reproduces WhiteSpace behaviour', () => {
    const aho = new AhoCorasick(['cat'], Boundary.By(/\s/));
    const result = Array.from(aho.replaceSync(['(cat) cat'], () => 'X')).join('');
    // '(' and ')' are not separators, so "(cat)" is not whole; standalone "cat" is
    expect(result).toBe('(cat) X');
  });

  test('g flag on the separator does not corrupt the boundary via lastIndex', () => {
    // g/y フラグ付き RegExp の test() は lastIndex を進めるステートフルな挙動になる。
    // By() 内でフラグを落として複製していないと、境界判定が呼び出し順で崩れて誤マッチする。
    const aho = new AhoCorasick(['cat'], Boundary.By(/\//g));
    const result = Array.from(aho.replaceSync(['/cat/ a cat'], () => 'X')).join('');
    // フラグなし版 (/\//) と完全に同じ結果になること
    expect(result).toBe('/X/ a cat');
  });
});

describe('empty keyword with boundary', () => {
  // 空キーワード "" は「単語の縁（境界に挟まれた空位置）」でのみマッチする。
  // 非境界位置（'ab' の a→b 間など）ではマッチしない。全 Boundary モードで挙動が一致すること。
  const boundaries: [name: string, entry: BoundaryEntry][] = [
    ['WhiteSpace', Boundary.WhiteSpace()],
    ['AsciiTerm', Boundary.AsciiTerm()],
    ['AsciiEdge', Boundary.AsciiEdge()],
    ['By(/\\s/)', Boundary.By(/\s/)],
  ];

  for (const [name, entry] of boundaries) {
    const replace = (keywords: string[], chunks: string[], replacement: string) =>
      Array.from(new AhoCorasick(keywords, entry).replaceSync(chunks, () => replacement)).join('');

    describe(name, () => {
      test('matches only at word edges, not inside a word', () => {
        // "ab" is a single word -> empty matches at its leading/trailing edge only
        expect(replace([''], ['ab'], '#')).toBe('#ab#');
      });

      test('matches at every word edge', () => {
        // "a b" -> two words; empty matches at each edge, whitespace untouched
        expect(replace([''], ['a b'], '#')).toBe('#a# #b#');
      });

      test('empty text yields a single empty match', () => {
        expect(replace([''], [''], '#')).toBe('#');
      });

      test('no chunks at all still yields a single empty match', () => {
        expect(replace([''], [], '#')).toBe('#');
      });

      test('empty keyword alongside a normal keyword', () => {
        // "a" is a standalone word here -> replaced; empty matches at each word edge.
        // (in "a b" both "a" and "b" are single-char words; only "a" is a keyword)
        expect(replace(['', 'a'], ['a b'], '#')).toBe('## #b#');
      });

      test('empty match survives chunk boundaries', () => {
        expect(replace([''], ['a', 'b'], '#')).toBe('#ab#');
      });
    });
  }
});

describe('replaceStream with boundary', () => {
  const chunks = ['s', 'cat', ' ca', 't'];
  const expected = 'scat [cat]';

  test('Web Stream replaceStream accepts boundary', async () => {
    const aho = new AhoCorasickWebStream(['cat'], Boundary.AsciiTerm());
    const readable = new ReadableStream<string>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      }
    });
    const transform = aho.replaceStream((match) => `[${match}]`);

    let result = '';
    const writable = new WritableStream<string>({
      write(chunk) {
        result += chunk;
      }
    });
    await readable.pipeThrough(transform).pipeTo(writable);

    expect(result).toBe(expected);
  });

  test('Node Stream replaceStream accepts boundary', async () => {
    const aho = new AhoCorasickNodeStream(['cat'], Boundary.AsciiTerm());
    const readable_web = new ReadableStream<string>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      }
    });
    const { Readable, Writable } = await import("node:stream" as any);
    const readable_node = Readable.fromWeb(readable_web, { objectMode: true });

    const transform = aho.replaceStream((match) => `[${match}]`);

    let result = '';
    const writable_web = new WritableStream<string>({
      write(chunk) {
        result += chunk;
      }
    });
    const writable_node = Writable.fromWeb(writable_web)

    readable_node.pipe(transform).pipe(writable_node);
    await new Promise((resolve, reject) => {
      writable_node.on('finish', resolve);
      readable_node.on('error', reject);
      transform.on('error', reject);
      writable_node.on('error', reject);
    });

    expect(result).toBe(expected);
  });
});
