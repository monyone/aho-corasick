import { test, expect, describe } from 'vitest';

import { AhoCorasick, MarkdownStopFilter } from '../../../src/stream/imperative/normal.mts'

describe('Human Test', () => {
  test('Heading Example', () => {
    const aho = new AhoCorasick(['test']);
    const markdown = `# HELLO test content\nThis is test content.\nhello world.\n`;
    const handle = aho.replaceSync((_) => '[REPLACED]', new MarkdownStopFilter({ heading: true }));

    const result = [handle.write(markdown).join(''), handle.end()].join('')
    expect(result).toStrictEqual(`# HELLO test content\nThis is [REPLACED] content.\nhello world.\n`);
  });

  test('Not Heading Example', () => {
    const aho = new AhoCorasick(['test']);
    const markdown = `#HELLO test content\nThis is test content.\nhello world.\n`;
    const handle = aho.replaceSync((_) => '[REPLACED]', new MarkdownStopFilter({ heading: true }));

    const result = [handle.write(markdown).join(''), handle.end()].join('')
    expect(result).toStrictEqual(`#HELLO [REPLACED] content\nThis is [REPLACED] content.\nhello world.\n`);
  });

  test('Heading newline', () => {
    const aho = new AhoCorasick(['test', '\n']);
    const markdown = `# HELLO test content\nThis is test content.\nhello world.\n`;
    const handle = aho.replaceSync((_) => '[REPLACED]', new MarkdownStopFilter({ heading: true }));

    const result = [handle.write(markdown).join(''), handle.end()].join('')
    expect(result).toStrictEqual(`# HELLO test content\nThis is [REPLACED] content.[REPLACED]hello world.[REPLACED]`);
  });
});
