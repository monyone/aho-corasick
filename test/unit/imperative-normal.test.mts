import { test, expect, describe } from 'vitest';

import { AhoCorasick } from '../../src/stream/imperative/normal.mts'
import { Boundary, type BoundaryEntry } from '../../src/stream/base.mts'

// drive an ImperativeHandle over the chunks and join every emitted part
const drive = <T,>(handle: { write(chunk: string): T[]; end(): T[] }, chunks: string[]): T[] => {
  const parts: T[] = [];
  for (const chunk of chunks) { parts.push(...handle.write(chunk)); }
  parts.push(...handle.end());
  return parts;
};

const replace = (keywords: string[], chunks: string[], replacer: (m: string) => string, boundary?: BoundaryEntry) =>
  drive(new AhoCorasick(keywords, boundary).replaceSync(replacer), chunks).join('');

describe('replaceSync', () => {
  test('Basic replacement with single keyword', () => {
    expect(replace(['abc'], ['hello abc world'], () => 'XXX')).toBe('hello XXX world');
  });

  test('Replacement with multiple keywords', () => {
    expect(replace(['abc', 'world'], ['hello abc world'], (m) => `[${m}]`)).toBe('hello [abc] [world]');
  });

  test('Replacement across chunk boundaries', () => {
    expect(replace(['abc'], ['hello a', 'bc world'], () => 'XXX')).toBe('hello XXX world');
  });

  test('Multiple replacements across chunk boundaries', () => {
    expect(replace(['abc', 'def'], ['ab', 'cd', 'ef'], (m) => `[${m}]`)).toBe('[abc][def]');
  });

  test('Greedy longest match at same position', () => {
    expect(replace(['a', 'ab', 'abc'], ['abc'], (m) => `[${m}]`)).toBe('[abc]');
  });

  test('Greedy non-overlapping matches', () => {
    expect(replace(['ab', 'ba', 'aba'], ['ababa'], (m) => `[${m}]`)).toBe('[aba][ba]');
  });

  test('Greedy non-overlapping matches across char chunks', () => {
    expect(replace(['ab', 'ba', 'aba'], ['a', 'b', 'a', 'b', 'a'], (m) => `[${m}]`)).toBe('[aba][ba]');
  });

  test('No matches returns original text', () => {
    expect(replace(['xyz'], ['hello world'], () => 'XXX')).toBe('hello world');
  });

  test('Empty text input', () => {
    expect(replace(['test'], [''], () => 'XXX')).toBe('');
  });

  test('No writes at all, only end', () => {
    expect(drive(new AhoCorasick(['test']).replaceSync(() => 'X'), []).join('')).toBe('');
  });

  test('Replacement with multibyte characters (adjacent)', () => {
    expect(replace(['シロナ', 'ガス', 'クジラ'], ['シロナガスクジラ'], (m) => `[${m}]`)).toBe('[シロナ][ガス][クジラ]');
  });

  test('Replacement with multibyte characters (gap)', () => {
    expect(replace(['シロナ', 'クジラ'], ['シロナガスクジラ'], (m) => `[${m}]`)).toBe('[シロナ]ガス[クジラ]');
  });

  test('Multibyte replacement across chunk boundaries', () => {
    expect(replace(['シロナガス'], ['シロ', 'ナガ', 'ス'], () => 'XXX')).toBe('XXX');
  });

  test('Overlapping patterns prefer longest', () => {
    expect(replace(['test', 'testing', 'tes'], ['testing'], (m) => `[${m}]`)).toBe('[testing]');
  });

  test('Chunk boundary at match start / end', () => {
    expect(replace(['xyz'], ['abc', 'xyz', 'def'], (m) => `[${m}]`)).toBe('abc[xyz]def');
    expect(replace(['abc'], ['xyz', 'abc', 'def'], (m) => `[${m}]`)).toBe('xyz[abc]def');
  });

  test('Replacement with failure link traversal', () => {
    expect(replace(['abc', 'bde'], ['ab', 'de'], (m) => `[${m}]`)).toBe('a[bde]');
  });

  test('Emoji replacement', () => {
    expect(replace(['👍', '🎉'], ['Hello👍World🎉'], (m) => `[${m}]`)).toBe('Hello[👍]World[🎉]');
  });

  test('Emoji across chunk boundaries', () => {
    expect(replace(['👨‍👩‍👧'], ['👨‍', '👩‍', '👧'], () => '[FAMILY]')).toBe('[FAMILY]');
  });

  test('Confirmed index advance on failure', () => {
    expect(replace(['dcbacbax', 'ba', 'cba', 'dc', 'cb', 'a'], ['dcb', 'acb', 'a'], (m) => `[${m}]`)).toBe('[dc][ba][cba]');
  });

  test('Very long keyword across many chunks', () => {
    const longKeyword = 'a'.repeat(1000);
    const chunks = longKeyword.match(/.{1,10}/g) || [];
    expect(replace([longKeyword], chunks, () => 'LONG')).toBe('LONG');
  });

  test('Collector amortization: long passthrough text with no matches', () => {
    let text = '';
    for (let i = 0; i < 1000; i++) { text += 'the quick brown fox jumps '; }
    for (const chunkLen of [1, 3, 9, 50]) {
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += chunkLen) { chunks.push(text.slice(i, i + chunkLen)); }
      expect(replace(['zzz', 'notfound'], chunks, () => 'X'), `chunkLen=${chunkLen}`).toBe(text);
    }
  });

  test('Streaming data simulation with incomplete matches at chunk ends', () => {
    const chunks = ['no', 'mat', 'ch h', 'ere', ' mat', 'ch1 ', 'and ', 'mat', 'ch2', ' plu', 's ma', 'tch3'];
    expect(replace(['match1', 'match2', 'match3'], chunks, (m) => `[${m}]`)).toBe('nomatch here [match1] and [match2] plus [match3]');
  });
});

describe('replaceSync equivalence with single-chunk reference', () => {
  // every keyword is matched as a whole word: no \w char may touch either edge
  const wordBoundary: BoundaryEntry = {
    target: () => true,
    boundary: (left, right) => !(/\w/.test(left) && /\w/.test(right)),
  };
  const bracket = (m: string) => `[${m}]`;

  test('chunked write() output equals single write() output', () => {
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
      const expected = replace(keywords, [text], bracket, wordBoundary);

      for (const chunkLen of [1, 3, 7, 30]) {
        const chunks: string[] = [];
        for (let i = 0; i < text.length; i += chunkLen) { chunks.push(text.slice(i, i + chunkLen)); }
        const result = replace(keywords, chunks, bracket, wordBoundary);
        expect(result, `seed=${seed} chunkLen=${chunkLen} keywords=${JSON.stringify(keywords)}`).toBe(expected);
      }
    }
  });
});

describe('replaceSync with boundary', () => {
  // every keyword is matched as a whole word: no \w char may touch either edge
  const wordBoundary: BoundaryEntry = {
    target: () => true,
    boundary: (left, right) => !(/\w/.test(left) && /\w/.test(right)),
  };
  const bracket = (m: string) => `[${m}]`;

  test('standalone keyword is replaced, keyword inside a larger word is kept', () => {
    expect(replace(['cat'], ['a cat and category'], bracket, wordBoundary)).toBe('a [cat] and category');
  });

  test('text start and end count as boundaries', () => {
    expect(replace(['cat'], ['cat sat'], bracket, wordBoundary)).toBe('[cat] sat');
    expect(replace(['cat'], ['the cat'], bracket, wordBoundary)).toBe('the [cat]');
  });

  test('boundary is checked across chunk edges', () => {
    expect(replace(['cat'], ['s', 'cat', ' ca', 't'], bracket, wordBoundary)).toBe('scat [cat]');
  });

  test('right neighbor arriving in the next chunk decides the match', () => {
    expect(replace(['cat'], ['a cat', 's'], bracket, wordBoundary)).toBe('a cats');
    expect(replace(['cat'], ['a cat', ' x'], bracket, wordBoundary)).toBe('a [cat] x');
  });

  test('Boundary.AsciiTerm falls back to a shorter keyword when the longer one is blocked', () => {
    const result = drive(new AhoCorasick(['ABC CD', 'ABC'], Boundary.AsciiTerm()).replaceSync((m) => `[${m}]`), ['ABC CDE']).join('');
    expect(result).toBe('[ABC] CDE');
  });
});

describe('tokenizeSync', () => {
  test('tokenizes normal text and keywords into tagged objects', () => {
    const handle = new AhoCorasick(['cat', 'dog']).tokenizeSync(
      (chunk) => ({ type: 'text' as const, value: chunk }),
      (keyword) => ({ type: 'match' as const, value: keyword }),
    );
    const tokens = drive(handle, ['a cat and a dog']);
    expect(tokens).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'match', value: 'cat' },
      { type: 'text', value: ' and a ' },
      { type: 'match', value: 'dog' },
    ]);
  });

  test('reassembling token values reproduces the input', () => {
    const handle = new AhoCorasick(['fox', 'dog']).tokenizeSync(
      (chunk) => chunk,
      (keyword) => keyword.toUpperCase(),
    );
    const chunks = ['the ', 'quick fo', 'x and the ', 'dog'];
    const tokens = drive(handle, chunks);
    expect(tokens.join('')).toBe('the quick FOX and the DOG');
  });
});

describe('replaceAsync (Promise-returning replacer)', () => {
  // drive an AsyncImperativeHandle: await each write/end and collect resolved parts
  const driveAsync = async (
    handle: { write(chunk: string): Promise<string[]>; end(): Promise<string[]> },
    chunks: string[],
  ): Promise<string[]> => {
    const parts: string[] = [];
    for (const chunk of chunks) { parts.push(...(await handle.write(chunk))); }
    parts.push(...(await handle.end()));
    return parts;
  };

  test('async replacer resolves to the replacement', async () => {
    const handle = new AhoCorasick(['cat']).replaceAsync(async (m) => `[${m}]`);
    const parts = await driveAsync(handle, ['a cat here']);
    expect(parts.join('')).toBe('a [cat] here');
  });

  test('sync passthrough text is emitted as plain strings', async () => {
    const handle = new AhoCorasick(['zzz']).replaceAsync(async (m) => m);
    const parts = await handle.write('hello');
    expect(parts).toEqual(['hello']);
  });
});

describe('leftmost-longest regression with Boundary.AsciiEdge (fuzz findings)', () => {
  const bracket = (m: string) => `[${m}]`;
  const replaceEdge = (keywords: string[], chunks: string[]) =>
    drive(new AhoCorasick(keywords, Boundary.AsciiEdge()).replaceSync(bracket), chunks).join('');

  // the same text must produce the same output under any chunking
  const check = (keywords: string[], text: string, expected: string) => {
    const chunkings: string[][] = [[text], text.split('')];
    for (const n of [2, 3, 5]) {
      const parts: string[] = [];
      for (let i = 0; i < text.length; i += n) { parts.push(text.slice(i, i + n)); }
      chunkings.push(parts);
    }
    for (const chunks of chunkings) {
      expect(replaceEdge(keywords, chunks), `chunks=${JSON.stringify(chunks)}`).toBe(expected);
    }
  };

  test('trailing short keyword right after a longer match at end of text', () => {
    check([' ', '  ', 'c', 'a '], ' a  ', '[ ][a ][ ]');
    check(['cbc', ' ', '   '], 'ca c c bba    ', 'ca[ ]c[ ]c[ ]bba[   ][ ]');
    check(['cb', ' ', '  ', 'bbc'], 'baaaca   bccc b   ', 'baaaca[  ][ ]bccc[ ]b[  ][ ]');
  });

  test('flush at end of text picks the shorter suffix keyword after a longer match', () => {
    check([' ', 'bb ', '  b', '  '], 'a  b   ', 'a[  b][  ][ ]');
  });

  test('shorter suffix keyword wins when the longest one overlaps a pending candidate', () => {
    check(['   ca', '  ', ' '], 'aaaab aabcaa   abc', 'aaaab[ ]aabcaa[  ][ ]abc');
  });

  test('a losing candidate must not drop already-valid pending matches', () => {
    check(['bb', '   ', 'abb    aa', ' ', ' b      a'], ' b b     b b a  aa b aab   a b b  ',
      '[ ]b[ ]b[   ][ ][ ]b[ ]b[ ]a[ ][ ]aa[ ]b[ ]aab[   ]a[ ]b[ ]b[ ][ ]');
    check([' ', '  b  bbbba', 'a ', 'a    ab  ', '    '], 'ab  aabba a    aa   bba    aaba ab b  b   aa',
      'ab[ ][ ]aabba[ ][a ][ ][ ][ ]aa[ ][ ][ ]bba[    ]aaba[ ]ab[ ]b[ ][ ]b[ ][ ][ ]aa');
    check(['        a', ' ', '  ', 'a   a   a', 'aa  bbbaa ', '    '], '       a   ab a a  b  a  abb    a    a  ba bb       a aba ',
      '[    ][  ][ ]a[  ][ ]ab[ ]a[ ]a[  ]b[  ]a[  ]abb[    ]a[    ]a[  ]ba[ ]bb[    ][  ][ ]a[ ]aba[ ]');
    check([' b      a', ' a  ', ' a  a   b', ' ', '  ', ' b '], '  aaab bb   abb  b           a  a   ab    ',
      '[  ]aaab[ ]bb[  ][ ]abb[  ]b[  ][  ][  ][  ][  ][ a  ]a[  ][ ]ab[  ][  ]');
  });
});
