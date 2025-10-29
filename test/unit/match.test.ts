import { AhoCorasick } from '../../src'

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
    { begin: 3, end: 6, keyword: 'bbb'},
    { begin: 4, end: 7, keyword: 'bbb'},
    { begin: 7, end: 10, keyword: 'aaa'},
    { begin: 8, end: 11, keyword: 'aaa'},
    { begin: 9, end: 12, keyword: 'aaa'},
    { begin: 10, end: 13, keyword: 'aaa'}
  ]);
});

test("Check redundance contain in matchInText", () => {
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

test('Check failure link in matchInText', () => {
  const aho = new AhoCorasick(['abc', 'bde']);
  // abde is ab -(failure Link)-> bc ->
  expect(aho.matchInText('abde')).toStrictEqual([
    { begin: 1, end: 4, keyword: 'bde'}
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
    { begin: 0, end: 2, keyword: '👨'},
    { begin: 3, end: 5, keyword: '👩'},
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
    { begin: 0, end: 2, keyword: '😀'},
    { begin: 0, end: 4, keyword: '😀😀'},
    { begin: 2, end: 4, keyword: '😀'},
    { begin: 0, end: 6, keyword: '😀😀😀'},
    { begin: 2, end: 6, keyword: '😀😀'},
    { begin: 4, end: 6, keyword: '😀'}
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
