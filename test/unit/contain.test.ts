import { AhoCorasick } from '../../src'

test("Check prefix contain in hasKeywordInText", () => {
  const aho = new AhoCorasick(['abc', 'bde']);
  expect(aho.hasKeywordInText('abce')).toBe(true);
});

test("Check suffix contain in hasKeywordInText", () => {
  const aho = new AhoCorasick(['aac', 'bde']);
  expect(aho.hasKeywordInText('abde')).toBe(true);
});

test("Check center contain in hasKeywordInText", () => {
  const aho = new AhoCorasick(['aac', 'bde']);
  expect(aho.hasKeywordInText('abdec')).toBe(true);
});

test("Check multiple contain in hasKeywordInText", () => {
  const aho = new AhoCorasick(['aaa', 'bbb']);
  expect(aho.hasKeywordInText('aabbbbbaaaaaa')).toBe(true);
});

test("Check redundance contain in hasKeywordInText", () => {
  const aho = new AhoCorasick(['aaa', 'aa', 'a']);
  expect(aho.hasKeywordInText('aabbbbbaa')).toBe(true);
});

test('Check failure link in hasKeywordInText', () => {
  const aho = new AhoCorasick(['abc', 'bde']);
  // abde is ab -(failure Link)-> bc ->
  expect(aho.hasKeywordInText('abde')).toBe(true);
});
