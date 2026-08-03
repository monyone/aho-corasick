import { test, expect, describe } from 'vitest';

import { AhoCorasick, Boundary } from '../../src/stream/imperative/tentative.mts'
import { AhoCorasick as NormalAhoCorasick } from '../../src/stream/imperative/normal.mts'
import type { BoundaryEntry } from '../../src/stream/base.mts'

// drive an ImperativeWithTentativeHandle over the chunks, collecting every
// confirmed part plus the final tentative tail (mirrors how a real caller
// reassembles the full output: all confirmed pieces, then whatever is still
// pending after the last write, then anything end() drains).
const driveWithTentative = <T, K, U,>(
  handle: { write(chunk: string): { confirmed: (T | K)[]; tentative: U }; end(): (T | K)[] },
  chunks: string[],
): { confirmed: (T | K)[]; tentative: U } => {
  const confirmed: (T | K)[] = [];
  let tentative: U = undefined as unknown as U;
  for (const chunk of chunks) {
    const r = handle.write(chunk);
    confirmed.push(...r.confirmed);
    tentative = r.tentative;
  }
  confirmed.push(...handle.end());
  return { confirmed, tentative };
};

describe('replaceSync (tentative)', () => {
  const bracket = (m: string) => `[${m}]`;

  test('confirmed output plus tentative tail sums to the whole processed text', () => {
    const handle = new AhoCorasick(['abc']).replaceSync(bracket);
    // "ab" cannot be confirmed yet: it may still grow into "abc"
    const first = handle.write('ab');
    expect(first.confirmed.join('')).toBe('');
    expect(first.tentative).toBe('ab');
    // completing the keyword confirms the replacement, tentative drains
    const second = handle.write('c world');
    expect((first.confirmed.join('') + second.confirmed.join('')) + second.tentative).toContain('[abc]');
    const rest = handle.end();
    const full = first.confirmed.join('') + second.confirmed.join('') + rest.join('');
    expect(full).toBe('[abc] world');
  });

  test('no match: text flows out as confirmed / tentative and reassembles', () => {
    const handle = new AhoCorasick(['zzz']).replaceSync(bracket);
    const chunks = ['hello ', 'world ', 'foo'];
    let confirmed = '';
    let tentative = '';
    for (const chunk of chunks) {
      const r = handle.write(chunk);
      confirmed += r.confirmed.join('');
      tentative = r.tentative;
    }
    confirmed += handle.end().join('');
    expect(confirmed + '').toBe('hello world foo');
    // after the final write, nothing is pending
    expect(tentative).toBe('');
  });

  test('tentative equals the unconfirmed suffix of a keyword', () => {
    const handle = new AhoCorasick(['abcdef'].sort()).replaceSync(bracket);
    const r = handle.write('xyzabc');
    // "xyz" is safely passed through; "abc" is a live prefix of the keyword
    expect(r.confirmed.join('')).toBe('xyz');
    expect(r.tentative).toBe('abc');
  });

  test('Basic replacement equivalence with non-tentative variant', () => {
    const handle = new AhoCorasick(['abc', 'world']).replaceSync(bracket);
    // driveWithTentative()'s confirmed already includes what end() drains,
    // so the trailing tentative (captured before end()) is not appended again.
    const { confirmed } = driveWithTentative(handle, ['hello abc world']);
    expect(confirmed.join('')).toBe('hello [abc] [world]');
  });
});

describe('tokenizeSync (tentative)', () => {
  test('tentative callback receives the unconfirmed suffix', () => {
    const handle = new AhoCorasick(['abc']).tokenizeSync(
      (chunk) => ({ kind: 'text', v: chunk }),
      (keyword) => ({ kind: 'key', v: keyword }),
      (tentative) => ({ kind: 'pending', v: tentative }),
    );
    const r = handle.write('xxab');
    expect(r.tentative).toEqual({ kind: 'pending', v: 'ab' });
    expect(r.confirmed).toEqual([{ kind: 'text', v: 'xx' }]);
  });
});

describe('replaceAsync (tentative, Promise-returning replacer)', () => {
  // async counterpart of driveWithTentative: await each write/end
  const driveWithTentativeAsync = async <T, K, U,>(
    handle: {
      write(chunk: string): Promise<{ confirmed: (T | K)[]; tentative: U }>;
      end(): Promise<(T | K)[]>;
    },
    chunks: string[],
  ): Promise<{ confirmed: (T | K)[]; tentative: U }> => {
    const confirmed: (T | K)[] = [];
    let tentative: U = undefined as unknown as U;
    for (const chunk of chunks) {
      const r = await handle.write(chunk);
      confirmed.push(...r.confirmed);
      tentative = r.tentative;
    }
    confirmed.push(...(await handle.end()));
    return { confirmed, tentative };
  };

  test('async replacer resolves to the replacement', async () => {
    const handle = new AhoCorasick(['cat']).replaceAsync(async (m) => `[${m}]`);
    const { confirmed } = await driveWithTentativeAsync(handle, ['a cat here']);
    expect(confirmed.join('')).toBe('a [cat] here');
  });
});

describe('tentative correctness under many small chunks (long-running growth)', () => {
  test('tentative tracks the live unconfirmed prefix over a long single keyword fed byte by byte', () => {
    const longKeyword = 'a'.repeat(500) + 'END';
    const handle = new AhoCorasick([longKeyword]).replaceSync((m) => `[${m}]`);

    let confirmed = '';
    let lastTentative = '';
    for (const ch of longKeyword.slice(0, -1)) {
      const r = handle.write(ch);
      confirmed += r.confirmed.join('');
      lastTentative = r.tentative;
    }
    // nothing should be confirmed yet: every char extends the live prefix of the keyword
    expect(confirmed).toBe('');
    expect(lastTentative).toBe(longKeyword.slice(0, -1));

    const final = handle.write('D');
    // end() flushes whatever is still tentative after the last write, so it
    // is not added again on top of final.tentative.
    const rest = handle.end();
    const full = confirmed + final.confirmed.join('') + rest.join('');
    expect(full).toBe(`[${longKeyword}]`);
  });
});

describe('tentative with nested keywords', () => {
  test('tentative grows along the longer keyword even after a shorter one matched', () => {
    const handle = new AhoCorasick(['a', 'aaa']).replaceSync((m) => `[${m}]`);
    // "a" already matched but may still become "aaa": both stay tentative
    expect(handle.write('a').tentative).toBe('a');
    expect(handle.write('a').tentative).toBe('aa');
    // 'b' kills the "aaa" candidate: both "a" matches are decided at once
    const r = handle.write('b');
    expect(r.confirmed.join('')).toBe('[a][a]b');
    expect(r.tentative).toBe('');
    expect(handle.end().join('')).toBe('');
  });
});

describe('replaceSync (tentative) with boundary', () => {
  test('keyword completed but right edge undecided stays tentative', () => {
    const handle = new AhoCorasick(['cat'], Boundary.AsciiTerm()).replaceSync((m) => `[${m}]`);
    expect(handle.write('the ')).toEqual({ confirmed: ['the '], tentative: '' });
    expect(handle.write('ca')).toEqual({ confirmed: [], tentative: 'ca' });
    // "cat" is complete, but the next char decides whether it is a whole word
    expect(handle.write('t')).toEqual({ confirmed: [], tentative: 'cat' });
    // 's' joins the word: the match is rejected and the raw text flows out
    const rejected = handle.write('s are');
    expect(rejected.confirmed.join('')).toBe('cats are');
    expect(rejected.tentative).toBe('');
    expect(handle.end()).toEqual([]);
  });

  test('boundary arriving in the next chunk confirms the pending keyword', () => {
    const handle = new AhoCorasick(['cat'], Boundary.AsciiTerm()).replaceSync((m) => `[${m}]`);
    handle.write('the ');
    handle.write('ca');
    expect(handle.write('t').tentative).toBe('cat');
    expect(handle.write(' x').confirmed.join('')).toBe('[cat] x');
    expect(handle.end().join('')).toBe('');
  });

  test('keyword pending at end of stream is decided by end()', () => {
    const handle = new AhoCorasick(['cat'], Boundary.AsciiTerm()).replaceSync((m) => `[${m}]`);
    expect(handle.write('the cat').tentative).toBe('cat');
    // the end of text is a boundary, so the match is confirmed at flush
    expect(handle.end().join('')).toBe('[cat]');
  });
});

describe('tentative invariants (seeded fuzz)', () => {
  const mulberry32 = (seed: number) => () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  test('reassembly, equivalence with normal variant, and keyword-prefix property', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rand = mulberry32(seed);
      const alphabet = 'ab   ';
      const randStr = (len: number) => Array.from({ length: len }, () => alphabet[Math.floor(rand() * alphabet.length)]).join('');

      const keywords = Array.from({ length: 1 + Math.floor(rand() * 5) }, () => randStr(1 + Math.floor(rand() * 8)))
        .filter((v, i, a) => a.indexOf(v) === i);
      const text = randStr(3 + Math.floor(rand() * 30));
      const boundary: BoundaryEntry | undefined = rand() < 0.5 ? Boundary.AsciiEdge() : undefined;

      const chunks: string[] = [];
      { let i = 0; while (i < text.length) { const n = 1 + Math.floor(rand() * 4); chunks.push(text.slice(i, i + n)); i += n; } }
      const label = `seed=${seed} keywords=${JSON.stringify(keywords)} chunks=${JSON.stringify(chunks)}`;

      // (A) keep replacer: after every write, confirmed-so-far + tentative equals the consumed input
      {
        const handle = new AhoCorasick(keywords, boundary).replaceSync(() => false);
        let confirmed = '', consumed = '';
        for (const chunk of chunks) {
          const r = handle.write(chunk);
          confirmed += r.confirmed.join('');
          consumed += chunk;
          expect(confirmed + r.tentative, label).toBe(consumed);
        }
        confirmed += handle.end().join('');
        expect(confirmed, label).toBe(text);
      }

      // (B) final output equals the normal (non-tentative) variant
      // (C) tentative is always a prefix of some keyword
      {
        const tentativeHandle = new AhoCorasick(keywords, boundary).replaceSync((m) => `[${m}]`);
        const normalHandle = new NormalAhoCorasick(keywords, boundary).replaceSync((m) => `[${m}]`);
        let tentativeOut = '', normalOut = '';
        for (const chunk of chunks) {
          const r = tentativeHandle.write(chunk);
          tentativeOut += r.confirmed.join('');
          normalOut += normalHandle.write(chunk).join('');
          expect(keywords.some((k) => k.startsWith(r.tentative)), `${label} tentative=${JSON.stringify(r.tentative)}`).toBe(true);
        }
        tentativeOut += tentativeHandle.end().join('');
        normalOut += normalHandle.end().join('');
        expect(tentativeOut, label).toBe(normalOut);
      }
    }
  });
});
