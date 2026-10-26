// Goal: sign-in waits count down without reloading, retrying OAuth, or weakening script policy.
// Method: execute the rendered inline script with a controlled clock and minimal browser globals.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { loginPage } from '../src/features/auth/githubLogin';

test('the displayed wait ticks, catches up after suspension, and stops at zero', async () => {
  const response = loginPage('rate-limit', 429, '', 266);
  const html = await response.text();
  const script = /<script nonce="([^"]+)">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(script?.[1]);
  assert.ok(script[2]);
  assert.ok(response.headers.get('Content-Security-Policy')?.endsWith(`'nonce-${script[1]}'`));
  assert.match(html, /Wait at least 266 seconds/);
  let now = 1_000_000;
  let tick: (() => void) | undefined;
  let stopped = false;
  const countdown = { textContent: '' };
  const message = {
    textContent: '',
    setAttribute: (name: string, value: string) => {
      assert.equal(name, 'role');
      assert.equal(value, 'status');
    },
  };
  runInNewContext(script[2], {
    Date: { now: () => now },
    window: {
      document: {
        getElementById: (id: string) => {
          assert.ok(['login-countdown', 'login-message'].includes(id));
          return id === 'login-countdown' ? countdown : message;
        },
      },
      setInterval: (callback: () => void, interval: number) => {
        assert.equal(interval, 1000);
        assert.equal(tick, undefined);
        tick = callback;
        return 1;
      },
      clearInterval: (timer: number) => {
        assert.equal(timer, 1);
        stopped = true;
      },
    },
  });
  assert.ok(tick);
  now += 1000;
  tick();
  assert.match(countdown.textContent, /265 seconds/);
  now += 264_000;
  tick();
  assert.match(countdown.textContent, /1 second,/);
  assert.equal(stopped, false);
  now += 2000;
  tick();
  assert.equal(message.textContent, 'You can try signing in again below.');
  assert.equal(stopped, true);
});

test('pages without a wait do not permit or emit scripts', async () => {
  for (const response of [loginPage(), loginPage('expired', 403), loginPage('rate-limit', 429)]) {
    assert.doesNotMatch(await response.text(), /<script|id="login-countdown"/);
    assert.doesNotMatch(response.headers.get('Content-Security-Policy') ?? '', /script-src/);
  }
});

test('invalid waits cannot be embedded into a login page', () => {
  for (const seconds of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => loginPage('rate-limit', 429, '', seconds), /Assertion failed/);
  }
});
