import { AhoCorasick } from '../../src'

test("Check prefix contain in hasKeywordInText", () => {
  const input = ['abc', 'bde'];
  const target = 'abce';

  const aho = new AhoCorasick(input);

  expect(aho.hasKeywordInText(target)).toBe(true);
});

test("Check suffix contain in hasKeywordInText", () => {
  const input = ['aac', 'bde'];
  const target = 'abde';

  const aho = new AhoCorasick(input);

  expect(aho.hasKeywordInText(target)).toBe(true);
});

test("Check center contain in hasKeywordInText", () => {
  const input = ['abc', 'bde'];
  const target = 'abdec';

  const aho = new AhoCorasick(input);

  expect(aho.hasKeywordInText(target)).toBe(true);
});

test("Check multiple contain in hasKeywordInText", () => {
  const input = ['aaa', 'bbb'];
  const target = 'aabbbbbaaaaaa';

  const aho = new AhoCorasick(input);

  expect(aho.hasKeywordInText(target)).toBe(true);
});

test("Check redundance contain in hasKeywordInText", () => {
  const input = ['aaa', 'aa', 'b'];
  const target = 'aabbbbbaa';

  const aho = new AhoCorasick(input);

  expect(aho.hasKeywordInText(target)).toBe(true);
});

test('Check failure link in hasKeywordInText', () => {
  const input = ['abc', 'bde'];
  const target = 'abde';

  const aho = new AhoCorasick(input);

  // abde is ab -(failure Link)-> bc ->
  expect(aho.hasKeywordInText(target)).toBe(true);
});
