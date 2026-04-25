import { test, expect } from 'vitest';

import { AhoCorasick } from '../../src/greedy_stackless_skiplink.mts'

test("Check prefix contain in matchInText", () => {
  const aho = new AhoCorasick(['abc', 'bde']);
  expect(Array.from(aho.matchInText('abce'))).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'}
  ]);
});

test("Check suffix contain in matchInText", () => {
  const aho = new AhoCorasick(['aac', 'bde']);
  expect(Array.from(aho.matchInText('abde'))).toStrictEqual([
    { begin: 1, end: 4, keyword: 'bde'}
  ]);
});

test("Check center contain in matchInText", () => {
  const aho = new AhoCorasick(['aac', 'bde']);
  expect(Array.from(aho.matchInText('abdec'))).toStrictEqual([
    { begin: 1, end: 4, keyword: 'bde'}
  ]);
});

test("Check multiple contain in matchInText", () => {
  const aho = new AhoCorasick(['aaa', 'bbb']);
  expect(Array.from(aho.matchInText('aabbbbbaaaaaa'))).toStrictEqual([
    { begin: 2, end: 5, keyword: 'bbb'},
    { begin: 7, end: 10, keyword: 'aaa'},
    { begin: 10, end: 13, keyword: 'aaa'}
  ]);
});

test("Check redundance contain in matchInText", () => {
  const aho = new AhoCorasick(['aaa', 'aa', 'a']);
  expect(Array.from(aho.matchInText('aabbbbbaa'))).toStrictEqual([
    { begin: 0, end: 2, keyword: 'aa'},
    { begin: 7, end: 9, keyword: 'aa'},
  ]);
});

test('Check failure link in matchInText', () => {
  const aho = new AhoCorasick(['abc', 'bde']);
  // abde is ab -(failure Link)-> bc ->
  expect(Array.from(aho.matchInText('abde'))).toStrictEqual([
    { begin: 1, end: 4, keyword: 'bde'}
  ]);
});

test('Check greedy matching prefers longest keyword at same position', () => {
  const aho = new AhoCorasick(['a', 'ab', 'abc']);
  expect(Array.from(aho.matchInText('abc'))).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'}
  ]);
});

test('Check greedy matching with overlapping patterns', () => {
  const aho = new AhoCorasick(['he', 'she', 'his', 'hers']);
  expect(Array.from(aho.matchInText('shehis'))).toStrictEqual([
    { begin: 0, end: 3, keyword: 'she'},
    { begin: 3, end: 6, keyword: 'his'}
  ]);
});

test('Check greedy matching prioritizes longer match over shorter', () => {
  const aho = new AhoCorasick(['test', 'testing', 'tes']);
  expect(Array.from(aho.matchInText('testing'))).toStrictEqual([
    { begin: 0, end: 7, keyword: 'testing'}
  ]);
});

test('Check greedy matching with multiple longest matches', () => {
  const aho = new AhoCorasick(['cat', 'dog', 'category']);
  expect(Array.from(aho.matchInText('category'))).toStrictEqual([
    { begin: 0, end: 8, keyword: 'category'}
  ]);
});

test('Check greedy matching does not overlap matches', () => {
  const aho = new AhoCorasick(['ab', 'ba', 'aba']);
  expect(Array.from(aho.matchInText('ababa'))).toStrictEqual([
    { begin: 0, end: 3, keyword: 'aba'},
    { begin: 3, end: 5, keyword: 'ba'}
  ]);
});

test('Check greedy matching with empty text', () => {
  const aho = new AhoCorasick(['test']);
  expect(Array.from(aho.matchInText(''))).toStrictEqual([]);
});

test('Check greedy matching with single character keywords', () => {
  const aho = new AhoCorasick(['a', 'b', 'c']);
  expect(Array.from(aho.matchInText('abc'))).toStrictEqual([
    { begin: 0, end: 1, keyword: 'a'},
    { begin: 1, end: 2, keyword: 'b'},
    { begin: 2, end: 3, keyword: 'c'}
  ]);
});

test('Check greedy matching with repeated characters', () => {
  const aho = new AhoCorasick(['aa', 'aaa', 'aaaa']);
  expect(Array.from(aho.matchInText('aaaaaa'))).toStrictEqual([
    { begin: 0, end: 4, keyword: 'aaaa'},
    { begin: 4, end: 6, keyword: 'aa'}
  ]);
});

test('Check greedy matching with prefix-suffix relationship', () => {
  const aho = new AhoCorasick(['abc', 'bc', 'c']);
  expect(Array.from(aho.matchInText('abc'))).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'}
  ]);
});

test('Check greedy matching with completely nested patterns', () => {
  const aho = new AhoCorasick(['x', 'xx', 'xxx', 'xxxx', 'xxxxx']);
  expect(Array.from(aho.matchInText('xxxxx'))).toStrictEqual([
    { begin: 0, end: 5, keyword: 'xxxxx'}
  ]);
});

test('Check greedy matching skips shorter match when longer available', () => {
  const aho = new AhoCorasick(['in', 'test', 'testing']);
  expect(Array.from(aho.matchInText('testing'))).toStrictEqual([
    { begin: 0, end: 7, keyword: 'testing'}
  ]);
});

test('Check greedy matching with adjacent different length matches', () => {
  const aho = new AhoCorasick(['a', 'bb', 'ccc']);
  expect(Array.from(aho.matchInText('abbccc'))).toStrictEqual([
    { begin: 0, end: 1, keyword: 'a'},
    { begin: 1, end: 3, keyword: 'bb'},
    { begin: 3, end: 6, keyword: 'ccc'}
  ]);
});

test('Check greedy matching with multibyte characters', () => {
  const aho = new AhoCorasick(['あ', 'あい', 'あいう']);
  expect(Array.from(aho.matchInText('あいう'))).toStrictEqual([
    { begin: 0, end: 3, keyword: 'あいう'}
  ]);
});

test('Check greedy matching with no matches', () => {
  const aho = new AhoCorasick(['test']);
  expect(Array.from(aho.matchInText('hello world'))).toStrictEqual([]);
});

test('Check greedy matching with same length keywords at same position', () => {
  const aho = new AhoCorasick(['cat', 'car']);
  const result = Array.from(aho.matchInText('cat'));
  expect(result.length).toBe(1);
  expect(result[0].begin).toBe(0);
  expect(result[0].end).toBe(3);
  expect(['cat', 'car']).toContain(result[0].keyword);
});

test('Check greedy chooses longest then continues non-overlapping', () => {
  const aho = new AhoCorasick(['ab', 'abc', 'cd']);
  expect(Array.from(aho.matchInText('abcd'))).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'}
  ]);
});

test('Check greedy non-overlapping with multiple matches', () => {
  const aho = new AhoCorasick(['abc', 'bcd', 'cde']);
  expect(Array.from(aho.matchInText('abcde'))).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'}
  ]);
});

test('Check greedy prefers longer over multiple shorter', () => {
  const aho = new AhoCorasick(['a', 'b', 'ab']);
  expect(Array.from(aho.matchInText('ab'))).toStrictEqual([
    { begin: 0, end: 2, keyword: 'ab'}
  ]);
});

test('Check greedy sequential non-overlapping matches', () => {
  const aho = new AhoCorasick(['abc', 'def']);
  expect(Array.from(aho.matchInText('abcdef'))).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'},
    { begin: 3, end: 6, keyword: 'def'}
  ]);
});

test('Check desire_depth logic with failure transition after match', () => {
  // 'abc'をマッチした後、'x'でfailureが発生するケース
  const aho = new AhoCorasick(['abc', 'cx']);
  expect(Array.from(aho.matchInText('abcx'))).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'},
    // 'cx'は'c'がposition 2で、'x'がposition 3だが、'abc'が0-3を消費しているので検出されない
  ]);
});

test('Check desire_depth with nested match after greedy', () => {
  // 'abcd'をマッチした後、'de'は重複するので検出されない（完全非重複）
  const aho = new AhoCorasick(['abcd', 'de']);
  expect(Array.from(aho.matchInText('abcde'))).toStrictEqual([
    { begin: 0, end: 4, keyword: 'abcd'},
    // 'de'は position 3-5 だが、position 3の'd'は既に'abcd'で使用済みなので検出されない
  ]);
});

test('Check desire_depth skips overlapping shorter keywords', () => {
  const aho = new AhoCorasick(['abc', 'bc', 'c', 'd']);
  expect(Array.from(aho.matchInText('abcd'))).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'},
    { begin: 3, end: 4, keyword: 'd'}
  ]);
});

test('Check greedy matching with multiple byte', () => {
  const aho = new AhoCorasick(['シロナ', 'ガス', 'クジラ']);
  expect(Array.from(aho.matchInText('シロナガスクジラ'))).toStrictEqual([
    { begin: 0, end: 3, keyword: 'シロナ'},
    { begin: 3, end: 5, keyword: 'ガス'},
    { begin: 5, end: 8, keyword: 'クジラ'},
  ]);
});

test('Check greedy matching with multiple byte 2', () => {
  const aho = new AhoCorasick(['シロナガ', 'クジラ']);
  expect(Array.from(aho.matchInText('シロナガスクジラ'))).toStrictEqual([
    { begin: 0, end: 4, keyword: 'シロナガ'},
    { begin: 5, end: 8, keyword: 'クジラ'},
  ]);
});

test('Check greedy matching with multiple byte 3', () => {
  const aho = new AhoCorasick(['シロナガス', 'クジラ']);
  expect(Array.from(aho.matchInText('シロナガスクジラ'))).toStrictEqual([
    { begin: 0, end: 5, keyword: 'シロナガス'},
    { begin: 5, end: 8, keyword: 'クジラ'},
  ]);
});

test('Check greedy matching with multiple byte 4', () => {
  const aho = new AhoCorasick(['シロナ', 'ナガス', 'スクジラ', 'クジラ']);
  expect(Array.from(aho.matchInText('シロナガスクジラ'))).toStrictEqual([
    { begin: 0, end: 3, keyword: 'シロナ'},
    { begin: 4, end: 8, keyword: 'スクジラ'},
  ]);
});

test('Check greedy matching with multiple byte5', () => {
  const aho = new AhoCorasick(['シロナ', 'ガス', 'クジラ', 'シロナガスクロロ']);
  expect(Array.from(aho.matchInText('シロナガスクジラ'))).toStrictEqual([
    { begin: 0, end: 3, keyword: 'シロナ'},
    { begin: 3, end: 5, keyword: 'ガス'},
    { begin: 5, end: 8, keyword: 'クジラ'},
  ]);
});

test('Check greedy matching with multiple byte6', () => {
  const aho = new AhoCorasick(['シロナ', 'ガス', 'クジラ', 'シロナガスアロロ']);
  expect(Array.from(aho.matchInText('シロナガスクジラ'))).toStrictEqual([
    { begin: 0, end: 3, keyword: 'シロナ'},
    { begin: 3, end: 5, keyword: 'ガス'},
    { begin: 5, end: 8, keyword: 'クジラ'},
  ]);
});

test('Check greedy with complex overlapping patterns', () => {
  const aho = new AhoCorasick(['bcde', 'cdef', 'defg', 'efgh', 'fehg', 'fegh', 'bcdcbcdefeghe']);
  expect(Array.from(aho.matchInText('bcdcbcdefegh'))).toStrictEqual([
    { begin: 4, end: 8, keyword: 'bcde'},
    { begin: 8, end: 12, keyword: 'fegh'},
  ]);
});

test('Check greedy fallback when longest keyword does not match', () => {
  const aho = new AhoCorasick(['abcdefgh', 'bcd', 'ef']);
  expect(Array.from(aho.matchInText('abcdefgx'))).toStrictEqual([
    { begin: 1, end: 4, keyword: 'bcd'},
    { begin: 4, end: 6, keyword: 'ef'}
  ]);
});


test('Check greedy fallback when longest keyword does not match 2', () => {
  const aho = new AhoCorasick(['abcdefghx', 'bcd', 'ef', 'ghe']);
  expect(Array.from(aho.matchInText('abcdefghe'))).toStrictEqual([
    { begin: 1, end: 4, keyword: 'bcd'},
    { begin: 4, end: 6, keyword: 'ef'},
    { begin: 6, end: 9, keyword: 'ghe'},
  ]);
});

test('Check greedy fallback when longest keyword does not match 2', () => {
  const aho = new AhoCorasick(['abcdefghx', 'bcd', 'ef', 'gh', 'ghe']);
  expect(Array.from(aho.matchInText('abcdefghe'))).toStrictEqual([
    { begin: 1, end: 4, keyword: 'bcd'},
    { begin: 4, end: 6, keyword: 'ef'},
    { begin: 6, end: 9, keyword: 'ghe'},
  ]);
});

test('Check greedy fallback with multiple length candidates', () => {
  const aho = new AhoCorasick(['abcdefgh', 'abcdef', 'abcd', 'ab']);
  // 'abcdefgx'では最長'abcdefgh'が失敗し、'abcdef'が選ばれる
  expect(Array.from(aho.matchInText('abcdefgx'))).toStrictEqual([
    { begin: 0, end: 6, keyword: 'abcdef'}
  ]);
});

test('Check greedy fallback with interleaved patterns', () => {
  const aho = new AhoCorasick(['abcxyz', 'abc', 'xyz', 'cx']);
  // 'abcxyz'が完全にマッチ
  expect(Array.from(aho.matchInText('abcxyz'))).toStrictEqual([
    { begin: 0, end: 6, keyword: 'abcxyz'}
  ]);
  // 'abcxy'では'abcxyz'が失敗し、'abc'がマッチ
  expect(Array.from(aho.matchInText('abcxy'))).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'}
  ]);
  // 'abcxabc'では'abcxyz'が失敗し、'abc'が2回マッチ
  expect(Array.from(aho.matchInText('abcxabc'))).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'},
    { begin: 4, end: 7, keyword: 'abc'}
  ]);
});

test('Check greedy fallback with suffix match after failure', () => {
  const aho = new AhoCorasick(['testing123', 'testing', 'ing', '123']);
  // 'testing456'では'testing123'が失敗し、'testing'がマッチ
  expect(Array.from(aho.matchInText('testing456'))).toStrictEqual([
    { begin: 0, end: 7, keyword: 'testing'}
  ]);
  // 'testing123'では最長がマッチ
  expect(Array.from(aho.matchInText('testing123'))).toStrictEqual([
    { begin: 0, end: 10, keyword: 'testing123'}
  ]);
});

test('Check greedy fallback cascade through multiple levels', () => {
  const aho = new AhoCorasick(['aaaaa', 'aaaa', 'aaa', 'aa', 'a']);
  // 'aaab'では'aaaaa', 'aaaa'が失敗し、'aaa'がマッチ
  expect(Array.from(aho.matchInText('aaab'))).toStrictEqual([
    { begin: 0, end: 3, keyword: 'aaa'}
  ]);
  // 'aaaaaab'では'aaaaa'が1回、残りの'a'は'b'で途切れるので'a'が1回マッチ
  expect(Array.from(aho.matchInText('aaaaaab'))).toStrictEqual([
    { begin: 0, end: 5, keyword: 'aaaaa'},
    { begin: 5, end: 6, keyword: 'a'}
  ]);
});

test('Check greedy fallback with failure link traversal', () => {
  const aho = new AhoCorasick(['abcabc', 'abc', 'cab', 'bc']);
  // 'abcabx'では'abcabc'が失敗し、'abc'がマッチ
  expect(Array.from(aho.matchInText('abcabx'))).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'}
  ]);
  // 'abcabc'では最長がマッチ
  expect(Array.from(aho.matchInText('abcabc'))).toStrictEqual([
    { begin: 0, end: 6, keyword: 'abcabc'}
  ]);
});

test('Check surrogate pairs (emoji) matching', () => {
  // サロゲートペア（絵文字）のテスト - begin/endはUTF-16コードユニット単位
  const aho = new AhoCorasick(['👍', '🎉', '❤️']);
  expect(Array.from(aho.matchInText('Hello👍World🎉Test❤️'))).toStrictEqual([
    { begin: 5, end: 7, keyword: '👍'},    // UTF-16: 'Hello'=5, '👍'=2 units
    { begin: 12, end: 14, keyword: '🎉'},  // UTF-16: +5('World')=12
    { begin: 18, end: 20, keyword: '❤️'},  // UTF-16: +4('Test')=18
  ]);
});

test('Check surrogate pairs with overlapping patterns', () => {
  const aho = new AhoCorasick(['👨', '👨‍👩‍👧', '👩']);
  // '👨‍👩‍👧'は複合絵文字（家族）で、ZWJ（Zero Width Joiner）を含む
  // UTF-16で8コードユニット（👨=2, ZWJ=1, 👩=2, ZWJ=1, 👧=2）
  expect(Array.from(aho.matchInText('👨‍👩‍👧'))).toStrictEqual([
    { begin: 0, end: 8, keyword: '👨‍👩‍👧'}
  ]);
});

test('Check surrogate pairs mixed with ASCII', () => {
  const aho = new AhoCorasick(['test', '🚀', 'hello']);
  expect(Array.from(aho.matchInText('test🚀hello'))).toStrictEqual([
    { begin: 0, end: 4, keyword: 'test'},
    { begin: 4, end: 6, keyword: '🚀'},
    { begin: 6, end: 11, keyword: 'hello'}
  ]);
});

test('Check surrogate pairs with repeated emoji', () => {
  const aho = new AhoCorasick(['😀', '😀😀', '😀😀😀']);
  expect(Array.from(aho.matchInText('😀😀😀'))).toStrictEqual([
    { begin: 0, end: 6, keyword: '😀😀😀'}
  ]);
});

test('Check surrogate pairs in Japanese text', () => {
  const aho = new AhoCorasick(['🍣', '寿司', '🍜']);
  expect(Array.from(aho.matchInText('今日は🍣寿司を食べました🍜'))).toStrictEqual([
    { begin: 3, end: 5, keyword: '🍣'},
    { begin: 5, end: 7, keyword: '寿司'},
    { begin: 13, end: 15, keyword: '🍜'}
  ]);
});

test('check failure selection algorithm', () => {
  const aho = new AhoCorasick(['dcbacbax', 'ba', 'cba', 'dc', 'cb', 'a']);
  expect(Array.from(aho.matchInText('dcbacba'))).toStrictEqual([
    { begin: 0, end: 2, keyword: 'dc'},
    { begin: 2, end: 4, keyword: 'ba'},
    { begin: 4, end: 7, keyword: 'cba'},
  ]);
});

test('Check duplicate keywords', () => {
  const aho = new AhoCorasick(['test', 'test', 'abc', 'test']);
  expect(Array.from(aho.matchInText('testabc'))).toStrictEqual([
    { begin: 0, end: 4, keyword: 'test'},
    { begin: 4, end: 7, keyword: 'abc'}
  ]);
});

test('Check very long keyword matching', () => {
  const longKeyword = 'a'.repeat(1000);
  const aho = new AhoCorasick([longKeyword, 'a'.repeat(500)]);
  expect(Array.from(aho.matchInText(longKeyword))).toStrictEqual([
    { begin: 0, end: 1000, keyword: longKeyword}
  ]);
});

test('Check deep failure link traversal', () => {
  const aho = new AhoCorasick(['aaaaaab', 'aaaaab', 'aaaab', 'aaab', 'aab', 'ab', 'b']);
  expect(Array.from(aho.matchInText('aaaaaaab'))).toStrictEqual([
    { begin: 1, end: 8, keyword: 'aaaaaab'},
  ]);
});

test('Check greedy with complex failure transitions', () => {
  const aho = new AhoCorasick(['ababc', 'abc', 'bab', 'bc', 'c']);
  expect(Array.from(aho.matchInText('ababacbc'))).toStrictEqual([
    { begin: 1, end: 4, keyword: 'bab'},
    { begin: 5, end: 6, keyword: 'c'},
    { begin: 6, end: 8, keyword: 'bc'},
  ]);
});

test('Check greedy with all keywords being prefixes', () => {
  const aho = new AhoCorasick(['a', 'ab', 'abc', 'abcd', 'abcde']);
  expect(Array.from(aho.matchInText('abcde'))).toStrictEqual([
    { begin: 0, end: 5, keyword: 'abcde'}
  ]);
  expect(Array.from(aho.matchInText('abcdeabc'))).toStrictEqual([
    { begin: 0, end: 5, keyword: 'abcde'},
    { begin: 5, end: 8, keyword: 'abc'}
  ]);
});

test('Check Unicode combining characters', () => {
  const aho = new AhoCorasick(['café', 'cafe']);
  expect(Array.from(aho.matchInText('café'))).toStrictEqual([
    { begin: 0, end: 4, keyword: 'café'}
  ]);
});

test('Check greedy with alternating patterns', () => {
  const aho = new AhoCorasick(['aba', 'bab', 'a', 'b']);
  expect(Array.from(aho.matchInText('abababa'))).toStrictEqual([
    { begin: 0, end: 3, keyword: 'aba'},
    { begin: 3, end: 6, keyword: 'bab'},
    { begin: 6, end: 7, keyword: 'a'}
  ]);
});

test('Check greedy with keywords that are rotations', () => {
  const aho = new AhoCorasick(['abc', 'bca', 'cab']);
  expect(Array.from(aho.matchInText('abcabc'))).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'},
    { begin: 3, end: 6, keyword: 'abc'}
  ]);
  expect(Array.from(aho.matchInText('abcbca'))).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'},
    { begin: 3, end: 6, keyword: 'bca'}
  ]);
});

test('Check greedy with keywords containing each other non-prefix', () => {
  const aho = new AhoCorasick(['xabcy', 'abc', 'bcd', 'y']);
  expect(Array.from(aho.matchInText('xabcy'))).toStrictEqual([
    { begin: 0, end: 5, keyword: 'xabcy'}
  ]);
  expect(Array.from(aho.matchInText('abcbcd'))).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'},
    { begin: 3, end: 6, keyword: 'bcd'}
  ]);
});

test('Check whitespace and special characters', () => {
  const aho = new AhoCorasick(['hello world', ' ', 'world']);
  expect(Array.from(aho.matchInText('hello world'))).toStrictEqual([
    { begin: 0, end: 11, keyword: 'hello world'}
  ]);
});
