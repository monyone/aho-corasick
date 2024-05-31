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
