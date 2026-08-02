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

### Greedy (Leftmost-Longest) Match Variant
```ts
import { AhoCorasick } from '@monyone/aho-corasick/greedy';

const ahocorasick = new AhoCorasick(keywords);
const match: { begin: number, end: number, keyword: string}[] = ahocorasick.matchInText(text);
```

### Streaming Replace (Leftmost-Longest)
```ts
import { AhoCorasick, Boundary } from '@monyone/aho-corasick/stream';

const ahocorasick = new AhoCorasick(['cat']);

Array.from(
  ahocorasick.replaceSync(['a cat and category'], () => 'DOG')
)
// ['a DOG and DOGegory']
```


#### Word Boundaries
```ts
import { AhoCorasick, Boundary } from '@monyone/aho-corasick/stream';

const ahocorasick = new AhoCorasick(['cat']);

Array.from(
  ahocorasick.replaceSync(['a cat and category'], () => 'DOG', Boundary.AsciiEdge())
)
// ['a DOG and category']
```

#### With Node.js Stream API
```ts
import { AhoCorasick } from '@monyone/aho-corasick/stream/node';
import { createReadStream, createWriteStream } from 'node:fs';

const ahocorasick = new AhoCorasick(['example', 'Example']);
const input = createReadStream('input.txt', { encoding: 'utf-8' });
const output = createWriteStream('output.txt', { encoding: 'utf-8' });

input.pipe(ahocorasick.replaceStream((key) => '#'.repeat(key.length))).pipe(output);
```

#### With Web Streams / fetch
```ts
import { AhoCorasick } from '@monyone/aho-corasick/stream/web';

const ahocorasick = new AhoCorasick(['example', 'Example']);
const input = (await fetch('http://example.com')).body!.pipeThrough(new TextDecoderStream());

const replaced = input.pipeThrough(ahocorasick.replaceStream((key) => '#'.repeat(key.length)));
```

### Streaming Tokenize

```ts
import { AhoCorasick } from '@monyone/aho-corasick/stream';

const ahocorasick = new AhoCorasick(['cat', 'dog']);

const tokens = Array.from(ahocorasick.tokenizeSync(
  ['a cat and a dog'],
  (text) => ({ type: 'text', value: text }),
  (keyword) => ({ type: 'match', keyword }),
));
// [{type:'text',value:'a '}, {type:'match',keyword:'cat'}, {type:'text',value:' and a '}, {type:'match',keyword:'dog'}]
```

### More Faster Search (Double Array)
DAT (Double Array Trie) Based Aho-Corasick implementation

Fast Search, but Build (Construction) heavy.

#### Normal Aho-Corasick

```ts
import { AhoCorasick } from '@monyone/aho-corasick/fast';

const ahocorasick = new AhoCorasick(keywords);
const match: { begin: number, end: number, keyword: string}[] = ahocorasick.matchInText(text);
```

#### Greedy (Leftmost-Longest) Variant
```ts
import { AhoCorasick } from '@monyone/aho-corasick/greedy/fast';

const ahocorasick = new AhoCorasick(keywords);
const match: { begin: number, end: number, keyword: string}[] = ahocorasick.matchInText(text);
```


