/* global assert, process, setup, suite, test */
var entityFactory = require('../helpers').entityFactory;

suite('link', function () {
  var el;

  setup(function (done) {
    el = entityFactory();
    el.setAttribute('link', '');
    if (el.hasLoaded) { done(); }
    el.addEventListener('loaded', function () {
      done();
    });
  });

  test('does not initialize visual aspect by default', function () {
    assert.notOk(el.components.link.textEl);
    assert.notOk(el.components.link.sphereEl);
    assert.notOk(el.components.link.semiSphereEl);
  });

  test('initializes visual aspect if set', function () {
    el.setAttribute('link', 'visualAspectEnabled', true);
    assert.ok(el.components.link.textEl);
    assert.ok(el.components.link.sphereEl);
    assert.ok(el.components.link.semiSphereEl);
  });

  suite('navigation events', function () {
    var navigationCount;

    setup(function () {
      el.pause();
      navigationCount = 0;
      el.components.link.navigate = function () { navigationCount++; };
      el.play();
    });

    test('changes the event without a visual aspect', function () {
      el.setAttribute('link', 'on', 'activate');
      el.emit('click');
      assert.equal(navigationCount, 0);
      el.emit('activate');
      assert.equal(navigationCount, 1);
    });

    test('changes the event with a visual aspect', function () {
      el.setAttribute('link', 'visualAspectEnabled', true);
      el.setAttribute('link', 'on', 'activate');
      el.emit('click');
      assert.equal(navigationCount, 0);
      el.emit('activate');
      assert.equal(navigationCount, 1);
    });

    test('does not retain intermediate event names', function () {
      el.setAttribute('link', 'on', 'activate');
      el.setAttribute('link', 'on', 'select');
      el.setAttribute('link', 'on', 'click');
      el.emit('activate');
      el.emit('select');
      assert.equal(navigationCount, 0);
      el.emit('click');
      assert.equal(navigationCount, 1);
    });

    test('removes the changed listener when paused', function () {
      el.setAttribute('link', 'on', 'activate');
      el.pause();
      el.emit('click');
      el.emit('activate');
      assert.equal(navigationCount, 0);
      el.play();
      el.emit('activate');
      assert.equal(navigationCount, 1);
    });

    test('removes the changed listener with the component', function () {
      el.setAttribute('link', 'on', 'activate');
      el.removeAttribute('link');
      el.emit('click');
      el.emit('activate');
      assert.equal(navigationCount, 0);
    });

    test('disables navigation when the event is cleared', function () {
      el.setAttribute('link', 'on', '');
      el.emit('click');
      assert.equal(navigationCount, 0);
      el.setAttribute('link', 'on', 'activate');
      el.emit('activate');
      assert.equal(navigationCount, 1);
    });

    test('waits for play before registering an updated event', function () {
      el.pause();
      el.setAttribute('link', 'on', 'activate');
      el.emit('click');
      el.emit('activate');
      assert.equal(navigationCount, 0);
      el.play();
      el.emit('click');
      assert.equal(navigationCount, 0);
      el.emit('activate');
      assert.equal(navigationCount, 1);
    });

    test('registers once after repeated pause and play', function () {
      el.pause();
      el.play();
      el.pause();
      el.play();
      el.emit('click');
      assert.equal(navigationCount, 1);
    });
  });
});
