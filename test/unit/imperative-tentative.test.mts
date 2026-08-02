import { test, expect, describe } from 'vitest';

import { AhoCorasick } from '../../src/stream/imperative/tentative.mts'

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
