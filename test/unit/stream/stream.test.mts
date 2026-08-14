import { test, expect, describe } from 'vitest';

import { AhoCorasick, Replacer } from '../../../src/stream/stream.mts'
import { Boundary, type BoundaryEntry } from '../../../src/stream/base.mts'


describe('Human Test', () => {
  describe('iterableReplaceSync without BoundaryEntry', () => {
    test('シロナガスグジラ phenomenon', () => {
      const aho = new AhoCorasick(['シロナ', 'ガス', 'クジラ']);
      const result = Array.from(aho.iterableReplaceSync(['シロナガスクジラ'], (match) => `[${match}]`)).join('');
      expect(result).toBe('[シロナ][ガス][クジラ]');
    });

    test('シロナガスグジラ equals', () => {
      const aho = new AhoCorasick(['シロナガスクジラ']);
      const result = Array.from(aho.iterableReplaceSync(['シロナガスクジラ'], (match) => `[${match}]`)).join('');
      expect(result).toBe('[シロナガスクジラ]');
    });

    test('include empty keyword', () => {
      const aho = new AhoCorasick(['', 'a', 'b', 'c']);
      const result = Array.from(aho.iterableReplaceSync(['abcedfghi'], (match) => `[${match}]`)).join('');
      expect(result).toBe('[a][b][c][]e[]d[]f[]g[]h[]i[]');
      expect(result).toBe('abcedfghi'.replace(/(a|b|c|)/g, (match) => `[${match}]`));
    });

    test('empty keyword in (single word)', () => {
      const aho = new AhoCorasick(['']);
      const result = Array.from(aho.iterableReplaceSync(['aho-corasick'], (match) => '|')).join('');
      expect(result).toBe('|a|h|o|-|c|o|r|a|s|i|c|k|');
      expect(result).toBe('aho-corasick'.replace(/()/g, '|'));
    });

    test('empty keyword in (two words)', () => {
      const aho = new AhoCorasick(['']);
      const result = Array.from(aho.iterableReplaceSync(['hello world'], (match) => '|')).join('');
      expect(result).toBe('|h|e|l|l|o| |w|o|r|l|d|');
      expect(result).toBe('hello world'.replace(/()/g, '|'));
    });
  });

  describe('iterableReplaceSync with AsciiTerm', () => {
    test('シロナガスグジラ phenomenon', () => {
      const aho = new AhoCorasick(['シロナ', 'ガス', 'クジラ'], Boundary.AsciiTerm());
      const result = Array.from(aho.iterableReplaceSync(['シロナガスクジラ'], (match) => `[${match}]`)).join('');
      expect(result).toBe('[シロナ][ガス][クジラ]');
    });

    test('シロナガスグジラ equals', () => {
      const aho = new AhoCorasick(['シロナガスクジラ'], Boundary.AsciiTerm());
      const result = Array.from(aho.iterableReplaceSync(['シロナガスクジラ'], (match) => `[${match}]`)).join('');
      expect(result).toBe('[シロナガスクジラ]');
    });

    test('include empty keyword', () => {
      const aho = new AhoCorasick(['', 'a', 'b', 'c'], Boundary.AsciiTerm());
      const result = Array.from(aho.iterableReplaceSync(['abcedfghi'], (match) => `[${match}]`)).join('');
      expect(result).toBe('[]abcedfghi[]');
    });

    test('include empty keyword', () => {
      const aho = new AhoCorasick(['', 'a', 'b', 'c'], Boundary.AsciiTerm());
      const result = Array.from(aho.iterableReplaceSync(['a abc b ec'], (match) => `[${match}]`)).join('');
      expect(result).toBe('[a][] []abc[] [b][] []ec[]');
      expect(result).toBe('a abc b ec'.replace(/\b(a|b|c|)\b/g, (match) => `[${match}]`));
    });

    test('empty keyword in (single word)', () => {
      const aho = new AhoCorasick([''], Boundary.AsciiTerm());
      const result = Array.from(aho.iterableReplaceSync(['JavaApplet'], (_) => '|')).join('');
      expect(result).toBe('|JavaApplet|');
      expect(result).toBe('JavaApplet'.replace(/\b\b/g, `|`));
    });

    test('empty keyword (two words)', () => {
      const aho = new AhoCorasick([''], Boundary.AsciiTerm());
      const result = Array.from(aho.iterableReplaceSync(['hello world'], (_) => '|')).join('');
      expect(result).toBe('|hello| |world|');
      expect(result).toBe('hello world'.replace(/\b\b/g, `|`));
    });

    test('empty keyword (three words)', () => {
      const aho = new AhoCorasick([''], Boundary.AsciiTerm());
      const result = Array.from(aho.iterableReplaceSync(['happy new year'], (_) => '|')).join('');
      expect(result).toBe('|happy| |new| |year|');
      expect(result).toBe('happy new year'.replace(/\b\b/g, `|`));
    });
  });
});

describe('AI-Generated Regression Suite', () => {
  describe('iterableReplaceSync without BoundaryEntry', () => {
    test('Basic replacement with single keyword', () => {
      const aho = new AhoCorasick(['abc']);
      const result = Array.from(aho.iterableReplaceSync(['hello abc world'], (match) => 'XXX')).join('');
      expect(result).toBe('hello XXX world');
    });

    test('Replacement with multiple keywords', () => {
      const aho = new AhoCorasick(['abc', 'world']);
      const result = Array.from(aho.iterableReplaceSync(['hello abc world'], (match) => `[${match}]`)).join('');
      expect(result).toBe('hello [abc] [world]');
    });

    test('Replacement across chunk boundaries', () => {
      const aho = new AhoCorasick(['abc']);
      const result = Array.from(aho.iterableReplaceSync(['hello a', 'bc world'], (match) => 'XXX')).join('');
      expect(result).toBe('hello XXX world');
    });

    test('Multiple replacements across chunk boundaries', () => {
      const aho = new AhoCorasick(['abc', 'def']);
      const result = Array.from(aho.iterableReplaceSync(['ab', 'cd', 'ef'], (match) => `[${match}]`)).join('');
      expect(result).toBe('[abc][def]');
    });

    test('Greedy longest match at same position', () => {
      const aho = new AhoCorasick(['a', 'ab', 'abc']);
      const result = Array.from(aho.iterableReplaceSync(['abc'], (match) => `[${match}]`)).join('');
      expect(result).toBe('[abc]');
    });

    test('Greedy non-overlapping matches', () => {
      const aho = new AhoCorasick(['ab', 'ba', 'aba']);
      const result = Array.from(aho.iterableReplaceSync(['ababa'], (match) => `[${match}]`)).join('');
      expect(result).toBe('[aba][ba]');
    });

    test('Greedy non-overlapping matches 2', () => {
      const aho = new AhoCorasick(['ab', 'ba', 'aba']);
      const result = Array.from(aho.iterableReplaceSync(['a','b','a','b','a'], (match) => `[${match}]`)).join('');
      expect(result).toBe('[aba][ba]');
    });

    test('No matches returns original text', () => {
      const aho = new AhoCorasick(['xyz']);
      const result = Array.from(aho.iterableReplaceSync(['hello world'], (match) => 'XXX')).join('');
      expect(result).toBe('hello world');
    });

    test('Empty text input', () => {
      const aho = new AhoCorasick(['test']);
      const result = Array.from(aho.iterableReplaceSync([''], (match) => 'XXX')).join('');
      expect(result).toBe('');
    });

    test('Replacement with repeated characters', () => {
      const aho = new AhoCorasick(['aa', 'aaa', 'aaaa']);
      const result = Array.from(aho.iterableReplaceSync(['aaaaaa'], (match) => `[${match}]`)).join('');
      expect(result).toBe('[aaaa][aa]');
    });

    test('Emoji replacement', () => {
      const aho = new AhoCorasick(['👍', '🎉']);
      const result = Array.from(aho.iterableReplaceSync(['Hello👍World🎉'], (match) => `[${match}]`)).join('');
      expect(result).toBe('Hello[👍]World[🎉]');
    });

    test('Emoji across chunk boundaries', () => {
      const aho = new AhoCorasick(['👨‍👩‍👧']);
      const chunks = ['👨‍', '👩‍', '👧'];
      const result = Array.from(aho.iterableReplaceSync(chunks, (match) => '[FAMILY]')).join('');
      expect(result).toBe('[FAMILY]');
    });

    test('Whitespace handling', () => {
      const aho = new AhoCorasick(['hello world', ' ']);
      const result = Array.from(aho.iterableReplaceSync(['hello world'], (match) => `[${match}]`)).join('');
      expect(result).toBe('[hello world]');
    });

    test('Large number of small chunks', () => {
      const aho = new AhoCorasick(['abcdefgh']);
      const chunks = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      const result = Array.from(aho.iterableReplaceSync(chunks, (match) => 'REPLACED')).join('');
      expect(result).toBe('REPLACED');
    });

    test('Fallback when longest keyword does not match', () => {
      const aho = new AhoCorasick(['abcdefgh', 'bcd', 'ef']);
      const result = Array.from(aho.iterableReplaceSync(['abc', 'defg', 'x'], (match) => `[${match}]`)).join('');
      expect(result).toBe('a[bcd][ef]gx');
    });

    test('Multiple matches in single chunk', () => {
      const aho = new AhoCorasick(['abc', 'def', 'ghi']);
      const result = Array.from(aho.iterableReplaceSync(['abcdefghi'], (match) => `[${match}]`)).join('');
      expect(result).toBe('[abc][def][ghi]');
    });

    test('Replacer function receives correct matched text', () => {
      const aho = new AhoCorasick(['abc', 'def']);
      const matches: string[] = [];
      Array.from(aho.iterableReplaceSync(['abcdef'], (match) => {
        matches.push(match);
        return `[${match}]`;
      }));
      expect(matches).toEqual(['abc', 'def']);
    });

    test('Chunk with only partial match at end', () => {
      const aho = new AhoCorasick(['abcd']);
      const result = Array.from(aho.iterableReplaceSync(['xyz', 'ab'], (match) => 'REPLACED')).join('');
      expect(result).toBe('xyzab');
    });

    test('Confirmed index advance on failure', () => {
      const aho = new AhoCorasick(['dcbacbax', 'ba', 'cba', 'dc', 'cb', 'a']);
      const result = Array.from(aho.iterableReplaceSync(['dcb', 'acb', 'a'], (match) => `[${match}]`)).join('');
      expect(result).toBe('[dc][ba][cba]');
    });

    test('Very long keyword across many chunks', () => {
      const longKeyword = 'a'.repeat(1000);
      const aho = new AhoCorasick([longKeyword]);
      const chunks = longKeyword.match(/.{1,10}/g) || [];
      const result = Array.from(aho.iterableReplaceSync(chunks, (match) => 'LONG')).join('');
      expect(result).toBe('LONG');
    });

    test('Long text with multiple matches across many chunks', () => {
      const aho = new AhoCorasick(['the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog']);
      const text = 'the quick brown fox jumps over the lazy dog';
      const chunks = text.split(' ').map((w, i) => `${i !== 0 ? ' ' : ''}${w}`); // Each word becomes a chunk
      const result = Array.from(aho.iterableReplaceSync(chunks, (match) => match.toUpperCase())).join('');
      expect(result).toBe('THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG');
    });

    test('Complex pattern matching across 20+ chunks', () => {
      const aho = new AhoCorasick(['abc', 'def', 'ghi', 'jkl', 'mno', 'pqr']);
      const chunks = ['a', 'bc', 'de', 'f', 'gh', 'ij', 'kl', 'm', 'no', 'pq', 'r'];
      const result = Array.from(aho.iterableReplaceSync(chunks, (match) => `[${match}]`)).join('');
      expect(result).toBe('[abc][def][ghi][jkl][mno][pqr]');
    });

    test('Interleaved matches with many small chunks', () => {
      const aho = new AhoCorasick(['ab', 'cd', 'ef', 'gh', 'ij']);
      const chunks = ['a', 'b', 'x', 'c', 'd', 'y', 'e', 'f', 'z', 'g', 'h', 'i', 'j'];
      const result = Array.from(aho.iterableReplaceSync(chunks, (match) => `[${match}]`)).join('');
      expect(result).toBe('[ab]x[cd]y[ef]z[gh][ij]');
    });

    test('Sentence with overlapping keywords across word boundaries', () => {
      const aho = new AhoCorasick(['hello', 'world', 'how', 'are', 'you', 'today']);
      const chunks = ['hel', 'lo ', 'wor', 'ld ', 'ho', 'w ar', 'e yo', 'u to', 'day'];
      const result = Array.from(aho.iterableReplaceSync(chunks, (match) => `[${match}]`)).join('');
      expect(result).toBe('[hello] [world] [how] [are] [you] [today]');
    });

    test('Multiple keyword patterns with varying chunk sizes', () => {
      const aho = new AhoCorasick(['testing', 'test', 'ing', 'best', 'rest']);
      const chunks = ['te', 'stin', 'g is', ' the ', 'be', 'st for', ' res', 'ting'];
      const result = Array.from(aho.iterableReplaceSync(chunks, (match) => `[${match}]`)).join('');
      expect(result).toBe('[testing] is the [best] for [rest][ing]');
    });

    test('Greedy matching with deep failure links across chunks', () => {
      const aho = new AhoCorasick(['ababc', 'abc', 'bab', 'bc', 'c']);
      const chunks = ['a', 'ba', 'ba', 'cb', 'c'];
      const result = Array.from(aho.iterableReplaceSync(chunks, (match) => `[${match}]`)).join('');
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
      const result = Array.from(aho.iterableReplaceSync(logLines, (match) => match.toUpperCase())).join('');
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
      const result = Array.from(aho.iterableReplaceSync(chunks, (match) => `[${match}]`)).join('');
      expect(result).toBe('[こんにちは]、[世界]！[プログラミング]は[楽しい]');
    });

    test('Mixed content with numbers and symbols across chunks', () => {
      const aho = new AhoCorasick(['user123', 'password', 'email@example.com', '2024']);
      const chunks = ['user', '12', '3:', 'pas', 'swor', 'd:', 'ema', 'il@', 'exa', 'mple', '.com', ',20', '24'];
      const result = Array.from(aho.iterableReplaceSync(chunks, (match) => '[REDACTED]')).join('');
      expect(result).toBe('[REDACTED]:[REDACTED]:[REDACTED],[REDACTED]');
    });

    test('Nested patterns with gradual chunk accumulation', () => {
      const aho = new AhoCorasick(['a', 'aa', 'aaa', 'aaaa', 'aaaaa', 'aaaaaa']);
      const chunks = ['a', 'a', 'a', 'a', 'a', 'a', 'b', 'a', 'a', 'a', 'a'];
      const result = Array.from(aho.iterableReplaceSync(chunks, (match) => `[${match}]`)).join('');
      expect(result).toBe('[aaaaaa]b[aaaa]');
    });

    test('Real-world scenario: HTML parsing across chunks', () => {
      const aho = new AhoCorasick(['<script>', '</script>', '<style>', '</style>', 'onclick']);
      const chunks = ['<di', 'v o', 'ncl', 'ick', '="a', 'lert', '()">',
                      '<sc', 'rip', 't>a', 'lert', '()</', 'scr', 'ipt', '>'];
      const result = Array.from(aho.iterableReplaceSync(chunks, (match) => '[REMOVED]')).join('');
      expect(result).toBe('<div [REMOVED]="alert()">[REMOVED]alert()[REMOVED]');
    });

    test('Pathological case: many overlapping candidates across chunks', () => {
      const aho = new AhoCorasick(['abcdefgh', 'bcdefgh', 'cdefgh', 'defgh', 'efgh', 'fgh', 'gh', 'h']);
      const chunks = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
      const result = Array.from(aho.iterableReplaceSync(chunks, (match) => `[${match}]`)).join('');
      expect(result).toBe('[abcdefgh]i');
    });

    test('Adjacent matches', () => {
      const aho = new AhoCorasick(['aaa', 'bbb']);
      const result = Array.from(aho.iterableReplaceSync(['aaabbb'], (match) => `[${match}]`)).join('');
      expect(result).toBe('[aaa][bbb]');
    });

    test('Overlapping patterns prefer longest', () => {
      const aho = new AhoCorasick(['test', 'testing', 'tes']);
      const result = Array.from(aho.iterableReplaceSync(['testing'], (match) => `[${match}]`)).join('');
      expect(result).toBe('[testing]');
    });

    test('Multiple chunks with partial matches', () => {
      const aho = new AhoCorasick(['abcd']);
      const result = Array.from(aho.iterableReplaceSync(['ab', 'c', 'd'], (match) => 'XXXX')).join('');
      expect(result).toBe('XXXX');
    });

    test('Chunk boundary at match start', () => {
      const aho = new AhoCorasick(['xyz']);
      const result = Array.from(aho.iterableReplaceSync(['abc', 'xyz', 'def'], (match) => `[${match}]`)).join('');
      expect(result).toBe('abc[xyz]def');
    });

    test('Chunk boundary at match end', () => {
      const aho = new AhoCorasick(['abc']);
      const result = Array.from(aho.iterableReplaceSync(['xyz', 'abc', 'def'], (match) => `[${match}]`)).join('');
      expect(result).toBe('xyz[abc]def');
    });

    test('Replacement with failure link traversal', () => {
      const aho = new AhoCorasick(['abc', 'bde']);
      const result = Array.from(aho.iterableReplaceSync(['ab', 'de'], (match) => `[${match}]`)).join('');
      expect(result).toBe('a[bde]');
    });

    test('Complex pattern with multiple chunks', () => {
      const aho = new AhoCorasick(['he', 'she', 'his', 'hers']);
      const result = Array.from(aho.iterableReplaceSync(['sh', 'eh', 'is'], (match) => `[${match}]`)).join('');
      expect(result).toBe('[she][his]');
    });

    test('Streaming data simulation with incomplete matches at chunk ends', () => {
      const aho = new AhoCorasick(['match1', 'match2', 'match3']);
      const chunks = ['no', 'mat', 'ch h', 'ere', ' mat', 'ch1 ', 'and ', 'mat', 'ch2', ' plu', 's ma', 'tch3'];
      const result = Array.from(aho.iterableReplaceSync(chunks, (match) => `[${match}]`)).join('');
      expect(result).toBe('nomatch here [match1] and [match2] plus [match3]');
    });
  });
});
