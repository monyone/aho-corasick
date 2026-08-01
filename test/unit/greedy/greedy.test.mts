import { test, expect, describe } from 'vitest';

import { AhoCorasick, Boundary, Replacer, AsyncableReplacer } from '../../../src/greedy/greedy.mts'

test("Check prefix contain in matchInText", () => {
  const aho = new AhoCorasick(['abc', 'bde']);
  expect(aho.matchInText('abce')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'}
  ]);
});

test("Check suffix contain in matchInText", () => {
  const aho = new AhoCorasick(['aac', 'bde']);
  expect(aho.matchInText('abde')).toStrictEqual([
    { begin: 1, end: 4, keyword: 'bde'}
  ]);
});

test("Check center contain in matchInText", () => {
  const aho = new AhoCorasick(['aac', 'bde']);
  expect(aho.matchInText('abdec')).toStrictEqual([
    { begin: 1, end: 4, keyword: 'bde'}
  ]);
});

test("Check multiple contain in matchInText", () => {
  const aho = new AhoCorasick(['aaa', 'bbb']);
  expect(aho.matchInText('aabbbbbaaaaaa')).toStrictEqual([
    { begin: 2, end: 5, keyword: 'bbb'},
    { begin: 7, end: 10, keyword: 'aaa'},
    { begin: 10, end: 13, keyword: 'aaa'}
  ]);
});

test("Check redundance contain in matchInText", () => {
  const aho = new AhoCorasick(['aaa', 'aa', 'a']);
  expect(aho.matchInText('aabbbbbaa')).toStrictEqual([
    { begin: 0, end: 2, keyword: 'aa'},
    { begin: 7, end: 9, keyword: 'aa'},
  ]);
});

test('Check failure link in matchInText', () => {
  const aho = new AhoCorasick(['abc', 'bde']);
  // abde is ab -(failure Link)-> bc ->
  expect(aho.matchInText('abde')).toStrictEqual([
    { begin: 1, end: 4, keyword: 'bde'}
  ]);
});

test('Check greedy matching prefers longest keyword at same position', () => {
  const aho = new AhoCorasick(['a', 'ab', 'abc']);
  expect(aho.matchInText('abc')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'}
  ]);
});

test('Check greedy matching with overlapping patterns', () => {
  const aho = new AhoCorasick(['he', 'she', 'his', 'hers']);
  expect(aho.matchInText('shehis')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'she'},
    { begin: 3, end: 6, keyword: 'his'}
  ]);
});

test('Check greedy matching prioritizes longer match over shorter', () => {
  const aho = new AhoCorasick(['test', 'testing', 'tes']);
  expect(aho.matchInText('testing')).toStrictEqual([
    { begin: 0, end: 7, keyword: 'testing'}
  ]);
});

test('Check greedy matching with multiple longest matches', () => {
  const aho = new AhoCorasick(['cat', 'dog', 'category']);
  expect(aho.matchInText('category')).toStrictEqual([
    { begin: 0, end: 8, keyword: 'category'}
  ]);
});

test('Check greedy matching does not overlap matches', () => {
  const aho = new AhoCorasick(['ab', 'ba', 'aba']);
  expect(aho.matchInText('ababa')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'aba'},
    { begin: 3, end: 5, keyword: 'ba'}
  ]);
});

test('Check greedy matching with empty text', () => {
  const aho = new AhoCorasick(['test']);
  expect(aho.matchInText('')).toStrictEqual([]);
});

test('Check greedy matching with single character keywords', () => {
  const aho = new AhoCorasick(['a', 'b', 'c']);
  expect(aho.matchInText('abc')).toStrictEqual([
    { begin: 0, end: 1, keyword: 'a'},
    { begin: 1, end: 2, keyword: 'b'},
    { begin: 2, end: 3, keyword: 'c'}
  ]);
});

test('Check greedy matching with repeated characters', () => {
  const aho = new AhoCorasick(['aa', 'aaa', 'aaaa']);
  expect(aho.matchInText('aaaaaa')).toStrictEqual([
    { begin: 0, end: 4, keyword: 'aaaa'},
    { begin: 4, end: 6, keyword: 'aa'}
  ]);
});

test('Check greedy matching with prefix-suffix relationship', () => {
  const aho = new AhoCorasick(['abc', 'bc', 'c']);
  expect(aho.matchInText('abc')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'}
  ]);
});

test('Check greedy matching with completely nested patterns', () => {
  const aho = new AhoCorasick(['x', 'xx', 'xxx', 'xxxx', 'xxxxx']);
  expect(aho.matchInText('xxxxx')).toStrictEqual([
    { begin: 0, end: 5, keyword: 'xxxxx'}
  ]);
});

test('Check greedy matching skips shorter match when longer available', () => {
  const aho = new AhoCorasick(['in', 'test', 'testing']);
  expect(aho.matchInText('testing')).toStrictEqual([
    { begin: 0, end: 7, keyword: 'testing'}
  ]);
});

test('Check greedy matching with adjacent different length matches', () => {
  const aho = new AhoCorasick(['a', 'bb', 'ccc']);
  expect(aho.matchInText('abbccc')).toStrictEqual([
    { begin: 0, end: 1, keyword: 'a'},
    { begin: 1, end: 3, keyword: 'bb'},
    { begin: 3, end: 6, keyword: 'ccc'}
  ]);
});

test('Check greedy matching with multibyte characters', () => {
  const aho = new AhoCorasick(['あ', 'あい', 'あいう']);
  expect(aho.matchInText('あいう')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'あいう'}
  ]);
});

test('Check greedy matching with no matches', () => {
  const aho = new AhoCorasick(['test']);
  expect(aho.matchInText('hello world')).toStrictEqual([]);
});

test('Check greedy matching with same length keywords at same position', () => {
  const aho = new AhoCorasick(['cat', 'car']);
  const result = aho.matchInText('cat');
  expect(result.length).toBe(1);
  expect(result[0].begin).toBe(0);
  expect(result[0].end).toBe(3);
  expect(['cat', 'car']).toContain(result[0].keyword);
});

test('Check greedy chooses longest then continues non-overlapping', () => {
  const aho = new AhoCorasick(['ab', 'abc', 'cd']);
  expect(aho.matchInText('abcd')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'}
  ]);
});

test('Check greedy non-overlapping with multiple matches', () => {
  const aho = new AhoCorasick(['abc', 'bcd', 'cde']);
  expect(aho.matchInText('abcde')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'}
  ]);
});

test('Check greedy prefers longer over multiple shorter', () => {
  const aho = new AhoCorasick(['a', 'b', 'ab']);
  expect(aho.matchInText('ab')).toStrictEqual([
    { begin: 0, end: 2, keyword: 'ab'}
  ]);
});

test('Check greedy sequential non-overlapping matches', () => {
  const aho = new AhoCorasick(['abc', 'def']);
  expect(aho.matchInText('abcdef')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'},
    { begin: 3, end: 6, keyword: 'def'}
  ]);
});

test('Check desire_depth logic with failure transition after match', () => {
  // 'abc'をマッチした後、'x'でfailureが発生するケース
  const aho = new AhoCorasick(['abc', 'cx']);
  expect(aho.matchInText('abcx')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'},
    // 'cx'は'c'がposition 2で、'x'がposition 3だが、'abc'が0-3を消費しているので検出されない
  ]);
});

test('Check desire_depth with nested match after greedy', () => {
  // 'abcd'をマッチした後、'de'は重複するので検出されない（完全非重複）
  const aho = new AhoCorasick(['abcd', 'de']);
  expect(aho.matchInText('abcde')).toStrictEqual([
    { begin: 0, end: 4, keyword: 'abcd'},
    // 'de'は position 3-5 だが、position 3の'd'は既に'abcd'で使用済みなので検出されない
  ]);
});

test('Check desire_depth skips overlapping shorter keywords', () => {
  const aho = new AhoCorasick(['abc', 'bc', 'c', 'd']);
  expect(aho.matchInText('abcd')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'},
    { begin: 3, end: 4, keyword: 'd'}
  ]);
});

test('Check greedy matching with multiple byte', () => {
  const aho = new AhoCorasick(['シロナ', 'ガス', 'クジラ']);
  expect(aho.matchInText('シロナガスクジラ')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'シロナ'},
    { begin: 3, end: 5, keyword: 'ガス'},
    { begin: 5, end: 8, keyword: 'クジラ'},
  ]);
});

test('Check greedy matching with multiple byte 2', () => {
  const aho = new AhoCorasick(['シロナガ', 'クジラ']);
  expect(aho.matchInText('シロナガスクジラ')).toStrictEqual([
    { begin: 0, end: 4, keyword: 'シロナガ'},
    { begin: 5, end: 8, keyword: 'クジラ'},
  ]);
});

test('Check greedy matching with multiple byte 3', () => {
  const aho = new AhoCorasick(['シロナガス', 'クジラ']);
  expect(aho.matchInText('シロナガスクジラ')).toStrictEqual([
    { begin: 0, end: 5, keyword: 'シロナガス'},
    { begin: 5, end: 8, keyword: 'クジラ'},
  ]);
});

test('Check greedy matching with multiple byte 4', () => {
  const aho = new AhoCorasick(['シロナ', 'ナガス', 'スクジラ', 'クジラ']);
  expect(aho.matchInText('シロナガスクジラ')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'シロナ'},
    { begin: 4, end: 8, keyword: 'スクジラ'},
  ]);
});

test('Check greedy matching with multiple byte5', () => {
  const aho = new AhoCorasick(['シロナ', 'ガス', 'クジラ', 'シロナガスクロロ']);
  expect(aho.matchInText('シロナガスクジラ')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'シロナ'},
    { begin: 3, end: 5, keyword: 'ガス'},
    { begin: 5, end: 8, keyword: 'クジラ'},
  ]);
});

test('Check greedy matching with multiple byte6', () => {
  const aho = new AhoCorasick(['シロナ', 'ガス', 'クジラ', 'シロナガスアロロ']);
  expect(aho.matchInText('シロナガスクジラ')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'シロナ'},
    { begin: 3, end: 5, keyword: 'ガス'},
    { begin: 5, end: 8, keyword: 'クジラ'},
  ]);
});

test('Check greedy with complex overlapping patterns', () => {
  const aho = new AhoCorasick(['bcde', 'cdef', 'defg', 'efgh', 'fehg', 'fegh', 'bcdcbcdefeghe']);
  expect(aho.matchInText('bcdcbcdefegh')).toStrictEqual([
    { begin: 4, end: 8, keyword: 'bcde'},
    { begin: 8, end: 12, keyword: 'fegh'},
  ]);
});

test('Check greedy fallback when longest keyword does not match', () => {
  const aho = new AhoCorasick(['abcdefgh', 'bcd', 'ef']);
  expect(aho.matchInText('abcdefgx')).toStrictEqual([
    { begin: 1, end: 4, keyword: 'bcd'},
    { begin: 4, end: 6, keyword: 'ef'}
  ]);
});


test('Check greedy fallback when longest keyword does not match 2', () => {
  const aho = new AhoCorasick(['abcdefghx', 'bcd', 'ef', 'ghe']);
  expect(aho.matchInText('abcdefghe')).toStrictEqual([
    { begin: 1, end: 4, keyword: 'bcd'},
    { begin: 4, end: 6, keyword: 'ef'},
    { begin: 6, end: 9, keyword: 'ghe'},
  ]);
});

test('Check greedy fallback when longest keyword does not match 2', () => {
  const aho = new AhoCorasick(['abcdefghx', 'bcd', 'ef', 'gh', 'ghe']);
  expect(aho.matchInText('abcdefghe')).toStrictEqual([
    { begin: 1, end: 4, keyword: 'bcd'},
    { begin: 4, end: 6, keyword: 'ef'},
    { begin: 6, end: 9, keyword: 'ghe'},
  ]);
});

test('Check greedy fallback with multiple length candidates', () => {
  const aho = new AhoCorasick(['abcdefgh', 'abcdef', 'abcd', 'ab']);
  // 'abcdefgx'では最長'abcdefgh'が失敗し、'abcdef'が選ばれる
  expect(aho.matchInText('abcdefgx')).toStrictEqual([
    { begin: 0, end: 6, keyword: 'abcdef'}
  ]);
});

test('Check greedy fallback with interleaved patterns', () => {
  const aho = new AhoCorasick(['abcxyz', 'abc', 'xyz', 'cx']);
  // 'abcxyz'が完全にマッチ
  expect(aho.matchInText('abcxyz')).toStrictEqual([
    { begin: 0, end: 6, keyword: 'abcxyz'}
  ]);
  // 'abcxy'では'abcxyz'が失敗し、'abc'がマッチ
  expect(aho.matchInText('abcxy')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'}
  ]);
  // 'abcxabc'では'abcxyz'が失敗し、'abc'が2回マッチ
  expect(aho.matchInText('abcxabc')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'},
    { begin: 4, end: 7, keyword: 'abc'}
  ]);
});

test('Check greedy fallback with suffix match after failure', () => {
  const aho = new AhoCorasick(['testing123', 'testing', 'ing', '123']);
  // 'testing456'では'testing123'が失敗し、'testing'がマッチ
  expect(aho.matchInText('testing456')).toStrictEqual([
    { begin: 0, end: 7, keyword: 'testing'}
  ]);
  // 'testing123'では最長がマッチ
  expect(aho.matchInText('testing123')).toStrictEqual([
    { begin: 0, end: 10, keyword: 'testing123'}
  ]);
});

test('Check greedy fallback cascade through multiple levels', () => {
  const aho = new AhoCorasick(['aaaaa', 'aaaa', 'aaa', 'aa', 'a']);
  // 'aaab'では'aaaaa', 'aaaa'が失敗し、'aaa'がマッチ
  expect(aho.matchInText('aaab')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'aaa'}
  ]);
  // 'aaaaaab'では'aaaaa'が1回、残りの'a'は'b'で途切れるので'a'が1回マッチ
  expect(aho.matchInText('aaaaaab')).toStrictEqual([
    { begin: 0, end: 5, keyword: 'aaaaa'},
    { begin: 5, end: 6, keyword: 'a'}
  ]);
});

test('Check greedy fallback with failure link traversal', () => {
  const aho = new AhoCorasick(['abcabc', 'abc', 'cab', 'bc']);
  // 'abcabx'では'abcabc'が失敗し、'abc'がマッチ
  expect(aho.matchInText('abcabx')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'}
  ]);
  // 'abcabc'では最長がマッチ
  expect(aho.matchInText('abcabc')).toStrictEqual([
    { begin: 0, end: 6, keyword: 'abcabc'}
  ]);
});

test('Check surrogate pairs (emoji) matching', () => {
  // サロゲートペア（絵文字）のテスト - begin/endはUTF-16コードユニット単位
  const aho = new AhoCorasick(['👍', '🎉', '❤️']);
  expect(aho.matchInText('Hello👍World🎉Test❤️')).toStrictEqual([
    { begin: 5, end: 7, keyword: '👍'},    // UTF-16: 'Hello'=5, '👍'=2 units
    { begin: 12, end: 14, keyword: '🎉'},  // UTF-16: +5('World')=12
    { begin: 18, end: 20, keyword: '❤️'},  // UTF-16: +4('Test')=18
  ]);
});

test('Check surrogate pairs with overlapping patterns', () => {
  const aho = new AhoCorasick(['👨', '👨‍👩‍👧', '👩']);
  // '👨‍👩‍👧'は複合絵文字（家族）で、ZWJ（Zero Width Joiner）を含む
  // UTF-16で8コードユニット（👨=2, ZWJ=1, 👩=2, ZWJ=1, 👧=2）
  expect(aho.matchInText('👨‍👩‍👧')).toStrictEqual([
    { begin: 0, end: 8, keyword: '👨‍👩‍👧'}
  ]);
});

test('Check surrogate pairs mixed with ASCII', () => {
  const aho = new AhoCorasick(['test', '🚀', 'hello']);
  expect(aho.matchInText('test🚀hello')).toStrictEqual([
    { begin: 0, end: 4, keyword: 'test'},
    { begin: 4, end: 6, keyword: '🚀'},
    { begin: 6, end: 11, keyword: 'hello'}
  ]);
});

test('Check surrogate pairs with repeated emoji', () => {
  const aho = new AhoCorasick(['😀', '😀😀', '😀😀😀']);
  expect(aho.matchInText('😀😀😀')).toStrictEqual([
    { begin: 0, end: 6, keyword: '😀😀😀'}
  ]);
});

test('Check surrogate pairs in Japanese text', () => {
  const aho = new AhoCorasick(['🍣', '寿司', '🍜']);
  expect(aho.matchInText('今日は🍣寿司を食べました🍜')).toStrictEqual([
    { begin: 3, end: 5, keyword: '🍣'},
    { begin: 5, end: 7, keyword: '寿司'},
    { begin: 13, end: 15, keyword: '🍜'}
  ]);
});

test('check failure selection algorithm', () => {
  const aho = new AhoCorasick(['dcbacbax', 'ba', 'cba', 'dc', 'cb', 'a']);
  expect(aho.matchInText('dcbacba')).toStrictEqual([
    { begin: 0, end: 2, keyword: 'dc'},
    { begin: 2, end: 4, keyword: 'ba'},
    { begin: 4, end: 7, keyword: 'cba'},
  ]);
});

test('Check duplicate keywords', () => {
  const aho = new AhoCorasick(['test', 'test', 'abc', 'test']);
  expect(aho.matchInText('testabc')).toStrictEqual([
    { begin: 0, end: 4, keyword: 'test'},
    { begin: 4, end: 7, keyword: 'abc'}
  ]);
});

test('Check very long keyword matching', () => {
  const longKeyword = 'a'.repeat(1000);
  const aho = new AhoCorasick([longKeyword, 'a'.repeat(500)]);
  expect(aho.matchInText(longKeyword)).toStrictEqual([
    { begin: 0, end: 1000, keyword: longKeyword}
  ]);
});

test('Check deep failure link traversal', () => {
  const aho = new AhoCorasick(['aaaaaab', 'aaaaab', 'aaaab', 'aaab', 'aab', 'ab', 'b']);
  expect(aho.matchInText('aaaaaaab')).toStrictEqual([
    { begin: 1, end: 8, keyword: 'aaaaaab'},
  ]);
});

test('Check greedy with complex failure transitions', () => {
  const aho = new AhoCorasick(['ababc', 'abc', 'bab', 'bc', 'c']);
  expect(aho.matchInText('ababacbc')).toStrictEqual([
    { begin: 1, end: 4, keyword: 'bab'},
    { begin: 5, end: 6, keyword: 'c'},
    { begin: 6, end: 8, keyword: 'bc'},
  ]);
});

test('Check greedy with all keywords being prefixes', () => {
  const aho = new AhoCorasick(['a', 'ab', 'abc', 'abcd', 'abcde']);
  expect(aho.matchInText('abcde')).toStrictEqual([
    { begin: 0, end: 5, keyword: 'abcde'}
  ]);
  expect(aho.matchInText('abcdeabc')).toStrictEqual([
    { begin: 0, end: 5, keyword: 'abcde'},
    { begin: 5, end: 8, keyword: 'abc'}
  ]);
});

describe('hasKeywordInText', () => {
  test('returns true when a keyword is present', () => {
    const aho = new AhoCorasick(['cat', 'dog']);
    expect(aho.hasKeywordInText('a dog here')).toBe(true);
  });

  test('returns false when no keyword is present', () => {
    const aho = new AhoCorasick(['cat', 'dog']);
    expect(aho.hasKeywordInText('nothing here')).toBe(false);
  });

  test('returns false for empty text', () => {
    const aho = new AhoCorasick(['cat']);
    expect(aho.hasKeywordInText('')).toBe(false);
  });

  test('matches via failure link', () => {
    const aho = new AhoCorasick(['abc', 'bde']);
    expect(aho.hasKeywordInText('abde')).toBe(true);
  });

  test('empty keyword makes any text match', () => {
    const aho = new AhoCorasick(['']);
    expect(aho.hasKeywordInText('anything')).toBe(true);
    expect(aho.hasKeywordInText('')).toBe(true);
  });

  test('respects boundary: whole word matches', () => {
    const aho = new AhoCorasick(['cat']);
    expect(aho.hasKeywordInText('a cat here', Boundary.AsciiTerm())).toBe(true);
  });

  test('respects boundary: substring inside a larger word does not match', () => {
    const aho = new AhoCorasick(['cat']);
    expect(aho.hasKeywordInText('category', Boundary.AsciiTerm())).toBe(false);
  });

  test('keeps scanning past a boundary-blocked occurrence', () => {
    const aho = new AhoCorasick(['cat']);
    // first "cat" is inside "category" (blocked), standalone "cat" later is accepted
    expect(aho.hasKeywordInText('category cat', Boundary.AsciiTerm())).toBe(true);
  });
});

describe('matchInText with boundary', () => {
  test('replaces standalone word but keeps substring inside a larger word', () => {
    const aho = new AhoCorasick(['cat']);
    expect(aho.matchInText('a cat and category', Boundary.AsciiTerm())).toStrictEqual([
      { begin: 2, end: 5, keyword: 'cat' }
    ]);
  });

  test('word at text start and end passes without a boundary char', () => {
    const aho = new AhoCorasick(['cat']);
    expect(aho.matchInText('cat and cat', Boundary.AsciiTerm())).toStrictEqual([
      { begin: 0, end: 3, keyword: 'cat' },
      { begin: 8, end: 11, keyword: 'cat' }
    ]);
  });

  test('falls back to a shorter keyword when the longer one is blocked by the boundary', () => {
    const aho = new AhoCorasick(['ABC CD', 'ABC']);
    // "ABC CD" is present but followed by 'E', so it is not a whole term;
    // the shorter "ABC" must survive instead
    expect(aho.matchInText('ABC CDE', Boundary.AsciiTerm())).toStrictEqual([
      { begin: 0, end: 3, keyword: 'ABC' }
    ]);
  });

  test('the longer keyword wins when it is a whole term', () => {
    const aho = new AhoCorasick(['ABC CD', 'ABC']);
    expect(aho.matchInText('ABC CD END', Boundary.AsciiTerm())).toStrictEqual([
      { begin: 0, end: 6, keyword: 'ABC CD' }
    ]);
  });

  test('Boundary.WhiteSpace treats punctuation-wrapped words as non-boundary', () => {
    const aho = new AhoCorasick(['cat']);
    expect(aho.matchInText('(cat) cat', Boundary.WhiteSpace())).toStrictEqual([
      { begin: 6, end: 9, keyword: 'cat' }
    ]);
  });

  test('Boundary.By uses a custom separator', () => {
    const aho = new AhoCorasick(['cat']);
    // only '/' delimits; "/cat/" matches, trailing " cat" has a non-separator left char
    expect(aho.matchInText('/cat/ a cat', Boundary.By(/\//))).toStrictEqual([
      { begin: 1, end: 4, keyword: 'cat' }
    ]);
  });

  test('non-ASCII keyword is never subject to the AsciiTerm whole-term check', () => {
    const aho = new AhoCorasick(['東京']);
    expect(aho.matchInText('東京と東京都', Boundary.AsciiTerm())).toStrictEqual([
      { begin: 0, end: 2, keyword: '東京' },
      { begin: 3, end: 5, keyword: '東京' }
    ]);
  });
});

describe('tokenizeInText', () => {
  test('splits text into normal and target tokens', () => {
    const aho = new AhoCorasick(['cat', 'dog']);
    const tokens = aho.tokenizeInText(
      'a cat and a dog',
      (chunk) => ({ type: 'text', chunk }),
      (keyword) => ({ type: 'match', keyword }),
    );
    expect(tokens).toStrictEqual([
      { type: 'text', chunk: 'a ' },
      { type: 'match', keyword: 'cat' },
      { type: 'text', chunk: ' and a ' },
      { type: 'match', keyword: 'dog' },
    ]);
  });

  test('match at the very start has no leading normal token', () => {
    const aho = new AhoCorasick(['cat']);
    const tokens = aho.tokenizeInText(
      'cat!',
      (chunk) => ({ n: chunk }),
      (keyword) => ({ k: keyword }),
    );
    expect(tokens).toStrictEqual([
      { k: 'cat' },
      { n: '!' },
    ]);
  });

  test('match at the very end has no trailing normal token', () => {
    const aho = new AhoCorasick(['cat']);
    const tokens = aho.tokenizeInText(
      '!cat',
      (chunk) => ({ n: chunk }),
      (keyword) => ({ k: keyword }),
    );
    expect(tokens).toStrictEqual([
      { n: '!' },
      { k: 'cat' },
    ]);
  });

  test('text with no match is a single normal token', () => {
    const aho = new AhoCorasick(['cat']);
    const tokens = aho.tokenizeInText(
      'hello',
      (chunk) => ({ n: chunk }),
      (keyword) => ({ k: keyword }),
    );
    expect(tokens).toStrictEqual([{ n: 'hello' }]);
  });

  test('empty text yields no tokens', () => {
    const aho = new AhoCorasick(['cat']);
    const tokens = aho.tokenizeInText('', (c) => c, (k) => k);
    expect(tokens).toStrictEqual([]);
  });

  test('honours the boundary function', () => {
    const aho = new AhoCorasick(['cat']);
    const tokens = aho.tokenizeInText(
      'category cat',
      (chunk) => ({ n: chunk }),
      (keyword) => ({ k: keyword }),
      Boundary.AsciiTerm(),
    );
    expect(tokens).toStrictEqual([
      { n: 'category ' },
      { k: 'cat' },
    ]);
  });
});

describe('replaceInText', () => {
  test('replaces with a function', () => {
    const aho = new AhoCorasick(['cat', 'dog']);
    expect(aho.replaceInText('a cat and a dog', (m) => `[${m}]`)).toBe('a [cat] and a [dog]');
  });

  test('replaces with a Map', () => {
    const aho = new AhoCorasick(['cat', 'dog']);
    const map = new Map([['cat', 'DOG'], ['dog', 'CAT']]);
    expect(aho.replaceInText('a cat and a dog', map)).toBe('a DOG and a CAT');
  });

  test('replaces with a Record', () => {
    const aho = new AhoCorasick(['cat', 'dog']);
    expect(aho.replaceInText('a cat and a dog', { cat: 'DOG', dog: 'CAT' })).toBe('a DOG and a CAT');
  });

  test('keyword absent from the map is left unchanged', () => {
    const aho = new AhoCorasick(['cat', 'dog']);
    expect(aho.replaceInText('a cat and a dog', new Map([['cat', 'DOG']]))).toBe('a DOG and a dog');
  });

  test('function returning false keeps the original', () => {
    const aho = new AhoCorasick(['cat', 'dog']);
    expect(aho.replaceInText('a cat and a dog', (m) => m === 'cat' ? 'DOG' : false)).toBe('a DOG and a dog');
  });

  test('no match returns the original text', () => {
    const aho = new AhoCorasick(['cat']);
    expect(aho.replaceInText('nothing here', () => 'X')).toBe('nothing here');
  });

  test('respects the boundary function', () => {
    const aho = new AhoCorasick(['cat']);
    expect(aho.replaceInText('a cat and category', () => 'DOG', Boundary.AsciiTerm())).toBe('a DOG and category');
  });

  test('Replacer.Delete removes the match', () => {
    const aho = new AhoCorasick(['cat']);
    expect(aho.replaceInText('a cat here', Replacer.Delete())).toBe('a  here');
  });

  test('Replacer.Mask masks with a repeated char', () => {
    const aho = new AhoCorasick(['cat']);
    expect(aho.replaceInText('a cat here', Replacer.Mask('*'))).toBe('a *** here');
  });

  test('Replacer.Keep leaves the match untouched', () => {
    const aho = new AhoCorasick(['cat']);
    expect(aho.replaceInText('a cat here', Replacer.Keep())).toBe('a cat here');
  });

  test('Replacer.Once replaces only the first occurrence', () => {
    const aho = new AhoCorasick(['cat']);
    expect(aho.replaceInText('cat cat cat', Replacer.Once(() => 'DOG'))).toBe('DOG cat cat');
  });
});

describe('replaceAsyncInText', () => {
  test('replaces with an async function', async () => {
    const aho = new AhoCorasick(['cat', 'dog']);
    const result = await aho.replaceAsyncInText('a cat and a dog', async (m) => `[${m}]`);
    expect(result).toBe('a [cat] and a [dog]');
  });

  test('accepts a synchronous-returning function', async () => {
    const aho = new AhoCorasick(['cat']);
    const result = await aho.replaceAsyncInText('a cat here', (m) => m.toUpperCase());
    expect(result).toBe('a CAT here');
  });

  test('async function returning false keeps the original', async () => {
    const aho = new AhoCorasick(['cat', 'dog']);
    const result = await aho.replaceAsyncInText('a cat and a dog', async (m) => m === 'cat' ? 'DOG' : false);
    expect(result).toBe('a DOG and a dog');
  });

  test('respects the boundary function', async () => {
    const aho = new AhoCorasick(['cat']);
    const result = await aho.replaceAsyncInText('a cat and category', async () => 'DOG', Boundary.AsciiTerm());
    expect(result).toBe('a DOG and category');
  });

  test('accepts a Map replacer', async () => {
    const aho = new AhoCorasick(['cat', 'dog']);
    const map = new Map([['cat', 'DOG'], ['dog', 'CAT']]);
    const result = await aho.replaceAsyncInText('a cat and a dog', map);
    expect(result).toBe('a DOG and a CAT');
  });

  test('accepts a Record replacer', async () => {
    const aho = new AhoCorasick(['cat', 'dog']);
    const result = await aho.replaceAsyncInText('a cat and a dog', { cat: 'DOG', dog: 'CAT' });
    expect(result).toBe('a DOG and a CAT');
  });

  test('AsyncableReplacer.Once replaces only the first occurrence', async () => {
    const aho = new AhoCorasick(['cat']);
    const result = await aho.replaceAsyncInText('cat cat cat', AsyncableReplacer.Once(async (m) => m.toUpperCase()));
    expect(result).toBe('CAT cat cat');
  });
});

describe('empty keyword', () => {
  test('matchInText: empty keyword matches (zero-width) at every position', () => {
    const aho = new AhoCorasick(['']);
    expect(aho.matchInText('ab')).toStrictEqual([
      { begin: 0, end: 0, keyword: '' },
      { begin: 1, end: 1, keyword: '' },
      { begin: 2, end: 2, keyword: '' },
    ]);
  });

  test('matchInText: empty keyword on empty text yields a single zero-width match', () => {
    const aho = new AhoCorasick(['']);
    expect(aho.matchInText('')).toStrictEqual([
      { begin: 0, end: 0, keyword: '' },
    ]);
  });

  test('matchInText: a longer match wins over a zero-width match at the same start', () => {
    const aho = new AhoCorasick(['', 'ab']);
    // at begin=1 the empty match is dropped in favour of "ab" growing from there;
    // zero-width matches only survive where nothing longer starts
    expect(aho.matchInText('xaby')).toStrictEqual([
      { begin: 0, end: 0, keyword: '' },
      { begin: 1, end: 3, keyword: 'ab' },
      { begin: 4, end: 4, keyword: '' },
    ]);
  });

  test('matchInText: a match starting at 0 wins over the leading zero-width match', () => {
    const aho = new AhoCorasick(['', 'ab']);
    expect(aho.matchInText('ab')).toStrictEqual([
      { begin: 0, end: 2, keyword: 'ab' },
    ]);
  });

  test('matchInText: zero-width matches between real matches are dropped', () => {
    const aho = new AhoCorasick(['', 'ab', 'cd']);
    expect(aho.matchInText('abcd')).toStrictEqual([
      { begin: 0, end: 2, keyword: 'ab' },
      { begin: 2, end: 4, keyword: 'cd' },
    ]);
  });

  test('tokenizeInText: empty keyword interleaves zero-width targets between chars', () => {
    const aho = new AhoCorasick(['']);
    const tokens = aho.tokenizeInText('ab', (n) => ({ n }), (k) => ({ k }));
    expect(tokens).toStrictEqual([
      { k: '' },
      { n: 'a' },
      { k: '' },
      { n: 'b' },
      { k: '' },
    ]);
  });

  test('replaceInText: empty keyword inserts the replacement at every position', () => {
    const aho = new AhoCorasick(['']);
    expect(aho.replaceInText('ab', () => 'X')).toBe('XaXbX');
  });

  test('replaceInText: empty keyword on empty text', () => {
    const aho = new AhoCorasick(['']);
    expect(aho.replaceInText('', () => 'X')).toBe('X');
  });

  test('replaceAsyncInText: empty keyword inserts the replacement at every position', async () => {
    const aho = new AhoCorasick(['']);
    const result = await aho.replaceAsyncInText('ab', async () => 'X');
    expect(result).toBe('XaXbX');
  });
});

test('Check Unicode combining characters', () => {
  const aho = new AhoCorasick(['café', 'cafe']);
  expect(aho.matchInText('café')).toStrictEqual([
    { begin: 0, end: 4, keyword: 'café'}
  ]);
});

test('Check greedy with alternating patterns', () => {
  const aho = new AhoCorasick(['aba', 'bab', 'a', 'b']);
  expect(aho.matchInText('abababa')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'aba'},
    { begin: 3, end: 6, keyword: 'bab'},
    { begin: 6, end: 7, keyword: 'a'}
  ]);
});

test('Check greedy with keywords that are rotations', () => {
  const aho = new AhoCorasick(['abc', 'bca', 'cab']);
  expect(aho.matchInText('abcabc')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'},
    { begin: 3, end: 6, keyword: 'abc'}
  ]);
  expect(aho.matchInText('abcbca')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'},
    { begin: 3, end: 6, keyword: 'bca'}
  ]);
});

test('Check greedy with keywords containing each other non-prefix', () => {
  const aho = new AhoCorasick(['xabcy', 'abc', 'bcd', 'y']);
  expect(aho.matchInText('xabcy')).toStrictEqual([
    { begin: 0, end: 5, keyword: 'xabcy'}
  ]);
  expect(aho.matchInText('abcbcd')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'},
    { begin: 3, end: 6, keyword: 'bcd'}
  ]);
});

test('Check whitespace and special characters', () => {
  const aho = new AhoCorasick(['hello world', ' ', 'world']);
  expect(aho.matchInText('hello world')).toStrictEqual([
    { begin: 0, end: 11, keyword: 'hello world'}
  ]);
});
