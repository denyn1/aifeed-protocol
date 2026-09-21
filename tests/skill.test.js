'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SKILL = path.join(__dirname, '..', 'skills', 'aifeed', 'SKILL.md');

test('aifeed skill has machine-readable frontmatter and covers both flows', () => {
  const text = fs.readFileSync(SKILL, 'utf8');
  assert.ok(text.startsWith('---\n'), 'frontmatter fence');
  assert.ok(/^name: aifeed$/m.test(text), 'skill name');
  assert.ok(/^description: .{20,200}$/m.test(text), 'skill description');
  for (const heading of ['## Verify first', '## Publish', '## MCP server', '## Conformance']) {
    assert.ok(text.includes(heading), heading);
  }
  for (const command of ['node bin/cli.js validate', 'node bin/cli.js keygen', 'verifyAll', 'decideUsage', 'npm run verify']) {
    assert.ok(text.includes(command), command);
  }
  assert.ok(text.includes('restrict-only'), 'policy rule');
  assert.ok(!text.includes('PRIVATE KEY'), 'no key material');
});
