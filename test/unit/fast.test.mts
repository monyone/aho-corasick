import { test, expect, describe } from 'vitest';

import { AhoCorasick } from '../../src/fast.mts'

// ===========================================
// matchInText
// ===========================================

describe('matchInText', () => {
  test("Check prefix contain", () => {
    const aho = new AhoCorasick(['abc', 'bde']);
    expect(aho.matchInText('abce')).toStrictEqual([
      { begin: 0, end: 3, keyword: 'abc'}
    ]);
  });

  test("Check suffix contain", () => {
    const aho = new AhoCorasick(['aac', 'bde']);
    expect(aho.matchInText('abde')).toStrictEqual([
      { begin: 1, end: 4, keyword: 'bde'}
    ]);
  });

  test("Check center contain", () => {
    const aho = new AhoCorasick(['aac', 'bde']);
    expect(aho.matchInText('abdec')).toStrictEqual([
      { begin: 1, end: 4, keyword: 'bde'}
    ]);
  });

  test("Check multiple contain", () => {
    const aho = new AhoCorasick(['aaa', 'bbb']);
    expect(aho.matchInText('aabbbbbaaaaaa')).toStrictEqual([
      { begin: 2, end: 5, keyword: 'bbb'},
      { begin: 3, end: 6, keyword: 'bbb'},
      { begin: 4, end: 7, keyword: 'bbb'},
      { begin: 7, end: 10, keyword: 'aaa'},
      { begin: 8, end: 11, keyword: 'aaa'},
      { begin: 9, end: 12, keyword: 'aaa'},
      { begin: 10, end: 13, keyword: 'aaa'}
    ]);
  });

  test("Check redundant contain", () => {
    const aho = new AhoCorasick(['aaa', 'aa', 'a']);
    expect(aho.matchInText('aabbbbbaa')).toStrictEqual([
      { begin: 0, end: 1, keyword: 'a'},
      { begin: 0, end: 2, keyword: 'aa'},
      { begin: 1, end: 2, keyword: 'a'},
      { begin: 7, end: 8, keyword: 'a'},
      { begin: 7, end: 9, keyword: 'aa'},
      { begin: 8, end: 9, keyword: 'a'}
    ]);
  });

  test('Check failure link', () => {
    const aho = new AhoCorasick(['abc', 'bde']);
    expect(aho.matchInText('abde')).toStrictEqual([
      { begin: 1, end: 4, keyword: 'bde'}
    ]);
  });

  test('No match returns empty array', () => {
    const aho = new AhoCorasick(['xyz', 'uvw']);
    expect(aho.matchInText('abcdefgh')).toStrictEqual([]);
  });

  test('Empty text returns empty array', () => {
    const aho = new AhoCorasick(['abc']);
    expect(aho.matchInText('')).toStrictEqual([]);
  });

  test('Single character keywords', () => {
    const aho = new AhoCorasick(['a', 'b', 'c']);
    expect(aho.matchInText('abc')).toStrictEqual([
      { begin: 0, end: 1, keyword: 'a'},
      { begin: 1, end: 2, keyword: 'b'},
      { begin: 2, end: 3, keyword: 'c'}
    ]);
  });

  test('Keyword equals entire text', () => {
    const aho = new AhoCorasick(['hello']);
    expect(aho.matchInText('hello')).toStrictEqual([
      { begin: 0, end: 5, keyword: 'hello'}
    ]);
  });

  test('Keyword longer than text', () => {
    const aho = new AhoCorasick(['abcdef']);
    expect(aho.matchInText('abc')).toStrictEqual([]);
  });

  test('Duplicate keywords', () => {
    const aho = new AhoCorasick(['abc', 'abc']);
    const result = aho.matchInText('abc');
    expect(result).toStrictEqual([
      { begin: 0, end: 3, keyword: 'abc'},
      { begin: 0, end: 3, keyword: 'abc'}
    ]);
  });

  test('Keywords that are prefixes of each other', () => {
    const aho = new AhoCorasick(['a', 'ab', 'abc']);
    expect(aho.matchInText('abcd')).toStrictEqual([
      { begin: 0, end: 1, keyword: 'a'},
      { begin: 0, end: 2, keyword: 'ab'},
      { begin: 0, end: 3, keyword: 'abc'}
    ]);
  });

  test('Keywords that are suffixes of each other', () => {
    const aho = new AhoCorasick(['c', 'bc', 'abc']);
    expect(aho.matchInText('xabc')).toStrictEqual([
      { begin: 1, end: 4, keyword: 'abc'},
      { begin: 2, end: 4, keyword: 'bc'},
      { begin: 3, end: 4, keyword: 'c'}
    ]);
  });

  test('Failure link chain - keyword found via deep failure traversal', () => {
    // "she" should be found inside "ushers" via failure link from "usher" path
    const aho = new AhoCorasick(['he', 'she', 'his', 'hers']);
    const result = aho.matchInText('ushers');
    expect(result).toContainEqual({ begin: 1, end: 4, keyword: 'she'});
    expect(result).toContainEqual({ begin: 2, end: 4, keyword: 'he'});
    expect(result).toContainEqual({ begin: 2, end: 6, keyword: 'hers'});
  });

  test('Overlapping matches at same position', () => {
    const aho = new AhoCorasick(['ab', 'abc', 'abcd']);
    expect(aho.matchInText('abcd')).toStrictEqual([
      { begin: 0, end: 2, keyword: 'ab'},
      { begin: 0, end: 3, keyword: 'abc'},
      { begin: 0, end: 4, keyword: 'abcd'}
    ]);
  });

  test('Multiple matches at different positions', () => {
    const aho = new AhoCorasick(['ab']);
    expect(aho.matchInText('ababab')).toStrictEqual([
      { begin: 0, end: 2, keyword: 'ab'},
      { begin: 2, end: 4, keyword: 'ab'},
      { begin: 4, end: 6, keyword: 'ab'}
    ]);
  });

  test('Unknown characters in text', () => {
    const aho = new AhoCorasick(['abc']);
    expect(aho.matchInText('xyzabcxyz')).toStrictEqual([
      { begin: 3, end: 6, keyword: 'abc'}
    ]);
  });

  test('Text with characters not in any keyword', () => {
    const aho = new AhoCorasick(['ab']);
    expect(aho.matchInText('xxabxx')).toStrictEqual([
      { begin: 2, end: 4, keyword: 'ab'}
    ]);
  });

  test('Many keywords', () => {
    const keywords = Array.from({ length: 100 }, (_, i) => `kw${i}`);
    const aho = new AhoCorasick(keywords);
    const result = aho.matchInText('xkw0xkw50xkw99x');
    expect(result).toContainEqual({ begin: 1, end: 4, keyword: 'kw0'});
    expect(result).toContainEqual({ begin: 5, end: 9, keyword: 'kw50'});
    expect(result).toContainEqual({ begin: 10, end: 14, keyword: 'kw99'});
  });
});

// ===========================================
// hasKeywordInText
// ===========================================

describe('hasKeywordInText', () => {
  test('Returns true when keyword exists at prefix', () => {
    const aho = new AhoCorasick(['abc', 'bde']);
    expect(aho.hasKeywordInText('abce')).toBe(true);
  });

  test('Returns true when keyword exists at suffix', () => {
    const aho = new AhoCorasick(['aac', 'bde']);
    expect(aho.hasKeywordInText('abde')).toBe(true);
  });

  test('Returns true when keyword exists in center', () => {
    const aho = new AhoCorasick(['abc', 'bde']);
    expect(aho.hasKeywordInText('abdec')).toBe(true);
  });

  test('Returns false when no keyword matches', () => {
    const aho = new AhoCorasick(['xyz', 'uvw']);
    expect(aho.hasKeywordInText('abcdefgh')).toBe(false);
  });

  test('Returns false for empty text', () => {
    const aho = new AhoCorasick(['abc']);
    expect(aho.hasKeywordInText('')).toBe(false);
  });

  test('Returns true for exact match', () => {
    const aho = new AhoCorasick(['hello']);
    expect(aho.hasKeywordInText('hello')).toBe(true);
  });

  test('Returns false when keyword is longer than text', () => {
    const aho = new AhoCorasick(['abcdef']);
    expect(aho.hasKeywordInText('abc')).toBe(false);
  });

  test('Returns true via failure link', () => {
    const aho = new AhoCorasick(['abc', 'bde']);
    expect(aho.hasKeywordInText('abde')).toBe(true);
  });

  test('Returns true with single character keyword', () => {
    const aho = new AhoCorasick(['x']);
    expect(aho.hasKeywordInText('abcxdef')).toBe(true);
  });

  test('Returns false with unknown characters only', () => {
    const aho = new AhoCorasick(['ab']);
    expect(aho.hasKeywordInText('xxxx')).toBe(false);
  });

  test('Returns true when keyword is at the very end', () => {
    const aho = new AhoCorasick(['end']);
    expect(aho.hasKeywordInText('the end')).toBe(true);
  });
});

// ===========================================
// Surrogate pairs (emoji)
// ===========================================

describe('Surrogate pairs', () => {
  test('Basic emoji matching', () => {
    const aho = new AhoCorasick(['👍', '🎉', '❤️']);
    expect(aho.matchInText('Hello👍World🎉Test❤️')).toStrictEqual([
      { begin: 5, end: 7, keyword: '👍'},
      { begin: 12, end: 14, keyword: '🎉'},
      { begin: 18, end: 20, keyword: '❤️'},
    ]);
  });

  test('Overlapping patterns with ZWJ', () => {
    const aho = new AhoCorasick(['👨', '👨‍👩‍👧', '👩']);
    expect(aho.matchInText('👨‍👩‍👧')).toStrictEqual([
      { begin: 0, end: 2, keyword: '👨'},
      { begin: 3, end: 5, keyword: '👩'},
      { begin: 0, end: 8, keyword: '👨‍👩‍👧'}
    ]);
  });

  test('Mixed with ASCII', () => {
    const aho = new AhoCorasick(['test', '🚀', 'hello']);
    expect(aho.matchInText('test🚀hello')).toStrictEqual([
      { begin: 0, end: 4, keyword: 'test'},
      { begin: 4, end: 6, keyword: '🚀'},
      { begin: 6, end: 11, keyword: 'hello'}
    ]);
  });

  test('Repeated emoji', () => {
    const aho = new AhoCorasick(['😀', '😀😀', '😀😀😀']);
    expect(aho.matchInText('😀😀😀')).toStrictEqual([
      { begin: 0, end: 2, keyword: '😀'},
      { begin: 0, end: 4, keyword: '😀😀'},
      { begin: 2, end: 4, keyword: '😀'},
      { begin: 0, end: 6, keyword: '😀😀😀'},
      { begin: 2, end: 6, keyword: '😀😀'},
      { begin: 4, end: 6, keyword: '😀'}
    ]);
  });

  test('Japanese text with emoji', () => {
    const aho = new AhoCorasick(['🍣', '寿司', '🍜']);
    expect(aho.matchInText('今日は🍣寿司を食べました🍜')).toStrictEqual([
      { begin: 3, end: 5, keyword: '🍣'},
      { begin: 5, end: 7, keyword: '寿司'},
      { begin: 13, end: 15, keyword: '🍜'}
    ]);
  });
});
