import { test, expect, describe } from 'vitest';

import { AhoCorasick } from '../../src/stream/imperative/optimistic.mts'
import { AhoCorasick as NormalAhoCorasick } from '../../src/stream/imperative/normal.mts'
import { Boundary } from '../../src/stream/base.mts'
import type { BoundaryEntry } from '../../src/stream/base.mts'

// tagged tokens so we can tell a normal chunk from a matched keyword and still
// recover the original text (v holds the raw substring / keyword either way).
type Tok = { kind: 'n' | 'k'; v: string };
const normal = (v: string): Tok => ({ kind: 'n', v });
const target = (v: string): Tok => ({ kind: 'k', v });
const textOf = (toks: Tok[]) => toks.map((t) => t.v).join('');

const make = (keywords: string[], boundary?: BoundaryEntry) =>
  new AhoCorasick<Tok, Tok>(keywords, normal, target, boundary).tokenizeSync();

// merge adjacent normal tokens: the optimistic and plain variants agree on the
// text and on every keyword, but segment the plain-text runs at different chunk
// boundaries, so token grouping is only comparable after normalization.
const canon = (toks: Tok[]): Tok[] => {
  const out: Tok[] = [];
  for (const t of toks) {
    const prev = out[out.length - 1];
    if (t.kind === 'n' && prev?.kind === 'n') { out[out.length - 1] = normal(prev.v + t.v); }
    else { out.push({ ...t }); }
  }
  return out;
};

// what the plain (non-optimistic) variant emits for the whole text at once:
// this is the "if the stream ended right now" tokenization the preview mirrors.
const normalFinal = (keywords: string[], text: string, boundary?: BoundaryEntry): Tok[] => {
  const h = new NormalAhoCorasick(keywords, boundary).tokenizeSync(normal, target);
  return [...h.write(text), ...h.end()];
};

describe('tokenizeSync (optimistic) — the preview mirrors "if the stream ended now"', () => {
  test('a live keyword prefix previews as text, then flips to a keyword token', () => {
    const h = make(['abc']);
    // "a"/"ab" are only live prefixes of "abc": previewed as plain text
    expect(h.write('a')).toEqual({ confirmed: [], optimistic: [normal('a')] });
    expect(h.write('b')).toEqual({ confirmed: [], optimistic: [normal('ab')] });
    // "abc" completes the keyword: preview flips to a keyword token
    expect(h.write('c')).toEqual({ confirmed: [], optimistic: [target('abc')] });
    // still nothing confirmed until the stream ends (it could still grow)
    expect(h.end()).toEqual([target('abc')]);
  });

  test('longest-match preview: shorter keyword shown until the longer one completes', () => {
    const h = make(['a', 'abc']);
    // "a" is itself a keyword -> previewed as a keyword immediately
    expect(h.write('a')).toEqual({ confirmed: [], optimistic: [target('a')] });
    // "ab": "a" matched, "b" is the trailing live remainder
    expect(h.write('b')).toEqual({ confirmed: [], optimistic: [target('a'), normal('b')] });
    // "abc" is the longer keyword: preview collapses to the single keyword
    expect(h.write('c')).toEqual({ confirmed: [], optimistic: [target('abc')] });
    expect(h.end()).toEqual([target('abc')]);
  });

  test('adjacent keywords both preview as matches (non-overlapping, leftmost-longest)', () => {
    const h = make(['a', 'aaa']);
    expect(h.write('a')).toEqual({ confirmed: [], optimistic: [target('a')] });
    // "aa" tokenizes as two "a" matches -- exactly normalFinal("aa")
    expect(h.write('a')).toEqual({ confirmed: [], optimistic: [target('a'), target('a')] });
    // a third "a" completes the longer keyword: preview collapses to [k:aaa]
    expect(h.write('a').optimistic).toEqual(normalFinal(['a', 'aaa'], 'aaa')); // -> [k:aaa]
    // 'b' rules out any further growth; "aaa" is confirmed as the single longest match
    const r = h.write('b');
    expect(r.confirmed).toEqual([target('aaa'), normal('b')]);
    expect(r.optimistic).toEqual([]);
    expect(h.end()).toEqual([]);
  });

  test('non-matching text is confirmed eagerly; only the live tail stays optimistic', () => {
    const h = make(['abc']);
    const r = h.write('xyzab');
    // "xyz" can never be part of "abc" -> confirmed; "ab" is a live prefix
    expect(r.confirmed).toEqual([normal('xyz')]);
    expect(r.optimistic).toEqual([normal('ab')]);
    // no completing "c" arrives; the pending tail drains as plain text
    expect(h.end()).toEqual([normal('ab')]);
  });
});

describe('tokenizeSync (optimistic) — with boundary', () => {
  test('a completed keyword stays a text preview until the boundary confirms it', () => {
    const h = make(['cat'], Boundary.AsciiTerm());
    // "the " is safely a boundary-terminated run of text
    expect(h.write('the ca')).toEqual({ confirmed: [normal('the ')], optimistic: [normal('ca')] });
    // "cat" is spelled out, but with no right boundary yet the preview is conservative:
    // it does NOT credit the keyword (a following letter could still extend the word)
    expect(h.write('t')).toEqual({ confirmed: [], optimistic: [normal('cat')] });
    // the space closes the word boundary: "cat" is confirmed as a keyword
    const r = h.write(' x');
    expect(r.confirmed).toEqual([target('cat'), normal(' x')]);
    expect(r.optimistic).toEqual([]);
    expect(h.end()).toEqual([]);
  });

  test('reassembly still holds while a keyword is pending at the boundary edge', () => {
    const h = make(['cat'], Boundary.AsciiTerm());
    const r = h.write('the cat');
    // preview is conservative (cat not yet credited) but text is fully accounted for
    expect(textOf(r.confirmed) + textOf(r.optimistic)).toBe('the cat');
    // end of stream is a boundary, so "cat" is confirmed as a keyword at flush
    expect(h.end()).toEqual([target('cat')]);
  });
});

describe('optimistic invariants (seeded fuzz)', () => {
  const mulberry32 = (seed: number) => () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  test('reassembly, equivalence with normal variant, and the "ended-now" preview property', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rand = mulberry32(seed);
      const alphabet = 'ab   ';
      const randStr = (len: number) => Array.from({ length: len }, () => alphabet[Math.floor(rand() * alphabet.length)]).join('');

      const keywords = Array.from({ length: 1 + Math.floor(rand() * 5) }, () => randStr(1 + Math.floor(rand() * 8)))
        .filter((v, i, a) => a.indexOf(v) === i && v.trim().length > 0);
      if (keywords.length === 0) { continue; }
      const text = randStr(3 + Math.floor(rand() * 30));
      const useBoundary = rand() < 0.5;
      const boundary: BoundaryEntry | undefined = useBoundary ? Boundary.AsciiEdge() : undefined;

      const chunks: string[] = [];
      { let i = 0; while (i < text.length) { const n = 1 + Math.floor(rand() * 4); chunks.push(text.slice(i, i + n)); i += n; } }
      const label = `seed=${seed} keywords=${JSON.stringify(keywords)} boundary=${useBoundary} chunks=${JSON.stringify(chunks)}`;

      const optimisticHandle = new AhoCorasick<Tok, Tok>(keywords, normal, target, boundary).tokenizeSync();
      const normalHandle = new NormalAhoCorasick(keywords, boundary).tokenizeSync(normal, target);

      const confirmed: Tok[] = [];
      const normalOut: Tok[] = [];
      let consumed = '';
      for (const chunk of chunks) {
        const r = optimisticHandle.write(chunk);
        confirmed.push(...r.confirmed);
        normalOut.push(...normalHandle.write(chunk));
        consumed += chunk;

        // (A) live reassembly: confirmed-so-far + optimistic tail == consumed input
        expect(textOf(confirmed) + textOf(r.optimistic), `${label} A`).toBe(consumed);

        // (C) without a boundary the preview is exact: confirmed-so-far ++ optimistic
        // equals what the plain variant would emit if the stream ended right here.
        if (!useBoundary) {
          expect(canon([...confirmed, ...r.optimistic]), `${label} C`).toEqual(canon(normalFinal(keywords, consumed)));
        }
      }
      confirmed.push(...optimisticHandle.end());
      normalOut.push(...normalHandle.end());

      // (B) the confirmed stream is exactly what the plain (non-optimistic) variant produces
      expect(confirmed, `${label} B`).toEqual(normalOut);
    }
  });
});
