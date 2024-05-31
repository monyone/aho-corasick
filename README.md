# aho-corasick

Simple Aho-Corasick algorhythm implementaiton for TypeScript. (almost 100 lines)

## Getting Started

### Keyword Detection

```ts
import { AhoCorasick } from '@monyone/aho-corasick';

const ahocorasick = new AhoCorasick(keywords);
const hasAnyKeyword: boolean = aho.hasKeywordInText(text);
```

### Keyword Matching

```ts
import { AhoCorasick } from '@monyone/aho-corasick';

const ahocorasick = new AhoCorasick(keywords);
const match: { begin: number, end: number, keyword: string}[] = aho.matchInText(text);
```
