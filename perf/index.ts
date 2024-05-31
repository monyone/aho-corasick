import { Chance } from 'chance';
import { AhoCorasick as AhoCorasickMonyone } from '../src';
import { Trie as AhoCorasickTanishiking } from "@tanishiking/aho-corasick";
import AhoCorasickBrunorb from 'ahocorasick';
import AhoCorasickSonofmagic from 'modern-ahocorasick'
import { TyniSearch as AhoCorasickPrrada } from 'tynisearch'
import { WordMatcher as AhoCorasickMichaelhan } from 'word-match-helper'
import { findAllMatchSync as AhoCorasickFz6n } from 'hoshino'

const generate = (wordCount: number, sentenceCount: number): [string[], string] => {
  const chance = new Chance();
  const words = chance.unique(chance.word, wordCount);
  const sentence = chance.sentence({ words: sentenceCount });
  return [words, sentence];
}
const [keywords, text] = generate(10000, 1000000);

// @monyone/aho-corasick
{
  const name = '@monyone/aho-corasick'

  const prepare_begin = performance.now();
  const aho = new AhoCorasickMonyone(keywords);
  const prepare_end = performance.now();
  console.log(`${name}'s build: ${(prepare_end - prepare_begin) / 1000}`)

  const execution_begin = performance.now();
  const result = aho.matchInText(text);
  const execution_end = performance.now();
  console.log(`${name}'s execution: ${(execution_end - execution_begin) / 1000}`)
  console.log(`${name}'s result count: ${result.length}`)
  console.log();
}

// @tanishiking/aho-corasick
{
  const name = '@tanishiking/aho-corasick'

  const prepare_begin = performance.now();
  const aho = new AhoCorasickTanishiking(keywords);
  const prepare_end = performance.now();
  console.log(`${name}'s build: ${(prepare_end - prepare_begin) / 1000}`)

  const execution_begin = performance.now();
  const result = aho.parseText(text);
  const execution_end = performance.now();
  console.log(`${name}'s execution: ${(execution_end - execution_begin) / 1000}`)
  console.log(`${name}'s result count: ${result.length}`)
  console.log();
}

// ahocorasic
{
  const name = 'ahocorasick'

  const prepare_begin = performance.now();
  const aho = new AhoCorasickBrunorb(keywords);
  const prepare_end = performance.now();
  console.log(`${name}'s build: ${(prepare_end - prepare_begin) / 1000}`)

  const execution_begin = performance.now();
  const result = aho.search(text);
  const execution_end = performance.now();
  console.log(`${name}'s execution: ${(execution_end - execution_begin) / 1000}`)
  console.log(`${name}'s result count: ${result.length}`)
  console.log();
}

// modern-ahocorasic (almost ahocorasic)
{
  const name = 'modern-ahocorasick'

  const prepare_begin = performance.now();
  const aho = new AhoCorasickSonofmagic(keywords);
  const prepare_end = performance.now();
  console.log(`${name}'s build: ${(prepare_end - prepare_begin) / 1000}`)

  const execution_begin = performance.now();
  const result = aho.search(text);
  const execution_end = performance.now();
  console.log(`${name}'s execution: ${(execution_end - execution_begin) / 1000}`)
  console.log(`${name}'s result count: ${result.length}`)
  console.log();
}

// tynisearch
{
  const name = 'tynisearch'

  const prepare_begin = performance.now();
  const aho = new AhoCorasickPrrada();
  aho.insert(keywords);
  const prepare_end = performance.now();
  console.log(`${name}'s build: ${(prepare_end - prepare_begin) / 1000}`)

  const execution_begin = performance.now();
  const result = aho.searchInSentence(text);
  const execution_end = performance.now();
  console.log(`${name}'s execution: ${(execution_end - execution_begin) / 1000}`)
  console.log(`${name}'s result count: ${result.length}`)
  console.log();
}

// lazy-acho-corasick
{
  const name = 'word-match-helper'

  const prepare_begin = performance.now();
  const aho = new AhoCorasickMichaelhan({ targets: keywords });
  const prepare_end = performance.now();
  console.log(`${name}'s build: ${(prepare_end - prepare_begin) / 1000}`)

  const execution_begin = performance.now();
  const result = aho.search(text);
  const execution_end = performance.now();
  console.log(`${name}'s execution: ${(execution_end - execution_begin) / 1000}`)
  console.log(`${name}'s result count: ${result.length}`)
  console.log();
}

// hoshino
{
  const name = 'hoshino'

  const execution_begin = performance.now();
  const result = AhoCorasickFz6n({ patterns: keywords, haystack: text });
  const execution_end = performance.now();
  console.log(`${name}'s execution: ${(execution_end - execution_begin) / 1000}`)
  console.log(`${name}'s result count: ${result.length}`)
  console.log();
}



