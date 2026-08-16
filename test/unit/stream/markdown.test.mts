import { test, expect, describe } from 'vitest';

import { AhoCorasick, MarkdownStopFilter } from '../../../src/stream/imperative/normal.mts'

describe('Human Test', () => {
  test('Heading Example', () => {
    const aho = new AhoCorasick(['test']);
    const markdown = `# HELLO test content\nThis is test content.\nhello world.\n`;
    const handle = aho.replaceSync((_) => '[REPLACED]', new MarkdownStopFilter({ heading: true, code: false }));

    const result = [handle.write(markdown).join(''), handle.end()].join('')
    expect(result).toStrictEqual(`# HELLO test content\nThis is [REPLACED] content.\nhello world.\n`);
  });

  test('Not Heading Example', () => {
    const aho = new AhoCorasick(['test']);
    const markdown = `#HELLO test content\nThis is test content.\nhello world.\n`;
    const handle = aho.replaceSync((_) => '[REPLACED]', new MarkdownStopFilter({ heading: true, code: false }));

    const result = [handle.write(markdown).join(''), handle.end()].join('')
    expect(result).toStrictEqual(`#HELLO [REPLACED] content\nThis is [REPLACED] content.\nhello world.\n`);
  });

  test('Heading newline', () => {
    const aho = new AhoCorasick(['test', '\n']);
    const markdown = `# HELLO test content\nThis is test content.\nhello world.\n`;
    const handle = aho.replaceSync((_) => '[REPLACED]', new MarkdownStopFilter({ heading: true, code: false }));

    const result = [handle.write(markdown).join(''), handle.end()].join('')
    expect(result).toStrictEqual(`# HELLO test content\nThis is [REPLACED] content.[REPLACED]hello world.[REPLACED]`);
  });

  test('fence code block', () => {
    const aho = new AhoCorasick(['test']);
    const markdown = '```test\ntest is great\n```\ntest';
    const handle = aho.replaceSync((_) => '[REPLACED]', new MarkdownStopFilter({ heading: false, code: true }));

    const result = [handle.write(markdown).join(''), handle.end()].join('')
    expect(result).toStrictEqual('```test\ntest is great\n```\n[REPLACED]');
  });

  test('ineline code block without newlinw', () => {
    const aho = new AhoCorasick(['test']);
    const markdown = '``test``\ntest is great\n\ntest';
    const handle = aho.replaceSync((_) => '[REPLACED]', new MarkdownStopFilter({ heading: false, code: true }));

    const result = [handle.write(markdown).join(''), handle.end()].join('')
    expect(result).toStrictEqual('``test``\n[REPLACED] is great\n\n[REPLACED]');
  });

  test('ineline code block with newline', () => {
    const aho = new AhoCorasick(['test']);
    const markdown = '``test\ntesting``\ntest is great\n\ntest';
    const handle = aho.replaceSync((_) => '[REPLACED]', new MarkdownStopFilter({ heading: false, code: true }));

    const result = [handle.write(markdown).join(''), handle.end()].join('')
    expect(result).toStrictEqual('``test\ntesting``\n[REPLACED] is great\n\n[REPLACED]');
  });

  test('tilda not code block', () => {
    const aho = new AhoCorasick(['test']);
    const markdown = '~~test\ntesting\n~~\ntest is great\n\ntest';
    const handle = aho.replaceSync((_) => '[REPLACED]', new MarkdownStopFilter({ heading: false, code: true }));

    const result = [handle.write(markdown).join(''), handle.end()].join('')
    expect(result).toStrictEqual('~~[REPLACED]\n[REPLACED]ing\n~~\n[REPLACED] is great\n\n[REPLACED]');
  });

  test('tilda code block', () => {
    const aho = new AhoCorasick(['test']);
    const markdown = '~~~test\ntesting\n~~~\ntest is great\n\ntest';
    const handle = aho.replaceSync((_) => '[REPLACED]', new MarkdownStopFilter({ heading: false, code: true }));

    const result = [handle.write(markdown).join(''), handle.end()].join('')
    expect(result).toStrictEqual('~~~test\ntesting\n~~~\n[REPLACED] is great\n\n[REPLACED]');
  });
});
