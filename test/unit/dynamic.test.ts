import { DynamicAhoCorasick } from '../../src'

test("Check prefix contain in matchInText", () => {
  const aho = new DynamicAhoCorasick(['abc', 'bde']);
  expect(aho.matchInText('abce')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'}
  ]);
});

test("Check suffix contain in matchInText", () => {
  const aho = new DynamicAhoCorasick(['aac', 'bde']);
  expect(aho.matchInText('abde')).toStrictEqual([
    { begin: 1, end: 4, keyword: 'bde'}
  ]);
});

test("Check center contain in matchInText", () => {
  const aho = new DynamicAhoCorasick(['aac', 'bde']);
  expect(aho.matchInText('abdec')).toStrictEqual([
    { begin: 1, end: 4, keyword: 'bde'}
  ]);
});

test("Check multiple contain in matchInText", () => {
  const aho = new DynamicAhoCorasick(['aaa', 'bbb']);
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
  const aho = new DynamicAhoCorasick(['aaa', 'aa', 'a']);
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
  const aho = new DynamicAhoCorasick(['abc', 'bde']);
  // abde is ab -(failure Link)-> bc ->
  expect(aho.matchInText('abde')).toStrictEqual([
    { begin: 1, end: 4, keyword: 'bde'}
  ]);
});

test('Check surrogate pairs (emoji) matching', () => {
  // サロゲートペア（絵文字）のテスト - begin/endはUTF-16コードユニット単位
  const aho = new DynamicAhoCorasick(['👍', '🎉', '❤️']);
  expect(aho.matchInText('Hello👍World🎉Test❤️')).toStrictEqual([
    { begin: 5, end: 7, keyword: '👍'},    // UTF-16: 'Hello'=5, '👍'=2 units
    { begin: 12, end: 14, keyword: '🎉'},  // UTF-16: +5('World')=12
    { begin: 18, end: 20, keyword: '❤️'},  // UTF-16: +4('Test')=18
  ]);
});

test('Check surrogate pairs with overlapping patterns', () => {
  const aho = new DynamicAhoCorasick(['👨', '👨‍👩‍👧', '👩']);
  // '👨‍👩‍👧'は複合絵文字（家族）で、ZWJ（Zero Width Joiner）を含む
  // UTF-16で8コードユニット（👨=2, ZWJ=1, 👩=2, ZWJ=1, 👧=2）
  expect(aho.matchInText('👨‍👩‍👧')).toStrictEqual([
    { begin: 0, end: 2, keyword: '👨'},
    { begin: 3, end: 5, keyword: '👩'},
    { begin: 0, end: 8, keyword: '👨‍👩‍👧'}
  ]);
});

test('Check surrogate pairs mixed with ASCII', () => {
  const aho = new DynamicAhoCorasick(['test', '🚀', 'hello']);
  expect(aho.matchInText('test🚀hello')).toStrictEqual([
    { begin: 0, end: 4, keyword: 'test'},
    { begin: 4, end: 6, keyword: '🚀'},
    { begin: 6, end: 11, keyword: 'hello'}
  ]);
});

test('Check surrogate pairs with repeated emoji', () => {
  const aho = new DynamicAhoCorasick(['😀', '😀😀', '😀😀😀']);
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
  const aho = new DynamicAhoCorasick(['🍣', '寿司', '🍜']);
  expect(aho.matchInText('今日は🍣寿司を食べました🍜')).toStrictEqual([
    { begin: 3, end: 5, keyword: '🍣'},
    { begin: 5, end: 7, keyword: '寿司'},
    { begin: 13, end: 15, keyword: '🍜'}
  ]);
});

test('Check add and delete combination - basic', () => {
  const aho = new DynamicAhoCorasick(['abc', 'bcd']);
  expect(aho.matchInText('abcde')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'},
    { begin: 1, end: 4, keyword: 'bcd'}
  ]);

  // Add new keyword
  aho.add('cde');
  expect(aho.matchInText('abcde')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'},
    { begin: 1, end: 4, keyword: 'bcd'},
    { begin: 2, end: 5, keyword: 'cde'}
  ]);

  // Delete existing keyword
  aho.delete('bcd');
  expect(aho.matchInText('abcde')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'},
    { begin: 2, end: 5, keyword: 'cde'}
  ]);
});

test('Check add and delete combination - overlapping patterns', () => {
  const aho = new DynamicAhoCorasick(['a', 'aa']);
  expect(aho.matchInText('aaa')).toStrictEqual([
    { begin: 0, end: 1, keyword: 'a'},
    { begin: 0, end: 2, keyword: 'aa'},
    { begin: 1, end: 2, keyword: 'a'},
    { begin: 1, end: 3, keyword: 'aa'},
    { begin: 2, end: 3, keyword: 'a'}
  ]);

  // Add longer pattern
  aho.add('aaa');
  expect(aho.matchInText('aaa')).toStrictEqual([
    { begin: 0, end: 1, keyword: 'a'},
    { begin: 0, end: 2, keyword: 'aa'},
    { begin: 1, end: 2, keyword: 'a'},
    { begin: 0, end: 3, keyword: 'aaa'},
    { begin: 1, end: 3, keyword: 'aa'},
    { begin: 2, end: 3, keyword: 'a'}
  ]);

  // Delete middle pattern
  aho.delete('aa');
  expect(aho.matchInText('aaa')).toStrictEqual([
    { begin: 0, end: 1, keyword: 'a'},
    { begin: 1, end: 2, keyword: 'a'},
    { begin: 0, end: 3, keyword: 'aaa'},
    { begin: 2, end: 3, keyword: 'a'}
  ]);

  // Delete all and re-add
  aho.delete('a');
  aho.delete('aaa');
  expect(aho.matchInText('aaa')).toStrictEqual([]);

  aho.add('aa');
  expect(aho.matchInText('aaa')).toStrictEqual([
    { begin: 0, end: 2, keyword: 'aa'},
    { begin: 1, end: 3, keyword: 'aa'}
  ]);
});

test('Check add and delete combination - failure link reconstruction', () => {
  const aho = new DynamicAhoCorasick(['he', 'she', 'his', 'hers']);
  expect(aho.matchInText('shershis')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'she'},
    { begin: 1, end: 3, keyword: 'he'},
    { begin: 1, end: 5, keyword: 'hers'},
    { begin: 5, end: 8, keyword: 'his'}
  ]);

  // Add pattern that shares prefix
  aho.add('her');
  expect(aho.matchInText('shershis')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'she'},
    { begin: 1, end: 3, keyword: 'he'},
    { begin: 1, end: 4, keyword: 'her'},
    { begin: 1, end: 5, keyword: 'hers'},
    { begin: 5, end: 8, keyword: 'his'}
  ]);

  // Delete pattern
  aho.delete('she');
  expect(aho.matchInText('shershis')).toStrictEqual([
    { begin: 1, end: 3, keyword: 'he'},
    { begin: 1, end: 4, keyword: 'her'},
    { begin: 1, end: 5, keyword: 'hers'},
    { begin: 5, end: 8, keyword: 'his'}
  ]);

  // Add and delete multiple times
  aho.add('sh');
  aho.delete('he');
  expect(aho.matchInText('shershis')).toStrictEqual([
    { begin: 0, end: 2, keyword: 'sh'},
    { begin: 1, end: 4, keyword: 'her'},
    { begin: 1, end: 5, keyword: 'hers'},
    { begin: 4, end: 6, keyword: 'sh'},
    { begin: 5, end: 8, keyword: 'his'}
  ]);
});

test('Check add and delete combination - empty state transitions', () => {
  const aho = new DynamicAhoCorasick([]);
  expect(aho.matchInText('test')).toStrictEqual([]);

  // Add keywords one by one
  aho.add('test');
  expect(aho.matchInText('test')).toStrictEqual([
    { begin: 0, end: 4, keyword: 'test'}
  ]);

  aho.add('est');
  expect(aho.matchInText('test')).toStrictEqual([
    { begin: 0, end: 4, keyword: 'test'},
    { begin: 1, end: 4, keyword: 'est'}
  ]);

  // Delete and verify
  aho.delete('test');
  expect(aho.matchInText('test')).toStrictEqual([
    { begin: 1, end: 4, keyword: 'est'}
  ]);

  // Back to empty
  aho.delete('est');
  expect(aho.matchInText('test')).toStrictEqual([]);

  // Re-add different patterns
  aho.add('es');
  aho.add('st');
  expect(aho.matchInText('test')).toStrictEqual([
    { begin: 1, end: 3, keyword: 'es'},
    { begin: 2, end: 4, keyword: 'st'}
  ]);
});

test('Check add and delete combination - complex scenario', () => {
  const aho = new DynamicAhoCorasick(['abc', 'bc', 'c']);

  // Initial state
  expect(aho.matchInText('abcabc')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'abc'},
    { begin: 1, end: 3, keyword: 'bc'},
    { begin: 2, end: 3, keyword: 'c'},
    { begin: 3, end: 6, keyword: 'abc'},
    { begin: 4, end: 6, keyword: 'bc'},
    { begin: 5, end: 6, keyword: 'c'}
  ]);

  // Add more patterns
  aho.add('ab');
  aho.add('bca');
  expect(aho.matchInText('abcabc')).toStrictEqual([
    { begin: 0, end: 2, keyword: 'ab'},
    { begin: 0, end: 3, keyword: 'abc'},
    { begin: 1, end: 3, keyword: 'bc'},
    { begin: 2, end: 3, keyword: 'c'},
    { begin: 1, end: 4, keyword: 'bca'},
    { begin: 3, end: 5, keyword: 'ab'},
    { begin: 3, end: 6, keyword: 'abc'},
    { begin: 4, end: 6, keyword: 'bc'},
    { begin: 5, end: 6, keyword: 'c'}
  ]);

  // Delete some patterns
  aho.delete('abc');
  aho.delete('c');
  expect(aho.matchInText('abcabc')).toStrictEqual([
    { begin: 0, end: 2, keyword: 'ab'},
    { begin: 1, end: 3, keyword: 'bc'},
    { begin: 1, end: 4, keyword: 'bca'},
    { begin: 3, end: 5, keyword: 'ab'},
    { begin: 4, end: 6, keyword: 'bc'}
  ]);

  // Re-add one of deleted patterns
  aho.add('abc');
  expect(aho.matchInText('abcabc')).toStrictEqual([
    { begin: 0, end: 2, keyword: 'ab'},
    { begin: 1, end: 3, keyword: 'bc'},
    { begin: 0, end: 3, keyword: 'abc'},
    { begin: 1, end: 4, keyword: 'bca'},
    { begin: 3, end: 5, keyword: 'ab'},
    { begin: 4, end: 6, keyword: 'bc'},
    { begin: 3, end: 6, keyword: 'abc'},
  ]);
});
