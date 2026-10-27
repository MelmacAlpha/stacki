// Goal: attribute-driven site animations must not repeatedly rebuild the navigator's page map.
// Method: classify real MutationObserver records for restyles, class changes, markup and
// mixed batches, including script responses that turn an attribute change into new content.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');
const loadRenderer = require('../../helpers/rendererModule');
const { mutationKind } = loadRenderer('electron/preload/frameReports.ts');

test('attributes restyle while classes, text and structural changes still refresh the page', () => {
  const dom = new JSDOM('<!doctype html><body><div class="card">Hello</div></body>');
  global.document = dom.window.document;
  global.Element = dom.window.Element;
  const observer = new dom.window.MutationObserver(() => {});
  observer.observe(document.documentElement, {
    attributes: true,
    attributeOldValue: true,
    childList: true,
    characterData: true,
    subtree: true,
  });
  try {
    const element = document.querySelector('.card');
    for (const name of ['style', 'id', 'hidden', 'open', 'aria-expanded', 'data-progress']) {
      element.setAttribute(name, name === 'style' ? 'margin: 1px' : 'value');
      assert.equal(mutationKind(observer.takeRecords()), 'css', name);
      element.removeAttribute(name);
      assert.equal(mutationKind(observer.takeRecords()), 'css', name);
    }
    element.classList.add('is-open');
    assert.equal(mutationKind(observer.takeRecords()), 'page');
    element.classList.add('stacki-opened');
    assert.equal(mutationKind(observer.takeRecords()), 'none');
    element.setAttribute('aria-expanded', 'true');
    element.append(document.createElement('span'));
    assert.equal(mutationKind(observer.takeRecords()), 'page');
    element.firstChild.data = 'Changed';
    assert.equal(mutationKind(observer.takeRecords()), 'page');
    element.setAttribute('data-progress', '2');
    element.classList.remove('is-open');
    assert.equal(mutationKind(observer.takeRecords()), 'page');
    element.lastChild.remove();
    element.setAttribute('hidden', '');
    assert.equal(mutationKind(observer.takeRecords()), 'page');
    const style = document.createElement('style');
    document.head.append(style);
    assert.equal(mutationKind(observer.takeRecords()), 'css');
    style.textContent = '.card { display: none; }';
    assert.equal(mutationKind(observer.takeRecords()), 'css');
  } finally {
    observer.disconnect();
    dom.window.close();
  }
});
