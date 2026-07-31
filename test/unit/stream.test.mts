import { test, expect, describe } from 'vitest';

import { AhoCorasick, Replacer, Boundary } from '../../src/stream/stream.mts'
import type { BoundaryFunc } from '../../src/stream/stream.mts'
import { AhoCorasick as AhoCorasickWebStream } from '../../src/stream/web/stream-web.mts'
import { AhoCorasick as AhoCorasickNodeStream } from '../../src/stream/node/stream-node.mts'
import RingBuffer from '../../src/stream/ringbuffer.mts'

describe('replaceSync', () => {
  test('Basic replacement with single keyword', () => {
    const aho = new AhoCorasick(['abc']);
    const result = Array.from(aho.replaceSync(['hello abc world'], (match) => 'XXX')).join('');
    expect(result).toBe('hello XXX world');
  });

  test('Replacement with multiple keywords', () => {
    const aho = new AhoCorasick(['abc', 'world']);
    const result = Array.from(aho.replaceSync(['hello abc world'], (match) => `[${match}]`)).join('');
    expect(result).toBe('hello [abc] [world]');
  });

  test('Replacement across chunk boundaries', () => {
    const aho = new AhoCorasick(['abc']);
    const result = Array.from(aho.replaceSync(['hello a', 'bc world'], (match) => 'XXX')).join('');
    expect(result).toBe('hello XXX world');
  });

  test('Multiple replacements across chunk boundaries', () => {
    const aho = new AhoCorasick(['abc', 'def']);
    const result = Array.from(aho.replaceSync(['ab', 'cd', 'ef'], (match) => `[${match}]`)).join('');
    expect(result).toBe('[abc][def]');
  });

  test('Greedy longest match at same position', () => {
    const aho = new AhoCorasick(['a', 'ab', 'abc']);
    const result = Array.from(aho.replaceSync(['abc'], (match) => `[${match}]`)).join('');
    expect(result).toBe('[abc]');
  });

  test('Greedy non-overlapping matches', () => {
    const aho = new AhoCorasick(['ab', 'ba', 'aba']);
    const result = Array.from(aho.replaceSync(['ababa'], (match) => `[${match}]`)).join('');
    expect(result).toBe('[aba][ba]');
  });

  test('Greedy non-overlapping matches 2', () => {
    const aho = new AhoCorasick(['ab', 'ba', 'aba']);
    const result = Array.from(aho.replaceSync(['a','b','a','b','a'], (match) => `[${match}]`)).join('');
    expect(result).toBe('[aba][ba]');
  });

  test('No matches returns original text', () => {
    const aho = new AhoCorasick(['xyz']);
    const result = Array.from(aho.replaceSync(['hello world'], (match) => 'XXX')).join('');
    expect(result).toBe('hello world');
  });

  test('Empty text input', () => {
    const aho = new AhoCorasick(['test']);
    const result = Array.from(aho.replaceSync([''], (match) => 'XXX')).join('');
    expect(result).toBe('');
  });

  test('Replacement with multibyte characters', () => {
    const aho = new AhoCorasick(['シロナ', 'ガス', 'クジラ']);
    const result = Array.from(aho.replaceSync(['シロナガスクジラ'], (match) => `[${match}]`)).join('');
    expect(result).toBe('[シロナ][ガス][クジラ]');
  });

  test('Replacement with multibyte characters', () => {
    const aho = new AhoCorasick(['シロナ', 'クジラ']);
    const result = Array.from(aho.replaceSync(['シロナガスクジラ'], (match) => `[${match}]`)).join('');
    expect(result).toBe('[シロナ]ガス[クジラ]');
  });

  test('Multibyte replacement across chunk boundaries', () => {
    const aho = new AhoCorasick(['シロナガス']);
    const result = Array.from(aho.replaceSync(['シロ', 'ナガ', 'ス'], (match) => 'XXX')).join('');
    expect(result).toBe('XXX');
  });

  test('Adjacent matches', () => {
    const aho = new AhoCorasick(['aaa', 'bbb']);
    const result = Array.from(aho.replaceSync(['aaabbb'], (match) => `[${match}]`)).join('');
    expect(result).toBe('[aaa][bbb]');
  });

  test('Overlapping patterns prefer longest', () => {
    const aho = new AhoCorasick(['test', 'testing', 'tes']);
    const result = Array.from(aho.replaceSync(['testing'], (match) => `[${match}]`)).join('');
    expect(result).toBe('[testing]');
  });

  test('Multiple chunks with partial matches', () => {
    const aho = new AhoCorasick(['abcd']);
    const result = Array.from(aho.replaceSync(['ab', 'c', 'd'], (match) => 'XXXX')).join('');
    expect(result).toBe('XXXX');
  });

  test('Chunk boundary at match start', () => {
    const aho = new AhoCorasick(['xyz']);
    const result = Array.from(aho.replaceSync(['abc', 'xyz', 'def'], (match) => `[${match}]`)).join('');
    expect(result).toBe('abc[xyz]def');
  });

  test('Chunk boundary at match end', () => {
    const aho = new AhoCorasick(['abc']);
    const result = Array.from(aho.replaceSync(['xyz', 'abc', 'def'], (match) => `[${match}]`)).join('');
    expect(result).toBe('xyz[abc]def');
  });

  test('Replacement with failure link traversal', () => {
    const aho = new AhoCorasick(['abc', 'bde']);
    const result = Array.from(aho.replaceSync(['ab', 'de'], (match) => `[${match}]`)).join('');
    expect(result).toBe('a[bde]');
  });

  test('Complex pattern with multiple chunks', () => {
    const aho = new AhoCorasick(['he', 'she', 'his', 'hers']);
    const result = Array.from(aho.replaceSync(['sh', 'eh', 'is'], (match) => `[${match}]`)).join('');
    expect(result).toBe('[she][his]');
  });

  test('Replacement with repeated characters', () => {
    const aho = new AhoCorasick(['aa', 'aaa', 'aaaa']);
    const result = Array.from(aho.replaceSync(['aaaaaa'], (match) => `[${match}]`)).join('');
    expect(result).toBe('[aaaa][aa]');
  });

  test('Emoji replacement', () => {
    const aho = new AhoCorasick(['👍', '🎉']);
    const result = Array.from(aho.replaceSync(['Hello👍World🎉'], (match) => `[${match}]`)).join('');
    expect(result).toBe('Hello[👍]World[🎉]');
  });

  test('Emoji across chunk boundaries', () => {
    const aho = new AhoCorasick(['👨‍👩‍👧']);
    const chunks = ['👨‍', '👩‍', '👧'];
    const result = Array.from(aho.replaceSync(chunks, (match) => '[FAMILY]')).join('');
    expect(result).toBe('[FAMILY]');
  });

  test('Whitespace handling', () => {
    const aho = new AhoCorasick(['hello world', ' ']);
    const result = Array.from(aho.replaceSync(['hello world'], (match) => `[${match}]`)).join('');
    expect(result).toBe('[hello world]');
  });

  test('Large number of small chunks', () => {
    const aho = new AhoCorasick(['abcdefgh']);
    const chunks = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const result = Array.from(aho.replaceSync(chunks, (match) => 'REPLACED')).join('');
    expect(result).toBe('REPLACED');
  });

  test('Fallback when longest keyword does not match', () => {
    const aho = new AhoCorasick(['abcdefgh', 'bcd', 'ef']);
    const result = Array.from(aho.replaceSync(['abc', 'defg', 'x'], (match) => `[${match}]`)).join('');
    expect(result).toBe('a[bcd][ef]gx');
  });

  test('Multiple matches in single chunk', () => {
    const aho = new AhoCorasick(['abc', 'def', 'ghi']);
    const result = Array.from(aho.replaceSync(['abcdefghi'], (match) => `[${match}]`)).join('');
    expect(result).toBe('[abc][def][ghi]');
  });

  test('Replacer function receives correct matched text', () => {
    const aho = new AhoCorasick(['abc', 'def']);
    const matches: string[] = [];
    Array.from(aho.replaceSync(['abcdef'], (match) => {
      matches.push(match);
      return `[${match}]`;
    }));
    expect(matches).toEqual(['abc', 'def']);
  });

  test('Chunk with only partial match at end', () => {
    const aho = new AhoCorasick(['abcd']);
    const result = Array.from(aho.replaceSync(['xyz', 'ab'], (match) => 'REPLACED')).join('');
    expect(result).toBe('xyzab');
  });

  test('Confirmed index advance on failure', () => {
    const aho = new AhoCorasick(['dcbacbax', 'ba', 'cba', 'dc', 'cb', 'a']);
    const result = Array.from(aho.replaceSync(['dcb', 'acb', 'a'], (match) => `[${match}]`)).join('');
    expect(result).toBe('[dc][ba][cba]');
  });

  test('Very long keyword across many chunks', () => {
    const longKeyword = 'a'.repeat(1000);
    const aho = new AhoCorasick([longKeyword]);
    const chunks = longKeyword.match(/.{1,10}/g) || [];
    const result = Array.from(aho.replaceSync(chunks, (match) => 'LONG')).join('');
    expect(result).toBe('LONG');
  });

  test('Long text with multiple matches across many chunks', () => {
    const aho = new AhoCorasick(['the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog']);
    const text = 'the quick brown fox jumps over the lazy dog';
    const chunks = text.split(' ').map((w, i) => `${i !== 0 ? ' ' : ''}${w}`); // Each word becomes a chunk
    const result = Array.from(aho.replaceSync(chunks, (match) => match.toUpperCase())).join('');
    expect(result).toBe('THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG');
  });

  test('Complex pattern matching across 20+ chunks', () => {
    const aho = new AhoCorasick(['abc', 'def', 'ghi', 'jkl', 'mno', 'pqr']);
    const chunks = ['a', 'bc', 'de', 'f', 'gh', 'ij', 'kl', 'm', 'no', 'pq', 'r'];
    const result = Array.from(aho.replaceSync(chunks, (match) => `[${match}]`)).join('');
    expect(result).toBe('[abc][def][ghi][jkl][mno][pqr]');
  });

  test('Interleaved matches with many small chunks', () => {
    const aho = new AhoCorasick(['ab', 'cd', 'ef', 'gh', 'ij']);
    const chunks = ['a', 'b', 'x', 'c', 'd', 'y', 'e', 'f', 'z', 'g', 'h', 'i', 'j'];
    const result = Array.from(aho.replaceSync(chunks, (match) => `[${match}]`)).join('');
    expect(result).toBe('[ab]x[cd]y[ef]z[gh][ij]');
  });

  test('Sentence with overlapping keywords across word boundaries', () => {
    const aho = new AhoCorasick(['hello', 'world', 'how', 'are', 'you', 'today']);
    const chunks = ['hel', 'lo ', 'wor', 'ld ', 'ho', 'w ar', 'e yo', 'u to', 'day'];
    const result = Array.from(aho.replaceSync(chunks, (match) => `[${match}]`)).join('');
    expect(result).toBe('[hello] [world] [how] [are] [you] [today]');
  });

  test('Multiple keyword patterns with varying chunk sizes', () => {
    const aho = new AhoCorasick(['testing', 'test', 'ing', 'best', 'rest']);
    const chunks = ['te', 'stin', 'g is', ' the ', 'be', 'st for', ' res', 'ting'];
    const result = Array.from(aho.replaceSync(chunks, (match) => `[${match}]`)).join('');
    expect(result).toBe('[testing] is the [best] for [rest][ing]');
  });

  test('Greedy matching with deep failure links across chunks', () => {
    const aho = new AhoCorasick(['ababc', 'abc', 'bab', 'bc', 'c']);
    const chunks = ['a', 'ba', 'ba', 'cb', 'c'];
    const result = Array.from(aho.replaceSync(chunks, (match) => `[${match}]`)).join('');
    expect(result).toBe('a[bab]a[c][bc]');
  });

  test('Long text simulation with 50+ chunks', () => {
    const aho = new AhoCorasick(['error', 'warning', 'info', 'debug']);
    const logLines = [
      '[20', '26-', '02-', '07]', ' [e', 'rro', 'r] ', 'Cri', 'tic', 'al ',
      'fai', 'lur', 'e\n', '[20', '26-', '02-', '07]', ' [w', 'arn', 'ing',
      '] M', 'ino', 'r i', 'ssu', 'e\n', '[20', '26-', '02-', '07]', ' [i',
      'nfo', '] S', 'tar', 'ted', '\n[', '202', '6-0', '2-0', '7] ', '[de',
      'bug', '] D', 'eta', 'ils'
    ];
    const result = Array.from(aho.replaceSync(logLines, (match) => match.toUpperCase())).join('');
    expect(result).toBe(
      '[2026-02-07] [ERROR] Critical failure\n' +
      '[2026-02-07] [WARNING] Minor issue\n' +
      '[2026-02-07] [INFO] Started\n' +
      '[2026-02-07] [DEBUG] Details'
    );
  });

  test('Japanese text with multiple chunks and keywords', () => {
    const aho = new AhoCorasick(['こんにちは', '世界', 'プログラミング', '楽しい']);
    const chunks = ['こん', 'にち', 'は、', '世', '界！', 'プロ', 'グラ', 'ミン', 'グは', '楽', 'しい'];
    const result = Array.from(aho.replaceSync(chunks, (match) => `[${match}]`)).join('');
    expect(result).toBe('[こんにちは]、[世界]！[プログラミング]は[楽しい]');
  });

  test('Mixed content with numbers and symbols across chunks', () => {
    const aho = new AhoCorasick(['user123', 'password', 'email@example.com', '2024']);
    const chunks = ['user', '12', '3:', 'pas', 'swor', 'd:', 'ema', 'il@', 'exa', 'mple', '.com', ',20', '24'];
    const result = Array.from(aho.replaceSync(chunks, (match) => '[REDACTED]')).join('');
    expect(result).toBe('[REDACTED]:[REDACTED]:[REDACTED],[REDACTED]');
  });

  test('Nested patterns with gradual chunk accumulation', () => {
    const aho = new AhoCorasick(['a', 'aa', 'aaa', 'aaaa', 'aaaaa', 'aaaaaa']);
    const chunks = ['a', 'a', 'a', 'a', 'a', 'a', 'b', 'a', 'a', 'a', 'a'];
    const result = Array.from(aho.replaceSync(chunks, (match) => `[${match}]`)).join('');
    expect(result).toBe('[aaaaaa]b[aaaa]');
  });

  test('Real-world scenario: HTML parsing across chunks', () => {
    const aho = new AhoCorasick(['<script>', '</script>', '<style>', '</style>', 'onclick']);
    const chunks = ['<di', 'v o', 'ncl', 'ick', '="a', 'lert', '()">',
                    '<sc', 'rip', 't>a', 'lert', '()</', 'scr', 'ipt', '>'];
    const result = Array.from(aho.replaceSync(chunks, (match) => '[REMOVED]')).join('');
    expect(result).toBe('<div [REMOVED]="alert()">[REMOVED]alert()[REMOVED]');
  });

  test('Pathological case: many overlapping candidates across chunks', () => {
    const aho = new AhoCorasick(['abcdefgh', 'bcdefgh', 'cdefgh', 'defgh', 'efgh', 'fgh', 'gh', 'h']);
    const chunks = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
    const result = Array.from(aho.replaceSync(chunks, (match) => `[${match}]`)).join('');
    expect(result).toBe('[abcdefgh]i');
  });

  test('Collector amortization: long text with many small chunks forces reposition', () => {
    const aho = new AhoCorasick(['error', 'warning', 'info', 'debug', 'critical', 'the', 'quick', 'brown', 'fox']);

    const words = ['the quick brown fox ', 'error occurred ', 'warning issued ', 'info logged ', 'debug trace ', 'critical alert ', 'xyz filler text here '];
    let text = '';
    for (let i = 0; i < 500; i++) {
      text += words[i % words.length];
    }

    const expected = Array.from(aho.matchInText(text)).reduce((acc, m) => {
      return { out: acc.out + text.slice(acc.pos, m.begin) + `[${m.keyword}]`, pos: m.end };
    }, { out: '', pos: 0 });
    const expectedText = expected.out + text.slice(expected.pos);

    for (const chunkLen of [1, 2, 3, 5, 7, 11, 13]) {
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += chunkLen) {
        chunks.push(text.slice(i, i + chunkLen));
      }
      const result = Array.from(aho.replaceSync(chunks, (match) => `[${match}]`)).join('');
      expect(result, `chunkLen=${chunkLen}`).toBe(expectedText);
    }
  });

  test('Collector amortization: keyword longer than chunk size, repeated across reposition boundary', () => {
    const longKeyword = 'abcdefghijklmnop'; // length 16
    const aho = new AhoCorasick([longKeyword, 'xyz', 'qq']);
    let text = '';
    for (let i = 0; i < 300; i++) {
      text += (i % 7 === 0) ? longKeyword : 'qqxyzqq';
    }

    const expected = Array.from(aho.matchInText(text)).reduce((acc, m) => {
      return { out: acc.out + text.slice(acc.pos, m.begin) + `<${m.keyword}>`, pos: m.end };
    }, { out: '', pos: 0 });
    const expectedText = expected.out + text.slice(expected.pos);

    for (const chunkLen of [1, 2, 3, 5, 8, 17, 23]) {
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += chunkLen) {
        chunks.push(text.slice(i, i + chunkLen));
      }
      const result = Array.from(aho.replaceSync(chunks, (match) => `<${match}>`)).join('');
      expect(result, `chunkLen=${chunkLen}`).toBe(expectedText);
    }
  });

  test('Collector amortization: long passthrough text with no matches', () => {
    const aho = new AhoCorasick(['zzz', 'notfound']);
    let text = '';
    for (let i = 0; i < 1000; i++) {
      text += 'the quick brown fox jumps ';
    }
    for (const chunkLen of [1, 3, 9, 50]) {
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += chunkLen) {
        chunks.push(text.slice(i, i + chunkLen));
      }
      const result = Array.from(aho.replaceSync(chunks, () => 'X')).join('');
      expect(result, `chunkLen=${chunkLen}`).toBe(text);
    }
  });

  test('Streaming data simulation with incomplete matches at chunk ends', () => {
    const aho = new AhoCorasick(['match1', 'match2', 'match3']);
    const chunks = ['no', 'mat', 'ch h', 'ere', ' mat', 'ch1 ', 'and ', 'mat', 'ch2', ' plu', 's ma', 'tch3'];
    const result = Array.from(aho.replaceSync(chunks, (match) => `[${match}]`)).join('');
    expect(result).toBe('nomatch here [match1] and [match2] plus [match3]');
  });

  test('Streaming data simulation for Web Stream', async () => {
    const aho = new AhoCorasickWebStream(['match1', 'match2', 'match3']);
    const chunks = ['no', 'mat', 'ch h', 'ere', ' mat', 'ch1 ', 'and ', 'mat', 'ch2', ' plu', 's ma', 'tch3'];

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

    expect(result).toBe('nomatch here [match1] and [match2] plus [match3]');
  });

  test('Streaming data simulation for Node Stream', async () => {
    const aho = new AhoCorasickNodeStream(['match1', 'match2', 'match3']);
    const chunks = ['no', 'mat', 'ch h', 'ere', ' mat', 'ch1 ', 'and ', 'mat', 'ch2', ' plu', 's ma', 'tch3'];

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

    expect(result).toBe('nomatch here [match1] and [match2] plus [match3]');
  });
});

describe('RingBuffer', () => {
  test('get returns pushed values by absolute position', () => {
    const ring = new RingBuffer<string>(4);
    for (const ch of 'abc') { ring.push(ch); }
    expect(ring.get(0)).toBe('a');
    expect(ring.get(1)).toBe('b');
    expect(ring.get(2)).toBe('c');
  });

  test('get returns null for positions not pushed yet', () => {
    const ring = new RingBuffer<string>(4);
    expect(ring.get(0)).toBeNull();
    ring.push('a');
    expect(ring.get(-1)).toBeNull();
    expect(ring.get(1)).toBeNull();
  });

  test('recent values stay retrievable and old values are evicted', () => {
    const ring = new RingBuffer<string>(3);
    for (const ch of 'abcdefgh') { ring.push(ch); }
    // the last `capacity` positions are always retrievable
    expect(ring.get(7)).toBe('h');
    expect(ring.get(6)).toBe('g');
    // positions far in the past are evicted
    expect(ring.get(0)).toBeNull();
    expect(ring.get(1)).toBeNull();
  });

  test('reposition shifts the position coordinate', () => {
    const ring = new RingBuffer<string>(4);
    for (const ch of 'abc') { ring.push(ch); }
    ring.reposition(2);
    expect(ring.get(-2)).toBe('a');
    expect(ring.get(-1)).toBe('b');
    expect(ring.get(0)).toBe('c');
    ring.push('d');
    expect(ring.get(1)).toBe('d');
  });

  test('size and empty reflect eviction', () => {
    const ring = new RingBuffer<string>(2);
    expect(ring.empty()).toBe(true);
    ring.push('a');
    expect(ring.empty()).toBe(false);
    expect(ring.size()).toBe(1);
    for (const ch of 'bcdefgh') { ring.push(ch); }
    // size is bounded no matter how many values are pushed
    expect(ring.size()).toBeLessThanOrEqual(2);
  });
});

describe('replaceSync with boundary', () => {
  // a word boundary exists between two adjacent chars unless both are word characters
  const wordBoundary: BoundaryFunc = (_, left, right) => !(/\w/.test(left) && /\w/.test(right));
  const bracket = (match: string) => `[${match}]`;

  test('standalone keyword is replaced, keyword inside a larger word is kept', () => {
    const aho = new AhoCorasick(['cat']);
    const result = Array.from(aho.replaceSync(['a cat and category'], bracket, wordBoundary)).join('');
    expect(result).toBe('a [cat] and category');
  });

  test('keyword followed by a word character is kept', () => {
    const aho = new AhoCorasick(['cat']);
    const result = Array.from(aho.replaceSync(['cats'], bracket, wordBoundary)).join('');
    expect(result).toBe('cats');
  });

  test('keyword preceded by a word character is kept', () => {
    const aho = new AhoCorasick(['cat']);
    const result = Array.from(aho.replaceSync(['scat'], bracket, wordBoundary)).join('');
    expect(result).toBe('scat');
  });

  test('text start and end count as boundaries', () => {
    const aho = new AhoCorasick(['cat']);
    expect(Array.from(aho.replaceSync(['cat sat'], bracket, wordBoundary)).join('')).toBe('[cat] sat');
    expect(Array.from(aho.replaceSync(['the cat'], bracket, wordBoundary)).join('')).toBe('the [cat]');
    expect(Array.from(aho.replaceSync(['cat'], bracket, wordBoundary)).join('')).toBe('[cat]');
  });

  test('punctuation adjacent to the keyword counts as a boundary', () => {
    const aho = new AhoCorasick(['cat']);
    const result = Array.from(aho.replaceSync(['(cat) cat.'], bracket, wordBoundary)).join('');
    expect(result).toBe('([cat]) [cat].');
  });

  test('boundary is checked across chunk edges', () => {
    const aho = new AhoCorasick(['cat']);
    // "scat cat": the 1st cat is preceded by 's' from the previous chunk -> kept,
    // the 2nd is preceded by ' ' from the previous chunk and ends the text -> replaced
    const result = Array.from(aho.replaceSync(['s', 'cat', ' ca', 't'], bracket, wordBoundary)).join('');
    expect(result).toBe('scat [cat]');
  });

  test('right neighbor arriving in the next chunk decides the match', () => {
    const aho = new AhoCorasick(['cat']);
    expect(Array.from(aho.replaceSync(['a cat', 's'], bracket, wordBoundary)).join('')).toBe('a cats');
    expect(Array.from(aho.replaceSync(['a cat', ' x'], bracket, wordBoundary)).join('')).toBe('a [cat] x');
  });

  test('boundary function receives the keyword and the adjacent character pairs', () => {
    const aho = new AhoCorasick(['cat']);
    const calls: [string, string, string][] = [];
    Array.from(aho.replaceSync(['x cat y'], bracket, (detect, left, right) => {
      calls.push([detect, left, right]);
      return true;
    }));
    expect(calls).toEqual([
      ['cat', ' ', 'c'], // left edge: char before the keyword and its first char
      ['cat', 't', ' '], // right edge: last char of the keyword and the char after
    ]);
  });

  test('boundary function is not called at text start / end', () => {
    const aho = new AhoCorasick(['cat']);
    const calls: [string, string, string][] = [];
    const result = Array.from(aho.replaceSync(['cat'], bracket, (detect, left, right) => {
      calls.push([detect, left, right]);
      return false;
    })).join('');
    // both edges touch the text boundary, so the match is accepted without asking
    expect(calls).toEqual([]);
    expect(result).toBe('[cat]');
  });

  test('rejected match does not suppress later matches', () => {
    const aho = new AhoCorasick(['cat']);
    const result = Array.from(aho.replaceSync(['catcat cat'], bracket, wordBoundary)).join('');
    expect(result).toBe('catcat [cat]');
  });

  test('greedy longest match works with boundary', () => {
    const aho = new AhoCorasick(['cat', 'cats']);
    const result = Array.from(aho.replaceSync(['cats cat'], bracket, wordBoundary)).join('');
    expect(result).toBe('[cats] [cat]');
  });

  test('non-word characters around multibyte keywords count as boundaries', () => {
    const aho = new AhoCorasick(['東京']);
    const result = Array.from(aho.replaceSync(['東京と東京都'], bracket, wordBoundary)).join('');
    // kanji is not a \w word character, so every occurrence is boundary-delimited
    expect(result).toBe('[東京]と[東京]都');
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
      const aho = new AhoCorasick(keywords);
      // single chunk never repositions mid-stream, so it serves as the reference
      const expected = Array.from(aho.replaceSync([text], bracket, wordBoundary)).join('');

      for (const chunkLen of [1, 3, 7, 30]) {
        const chunks: string[] = [];
        for (let i = 0; i < text.length; i += chunkLen) {
          chunks.push(text.slice(i, i + chunkLen));
        }
        const result = Array.from(aho.replaceSync(chunks, bracket, wordBoundary)).join('');
        expect(result, `seed=${seed} chunkLen=${chunkLen} keywords=${JSON.stringify(keywords)}`).toBe(expected);
      }
    }
  });

  test('boundary with long text across amortization reposition', () => {
    const aho = new AhoCorasick(['cat']);
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
      const result = Array.from(aho.replaceSync(chunks, bracket, wordBoundary)).join('');
      expect(result, `chunkLen=${chunkLen}`).toBe(expected);
    }
  });
});

describe('replaceAsync with boundary', () => {
  const wordBoundary: BoundaryFunc = (_, left, right) => !(/\w/.test(left) && /\w/.test(right));

  const replaceAsyncAll = async (aho: AhoCorasick, chunks: string[], boundary?: BoundaryFunc) => {
    async function* gen() { for (const chunk of chunks) { yield chunk; } }
    const parts: string[] = [];
    for await (const part of aho.replaceAsync(gen(), (match) => `[${match}]`, boundary)) {
      parts.push(part);
    }
    return parts.join('');
  };

  test('standalone keyword is replaced, keyword inside a larger word is kept', async () => {
    const aho = new AhoCorasick(['cat']);
    expect(await replaceAsyncAll(aho, ['a cat and category'], wordBoundary)).toBe('a [cat] and category');
  });

  test('match finalized at flush still respects the boundary', async () => {
    const aho = new AhoCorasick(['cat']);
    // the match ends at the end of the stream, so it is decided in cleanup
    expect(await replaceAsyncAll(aho, ['scat'], wordBoundary)).toBe('scat');
    expect(await replaceAsyncAll(aho, ['the cat'], wordBoundary)).toBe('the [cat]');
  });

  test('boundary is checked across chunk edges', async () => {
    const aho = new AhoCorasick(['cat']);
    expect(await replaceAsyncAll(aho, ['s', 'cat', ' ca', 't'], wordBoundary)).toBe('scat [cat]');
  });

  test('omitted boundary replaces everywhere', async () => {
    const aho = new AhoCorasick(['cat']);
    expect(await replaceAsyncAll(aho, ['scats'])).toBe('s[cat]s');
  });
});

describe('Boundary.WhiteSpace', () => {
  const replace = (keywords: string[], chunks: string[], replacement: string) =>
    Array.from(new AhoCorasick(keywords).replaceSync(chunks, () => replacement, Boundary.WhiteSpace())).join('');

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
    Array.from(new AhoCorasick(keywords).replaceSync(chunks, () => replacement, Boundary.AsciiTerm())).join('');

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

  test('technical-term symbols (&, +, #, ., -) are word characters and block the match', () => {
    // '.' '&' '+' '#' '-' adjacent to cat mean it is part of a larger term
    expect(replace(['cat'], ['cat.js cat&dog cat+ #cat co-cat cat'], 'DOG')).toBe('cat.js cat&dog cat+ #cat co-cat DOG');
  });

  test('a keyword that is itself a technical term matches on symbol boundaries', () => {
    // "C&C" surrounded by spaces is replaced; the 2nd is joined to 'e' and '.' -> blocked
    expect(replace(['C&C'], ['use C&C here', 'C&C.'], 'X')).toBe('use X hereC&C.');
  });

  test('a symbol-containing keyword is matched as a whole term', () => {
    // ".net" delimited by spaces is a whole term; "a.net" is part of a larger term
    expect(replace(['.net'], ['use .net and a.net'], 'X')).toBe('use X and a.net');
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
    const aho = new AhoCorasick(['ABC CD', 'ABC']);
    // "ABC CD" is present but followed by 'E', so it is not a whole term;
    // the earlier "ABC" match must survive instead
    const result = Array.from(aho.replaceSync(['ABC CDE'], (match) => `[${match}]`, Boundary.AsciiTerm())).join('');
    expect(result).toBe('[ABC] CDE');
  });

  test('the longer keyword wins when it is a whole term', () => {
    const aho = new AhoCorasick(['ABC CD', 'ABC']);
    const result = Array.from(aho.replaceSync(['ABC CD END'], (match) => `[${match}]`, Boundary.AsciiTerm())).join('');
    expect(result).toBe('[ABC CD] END');
  });

  test('fallback to the shorter keyword works across chunk edges', () => {
    const aho = new AhoCorasick(['ABC CD', 'ABC']);
    const result = Array.from(aho.replaceSync(['ABC C', 'DE'], (match) => `[${match}]`, Boundary.AsciiTerm())).join('');
    expect(result).toBe('[ABC] CDE');
  });
});

describe('Boundary.AsciiEdge', () => {
  const replace = (keywords: string[], chunks: string[], replacement: string) =>
    Array.from(new AhoCorasick(keywords).replaceSync(chunks, () => replacement, Boundary.AsciiEdge())).join('');

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
    const term = Array.from(new AhoCorasick(['ab@cd']).replaceSync(['xab@cdy'], () => 'X', Boundary.AsciiTerm())).join('');
    expect(term).toBe('xXy');
    expect(replace(['ab@cd'], ['xab@cdy'], 'X')).toBe('xab@cdy');
    expect(replace(['ab@cd'], ['x ab@cd y'], 'X')).toBe('x X y');
  });
});

describe('Boundary.By', () => {
  test('custom separator regex controls the boundary', () => {
    // only '/' separates words
    const aho = new AhoCorasick(['cat']);
    const result = Array.from(aho.replaceSync(['/cat/ a cat'], () => 'X', Boundary.By(/\//))).join('');
    // "/cat/" is delimited by '/' on both sides -> replaced;
    // " cat" ends the text (right ok) but left is ' ' which is NOT a separator -> kept
    expect(result).toBe('/X/ a cat');
  });

  test('whitespace separator reproduces WhiteSpace behaviour', () => {
    const aho = new AhoCorasick(['cat']);
    const result = Array.from(aho.replaceSync(['(cat) cat'], () => 'X', Boundary.By(/\s/))).join('');
    // '(' and ')' are not separators, so "(cat)" is not whole; standalone "cat" is
    expect(result).toBe('(cat) X');
  });
});

describe('replaceStream with boundary', () => {
  const chunks = ['s', 'cat', ' ca', 't'];
  const expected = 'scat [cat]';

  test('Web Stream replaceStream accepts boundary', async () => {
    const aho = new AhoCorasickWebStream(['cat']);
    const readable = new ReadableStream<string>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      }
    });
    const transform = aho.replaceStream((match) => `[${match}]`, Boundary.AsciiTerm());

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
    const aho = new AhoCorasickNodeStream(['cat']);
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

    const transform = aho.replaceStream((match) => `[${match}]`, Boundary.AsciiTerm());

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
