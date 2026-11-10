/* global AFRAME, assert, setup, suite, teardown, test */

suite('inspector', function () {
  var SCRIPT_SELECTOR = 'script[data-name=aframe-inspector]';

  setup(function (done) {
    var el = this.sceneEl = document.createElement('a-scene');
    // Set a fake URL so the inspector doesn't interfere with other tests.
    el.setAttribute('inspector', 'url: fake.js');
    document.body.appendChild(el);
    el.addEventListener('loaded', function () { done(); });
  });

  teardown(function () {
    var el = this.sceneEl;
    var script = document.querySelector(SCRIPT_SELECTOR);
    AFRAME.INSPECTOR = undefined;
    AFRAME.inspectorInjected = false;
    el.parentNode.removeChild(el);
    if (script) {
      script.onload = null;
      script.onerror = null;
      script.parentNode.removeChild(script);
    }
    document.querySelectorAll('.a-inspector-loader').forEach(function (loader) {
      loader.parentNode.removeChild(loader);
    });
  });

  test('injects inspector <script> via keyboard shortcut', function () {
    var el = this.sceneEl;
    // Must call onKeydown method directly because Chrome doesn't provide a reliable method
    // for KeyboardEvent.
    el.components.inspector.onKeydown({
      keyCode: 73,
      ctrlKey: true,
      altKey: true
    });
    assert.ok(document.querySelector(SCRIPT_SELECTOR));
  });

  test('injects inspector <script> via postMessage', function () {
    var el = this.sceneEl;
    el.components.inspector.onMessage({data: 'INJECT_AFRAME_INSPECTOR'});
    assert.ok(document.querySelector(SCRIPT_SELECTOR));
  });

  test('ignores repeated requests while the inspector script is loading', function () {
    var component = this.sceneEl.components.inspector;
    component.onMessage({data: 'INJECT_AFRAME_INSPECTOR'});

    assert.doesNotThrow(function () {
      component.onMessage({data: 'INJECT_AFRAME_INSPECTOR'});
      component.onKeydown({keyCode: 73, ctrlKey: true, altKey: true});
    });
    assert.equal(document.querySelectorAll(SCRIPT_SELECTOR).length, 1);
  });

  test('can retry and open after the inspector script fails to load', function () {
    var component = this.sceneEl.components.inspector;
    var opens = 0;
    var focusEl = document.createElement('a-entity');
    var script;
    var retryScript;
    component.openInspector();
    script = document.querySelector(SCRIPT_SELECTOR);
    script.onerror();
    script.onerror = null;

    assert.isFalse(AFRAME.inspectorInjected);
    assert.isNull(script.parentNode);
    assert.equal(component.loadingMessageEl.innerHTML, 'Error loading Inspector');

    assert.doesNotThrow(function () { component.openInspector(focusEl); });
    retryScript = document.querySelector(SCRIPT_SELECTOR);
    assert.notEqual(retryScript, script);
    assert.equal(document.querySelectorAll(SCRIPT_SELECTOR).length, 1);
    assert.include(component.loadingMessageEl.innerHTML, 'Loading Inspector');
    assert.notInclude(component.loadingMessageEl.innerHTML, 'Error');

    AFRAME.INSPECTOR = {
      open: function (el) {
        assert.equal(el, focusEl);
        opens++;
      }
    };
    retryScript.onload();
    assert.equal(opens, 1);
    assert.isNull(component.loadingMessageEl.parentNode);
    component.openInspector(focusEl);
    assert.equal(opens, 2);
    assert.equal(document.querySelectorAll(SCRIPT_SELECTOR).length, 1);
  });
});
