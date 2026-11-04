import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const script = fileURLToPath(new URL('../cinematic/extended/render_cabinet.mjs', import.meta.url));

test('cabinet renderer honours explicit tool overrides without launching Chrome', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'cabinet-override-test-'));
  const override = join(temporary, 'playwright-override.mjs');
  // Even a regression ignoring this stub cannot launch a real browser: its
  // executable override is deliberately nonexistent.
  const chrome = join(temporary, 'NONEXISTENT-CPU-ONLY-CHROME');
  await writeFile(override, `export const chromium = { launch(options) { throw new Error('CPU_OVERRIDE_SELECTED:' + options.executablePath); } };`);
  try {
    await assert.rejects(exec(process.execPath, [script, '--start', '0', '--end', '0', '--output-dir', join(temporary, 'frames')],
      { env: { ...process.env, PLAYWRIGHT_CORE_PATH: override, CHROME_PATH: chrome } }),
    (error) => {
      assert.match(error.stderr, /CPU_OVERRIDE_SELECTED/);
      assert.ok(error.stderr.includes(chrome));
      return true;
    });
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
