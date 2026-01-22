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

test('Check add and delete combination - deep failure link chain', () => {
  // Create a deep failure link chain scenario
  const aho = new DynamicAhoCorasick(['aaaa', 'aaa', 'aa', 'a']);
  expect(aho.matchInText('aaaaa')).toStrictEqual([
    { begin: 0, end: 1, keyword: 'a'},
    { begin: 0, end: 2, keyword: 'aa'},
    { begin: 1, end: 2, keyword: 'a'},
    { begin: 0, end: 3, keyword: 'aaa'},
    { begin: 1, end: 3, keyword: 'aa'},
    { begin: 2, end: 3, keyword: 'a'},
    { begin: 0, end: 4, keyword: 'aaaa'},
    { begin: 1, end: 4, keyword: 'aaa'},
    { begin: 2, end: 4, keyword: 'aa'},
    { begin: 3, end: 4, keyword: 'a'},
    { begin: 1, end: 5, keyword: 'aaaa'},
    { begin: 2, end: 5, keyword: 'aaa'},
    { begin: 3, end: 5, keyword: 'aa'},
    { begin: 4, end: 5, keyword: 'a'}
  ]);

  // Add longer pattern
  aho.add('aaaaa');
  expect(aho.matchInText('aaaaa')).toStrictEqual([
    { begin: 0, end: 1, keyword: 'a'},
    { begin: 0, end: 2, keyword: 'aa'},
    { begin: 1, end: 2, keyword: 'a'},
    { begin: 0, end: 3, keyword: 'aaa'},
    { begin: 1, end: 3, keyword: 'aa'},
    { begin: 2, end: 3, keyword: 'a'},
    { begin: 0, end: 4, keyword: 'aaaa'},
    { begin: 1, end: 4, keyword: 'aaa'},
    { begin: 2, end: 4, keyword: 'aa'},
    { begin: 3, end: 4, keyword: 'a'},
    { begin: 0, end: 5, keyword: 'aaaaa'},
    { begin: 1, end: 5, keyword: 'aaaa'},
    { begin: 2, end: 5, keyword: 'aaa'},
    { begin: 3, end: 5, keyword: 'aa'},
    { begin: 4, end: 5, keyword: 'a'}
  ]);

  // Delete from middle of chain
  aho.delete('aa');
  expect(aho.matchInText('aaaaa')).toStrictEqual([
    { begin: 0, end: 1, keyword: 'a'},
    { begin: 1, end: 2, keyword: 'a'},
    { begin: 0, end: 3, keyword: 'aaa'},
    { begin: 2, end: 3, keyword: 'a'},
    { begin: 0, end: 4, keyword: 'aaaa'},
    { begin: 1, end: 4, keyword: 'aaa'},
    { begin: 3, end: 4, keyword: 'a'},
    { begin: 0, end: 5, keyword: 'aaaaa'},
    { begin: 1, end: 5, keyword: 'aaaa'},
    { begin: 2, end: 5, keyword: 'aaa'},
    { begin: 4, end: 5, keyword: 'a'}
  ]);

  // Delete longest pattern
  aho.delete('aaaaa');
  expect(aho.matchInText('aaaaa')).toStrictEqual([
    { begin: 0, end: 1, keyword: 'a'},
    { begin: 1, end: 2, keyword: 'a'},
    { begin: 0, end: 3, keyword: 'aaa'},
    { begin: 2, end: 3, keyword: 'a'},
    { begin: 0, end: 4, keyword: 'aaaa'},
    { begin: 1, end: 4, keyword: 'aaa'},
    { begin: 3, end: 4, keyword: 'a'},
    { begin: 1, end: 5, keyword: 'aaaa'},
    { begin: 2, end: 5, keyword: 'aaa'},
    { begin: 4, end: 5, keyword: 'a'}
  ]);
});

test('Check add and delete combination - interleaved patterns', () => {
  // Patterns that interleave in complex ways
  const aho = new DynamicAhoCorasick(['abab', 'baba', 'ab', 'ba']);
  expect(aho.matchInText('abababa')).toStrictEqual([
    { begin: 0, end: 2, keyword: 'ab'},
    { begin: 1, end: 3, keyword: 'ba'},
    { begin: 0, end: 4, keyword: 'abab'},
    { begin: 2, end: 4, keyword: 'ab'},
    { begin: 1, end: 5, keyword: 'baba'},
    { begin: 3, end: 5, keyword: 'ba'},
    { begin: 2, end: 6, keyword: 'abab'},
    { begin: 4, end: 6, keyword: 'ab'},
    { begin: 3, end: 7, keyword: 'baba'},
    { begin: 5, end: 7, keyword: 'ba'},
  ]);

  // Add even longer pattern
  aho.add('ababab');
  expect(aho.matchInText('abababa')).toStrictEqual([
    { begin: 0, end: 2, keyword: 'ab'},
    { begin: 1, end: 3, keyword: 'ba'},
    { begin: 0, end: 4, keyword: 'abab'},
    { begin: 2, end: 4, keyword: 'ab'},
    { begin: 1, end: 5, keyword: 'baba'},
    { begin: 3, end: 5, keyword: 'ba'},
    { begin: 0, end: 6, keyword: 'ababab'},
    { begin: 2, end: 6, keyword: 'abab'},
    { begin: 4, end: 6, keyword: 'ab'},
    { begin: 3, end: 7, keyword: 'baba'},
    { begin: 5, end: 7, keyword: 'ba'}
  ]);

  // Delete base patterns
  aho.delete('ab');
  aho.delete('ba');
  expect(aho.matchInText('abababa')).toStrictEqual([
    { begin: 0, end: 4, keyword: 'abab'},
    { begin: 1, end: 5, keyword: 'baba'},
    { begin: 0, end: 6, keyword: 'ababab'},
    { begin: 2, end: 6, keyword: 'abab'},
    { begin: 3, end: 7, keyword: 'baba'}
  ]);
});

test('Check add and delete combination - multiple disjoint trie branches', () => {
  // Multiple separate trie branches
  const aho = new DynamicAhoCorasick(['apple', 'application', 'orange', 'banana']);
  expect(aho.matchInText('apple orange banana application')).toStrictEqual([
    { begin: 0, end: 5, keyword: 'apple'},
    { begin: 6, end: 12, keyword: 'orange'},
    { begin: 13, end: 19, keyword: 'banana'},
    { begin: 20, end: 31, keyword: 'application'}
  ]);

  // Add patterns that create new branches
  aho.add('app');
  aho.add('ban');
  aho.add('rang');
  expect(aho.matchInText('apple orange banana application')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'app'},
    { begin: 0, end: 5, keyword: 'apple'},
    { begin: 7, end: 11, keyword: 'rang'},
    { begin: 6, end: 12, keyword: 'orange'},
    { begin: 13, end: 16, keyword: 'ban'},
    { begin: 13, end: 19, keyword: 'banana'},
    { begin: 20, end: 23, keyword: 'app'},
    { begin: 20, end: 31, keyword: 'application'}
  ]);

  // Delete from different branches
  aho.delete('orange');
  aho.delete('banana');
  expect(aho.matchInText('apple orange banana application')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'app'},
    { begin: 0, end: 5, keyword: 'apple'},
    { begin: 7, end: 11, keyword: 'rang'},
    { begin: 13, end: 16, keyword: 'ban'},
    { begin: 20, end: 23, keyword: 'app'},
    { begin: 20, end: 31, keyword: 'application'}
  ]);

  // Add patterns back with different structure
  aho.add('range');
  aho.add('anana');
  expect(aho.matchInText('apple orange banana application')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'app'},
    { begin: 0, end: 5, keyword: 'apple'},
    { begin: 7, end: 11, keyword: 'rang'},
    { begin: 7, end: 12, keyword: 'range'},
    { begin: 13, end: 16, keyword: 'ban'},
    { begin: 14, end: 19, keyword: 'anana'},
    { begin: 20, end: 23, keyword: 'app'},
    { begin: 20, end: 31, keyword: 'application'}
  ]);
});

test('Check add and delete combination - stress test with many operations', () => {
  const aho = new DynamicAhoCorasick([]);

  // Build up gradually
  const words = ['the', 'then', 'there', 'these', 'this', 'that', 'those', 'them', 'their'];
  for (const word of words) {
    aho.add(word);
  }

  expect(aho.matchInText('these are their things that they use there')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'the'},
    { begin: 0, end: 5, keyword: 'these'},
    { begin: 10, end: 13, keyword: 'the'},
    { begin: 10, end: 15, keyword: 'their'},
    { begin: 23, end: 27, keyword: 'that'},
    { begin: 28, end: 31, keyword: 'the'},
    { begin: 37, end: 40, keyword: 'the'},
    { begin: 37, end: 42, keyword: 'there'},
  ]);

  // Remove some patterns
  aho.delete('these');
  aho.delete('their');
  aho.delete('that');

  expect(aho.matchInText('these are their things that they use there')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'the'},
    { begin: 10, end: 13, keyword: 'the'},
    { begin: 28, end: 31, keyword: 'the'},
    { begin: 37, end: 40, keyword: 'the'},
    { begin: 37, end: 42, keyword: 'there'},
  ]);

  // Add new patterns
  aho.add('are');
  aho.add('use');
  aho.add('they');

  expect(aho.matchInText('these are their things that they use there')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'the'},
    { begin: 6, end: 9, keyword: 'are'},
    { begin: 10, end: 13, keyword: 'the'},
    { begin: 28, end: 31, keyword: 'the'},
    { begin: 28, end: 32, keyword: 'they'},
    { begin: 33, end: 36, keyword: 'use'},
    { begin: 37, end: 40, keyword: 'the'},
    { begin: 37, end: 42, keyword: 'there'},
  ]);

  // Massive delete and re-add
  for (const word of ['the', 'then', 'there', 'this', 'those', 'them']) {
    aho.delete(word);
  }

  expect(aho.matchInText('these are their things that they use there')).toStrictEqual([
    { begin: 6, end: 9, keyword: 'are'},
    { begin: 28, end: 32, keyword: 'they'},
    { begin: 33, end: 36, keyword: 'use'}
  ]);

  // Re-add in different order
  aho.add('there');
  aho.add('the');
  aho.add('this');

  expect(aho.matchInText('these are their things that they use there')).toStrictEqual([
    { begin: 0, end: 3, keyword: 'the'},
    { begin: 6, end: 9, keyword: 'are'},
    { begin: 10, end: 13, keyword: 'the'},
    { begin: 28, end: 31, keyword: 'the'},
    { begin: 28, end: 32, keyword: 'they'},
    { begin: 33, end: 36, keyword: 'use'},
    { begin: 37, end: 40, keyword: 'the'},
    { begin: 37, end: 42, keyword: 'there'},

  ]);
});
