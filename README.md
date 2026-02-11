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

### Greedy (Leftmost-Longest) Streaming Variant

#### With Node.js Stream API
```ts
import { AhoCorasick } from '@monyone/aho-corasick/stream';
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';

const ahocorasick = new AhoCorasick(keywords);
const input = createReadStream('input.txt', { encoding: 'utf-8' });
const output = createWriteStream('output.txt', { encoding: 'utf-8' });
const readable = Readable.from(ahocorasick.replaceAsync(input, (key) => '#'.repeat(key.length)));
readable.pipe(output);
```

#### With fetch
```ts
import { AhoCorasick } from '@monyone/aho-corasick/stream';

const ahocorasick = new AhoCorasick(['example', 'Example']);
const input = (await fetch('http://example.com')).body!.pipeThrough(new TextDecoderStream());
const readable = ReadableStream.from(ahocorasick.replaceAsync(stream, (key) => '#'.repeat(key.length)));
```


### More Faster Search (Double Array)

```ts
import { AhoCorasick } from '@monyone/aho-corasick/fast';

const ahocorasick = new AhoCorasick(keywords);
const match: { begin: number, end: number, keyword: string}[] = ahocorasick.matchInText(text);
```


