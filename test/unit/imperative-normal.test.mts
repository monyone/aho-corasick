import { test, expect, describe } from 'vitest';

import { AhoCorasick } from '../../src/stream/imperative/normal.mts'
import { Boundary, type BoundaryFunc } from '../../src/stream/base.mts'
import RingBuffer from '../../src/stream/ringbuffer.mts'

// drive an ImperativeHandle over the chunks and join every emitted part
const drive = <T>(handle: { write(chunk: string): T[]; end(): T[] }, chunks: string[]): T[] => {
  const parts: T[] = [];
  for (const chunk of chunks) { parts.push(...handle.write(chunk)); }
  parts.push(...handle.end());
  return parts;
};

const replace = (keywords: string[], chunks: string[], replacer: (m: string) => string, boundary?: BoundaryFunc) =>
  drive(new AhoCorasick(keywords).replaceSync(replacer, boundary), chunks).join('');

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
  const wordBoundary: BoundaryFunc = (_, left, right) => !(/\w/.test(left) && /\w/.test(right));
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
  const wordBoundary: BoundaryFunc = (_, left, right) => !(/\w/.test(left) && /\w/.test(right));
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
    const result = drive(new AhoCorasick(['ABC CD', 'ABC']).replaceSync((m) => `[${m}]`, Boundary.AsciiTerm()), ['ABC CDE']).join('');
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
  test('async replacer produces Promise parts that resolve to the replacement', async () => {
    const handle = new AhoCorasick(['cat']).replaceAsync(async (m) => `[${m}]`);
    const parts = drive(handle, ['a cat here']);
    const resolved = await Promise.all(parts.map((p) => Promise.resolve(p)));
    expect(resolved.join('')).toBe('a [cat] here');
  });

  test('sync replacement values are emitted as plain strings', async () => {
    // passthrough text is never wrapped in a Promise
    const handle = new AhoCorasick(['zzz']).replaceAsync(async (m) => m);
    const parts = handle.write('hello');
    expect(parts).toEqual(['hello']);
  });
});

describe('RingBuffer.slice', () => {
  test('returns the whole buffer when no bounds are given', () => {
    const ring = new RingBuffer<string>(8);
    for (const ch of 'abcde') { ring.push(ch); }
    expect(ring.slice().join('')).toBe('abcde');
  });

  test('slices by absolute position', () => {
    const ring = new RingBuffer<string>(8);
    for (const ch of 'abcde') { ring.push(ch); }
    expect(ring.slice(1, 3).join('')).toBe('bc');
    expect(ring.slice(2).join('')).toBe('cde');
  });

  test('clamps bounds to the retained window (no null holes)', () => {
    const ring = new RingBuffer<string>(3);
    for (const ch of 'abcdef') { ring.push(ch); }
    // only the last 3 chars survive; asking from 0 clamps to the retained window
    expect(ring.slice(0).join('')).toBe('def');
    // an out-of-range window yields nothing rather than "null"
    expect(ring.slice(0, 2).join('')).toBe('');
  });

  test('empty when begin >= end', () => {
    const ring = new RingBuffer<string>(4);
    for (const ch of 'abc') { ring.push(ch); }
    expect(ring.slice(2, 2).join('')).toBe('');
    expect(ring.slice(3, 1).join('')).toBe('');
  });

  test('tracks slice window after reposition', () => {
    const ring = new RingBuffer<string>(8);
    for (const ch of 'abc') { ring.push(ch); }
    ring.reposition(2);
    // positions shift by -2: 'a'->-2, 'b'->-1, 'c'->0
    expect(ring.slice(-1).join('')).toBe('bc');
    ring.push('d');
    expect(ring.slice(0).join('')).toBe('cd');
  });
});
