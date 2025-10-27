import { AhoCorasick } from '../../src/greedy'

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
