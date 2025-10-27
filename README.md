# aho-corasick

Simple Aho-Corasick algorhythm implementaiton for TypeScript.

## Getting Started

```sh
npm i @monyone/aho-corasick
```

### Keyword Detection

```ts
import { AhoCorasick } from '@monyone/aho-corasick';

const ahocorasick = new AhoCorasick(keywords);
const hasAnyKeyword: boolean = ahocorasick.hasKeywordInText(text);
```

### Keyword Matching

```ts
import { AhoCorasick } from '@monyone/aho-corasick';

const ahocorasick = new AhoCorasick(keywords);
const match: { begin: number, end: number, keyword: string}[] = ahocorasick.matchInText(text);
```

### Dynamic Addition/Deletion

```ts
import { DynamicAhoCorasick } from '@monyone/aho-corasick';

const ahocorasick = new DynamicAhoCorasick(keywords);
ahocorasick.add('test')
ahocorasick.delete('test')
const match: { begin: number, end: number, keyword: string}[] = ahocorasick.matchInText(text);
```

### Greedy Match Variant
```ts
import { AhoCorasick } from '@monyone/aho-corasick/greedy';

const ahocorasick = new AhoCorasick(keywords);
const match: { begin: number, end: number, keyword: string}[] = ahocorasick.matchInText(text);
```


### More Faster Search (Double Array)

```ts
import { AhoCorasick } from '@monyone/aho-corasick/fast';

const ahocorasick = new AhoCorasick(keywords);
const match: { begin: number, end: number, keyword: string}[] = ahocorasick.matchInText(text);
```


