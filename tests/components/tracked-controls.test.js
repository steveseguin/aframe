/* global assert, process, setup, suite, test */
var elFactory = require('../helpers').elFactory;

suite('tracked-controls', function () {
  var el;

  setup(function (done) {
    elFactory().then(_el => {
      el = _el;
      done();
    });
  });

  test('set tracked-controls-webxr if WebXR API available', function () {
    el.sceneEl.hasWebXR = true;
    el.pause();
    el.setAttribute('tracked-controls', '');
    assert.ok(el.components['tracked-controls-webxr']);
    assert.notOk(el.components['tracked-controls-webvr']);
  });

  test('forwards autoHide changes to tracked-controls-webxr', function () {
    el.sceneEl.hasWebXR = true;
    el.pause();
    el.setAttribute('tracked-controls', '');
    assert.strictEqual(el.components['tracked-controls-webxr'].data.autoHide, true);
    el.setAttribute('tracked-controls', 'autoHide', false);
    assert.strictEqual(el.components['tracked-controls-webxr'].data.autoHide, false);
    el.setAttribute('tracked-controls', 'autoHide', true);
    assert.strictEqual(el.components['tracked-controls-webxr'].data.autoHide, true);
  });

  test('set tracked-controls-webvr if WebVR API available', function () {
    el.sceneEl.hasWebXR = false;
    el.pause();
    el.setAttribute('tracked-controls', '');
    assert.ok(el.components['tracked-controls-webvr']);
    assert.notOk(el.components['tracked-controls-webxr']);
  });
});
