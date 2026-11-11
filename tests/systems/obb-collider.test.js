/* global AFRAME, setup, suite, test, assert */
suite('obb-collider system', function () {
  setup(function () {
    this.system = Object.create(AFRAME.systems['obb-collider'].prototype);
    this.system.data = {showColliders: false};
    this.system.init();
  });

  function collider () {
    var el = {components: {}, events: []};
    el.emit = function (name, detail) {
      el.events.push({name: name, detail: detail});
      if (el.onEvent) { el.onEvent(name, detail); }
    };
    el.components['obb-collider'] = {
      el: el,
      obb: {halfSize: {x: 1, y: 1, z: 1}},
      hideCollider: function () {},
      showCollider: function () {}
    };
    return el;
  }

  function collide (system, a, b) {
    system.registerCollision(a.components['obb-collider'], b.components['obb-collider']);
  }

  function events (el, name) {
    return el.events.filter(function (event) { return event.name === name; });
  }

  test('ends contacts when removal leaves only one collider', function () {
    var system = this.system;
    var a = collider();
    var b = collider();
    system.addCollider(a);
    system.addCollider(b);
    collide(system, a, b);

    system.removeCollider(b);

    assert.equal(system.collisions.length, 0);
    assert.equal(events(a, 'obbcollisionended').length, 1);
    assert.equal(events(b, 'obbcollisionended').length, 1);
    assert.strictEqual(events(a, 'obbcollisionended')[0].detail.withEl, b);
    assert.strictEqual(events(b, 'obbcollisionended')[0].detail.withEl, a);
    system.detectCollisions();
    assert.equal(events(a, 'obbcollisionended').length, 1);
  });

  test('removing every collider leaves no retained contacts', function () {
    var system = this.system;
    var a = collider();
    var b = collider();
    system.addCollider(a);
    system.addCollider(b);
    collide(system, a, b);
    system.removeCollider(a);
    system.removeCollider(b);
    assert.equal(system.collisions.length, 0);
    assert.strictEqual(system.tick, undefined);
    assert.equal(events(a, 'obbcollisionended').length, 1);
    assert.equal(events(b, 'obbcollisionended').length, 1);
  });

  test('does not end unrelated contacts reset for the next detection pass', function () {
    var system = this.system;
    var a = collider();
    var b = collider();
    var c = collider();
    var d = collider();
    [a, b, c, d].forEach(function (el) { system.addCollider(el); });
    collide(system, a, b);
    collide(system, c, d);
    system.resetCollisions();
    system.removeCollider(b);
    assert.equal(system.collisions.length, 1);
    assert.strictEqual(system.collisions[0].componentA.el, c);
    assert.equal(events(c, 'obbcollisionended').length, 0);
    collide(system, c, d);
    system.clearCollisions();
    assert.equal(events(c, 'obbcollisionstarted').length, 1);
  });

  test('repeated removal does not emit another end', function () {
    var system = this.system;
    var a = collider();
    var b = collider();
    system.addCollider(a);
    system.addCollider(b);
    collide(system, a, b);
    system.removeCollider(b);
    system.removeCollider(b);
    assert.equal(events(a, 'obbcollisionended').length, 1);
  });

  test('can register a fresh contact after removing and re-adding a collider', function () {
    var system = this.system;
    var a = collider();
    var b = collider();
    system.addCollider(a);
    system.addCollider(b);
    collide(system, a, b);
    system.removeCollider(b);
    system.addCollider(b);
    collide(system, a, b);
    assert.equal(events(a, 'obbcollisionstarted').length, 2);
    assert.equal(events(a, 'obbcollisionended').length, 1);
    assert.equal(system.collisions.length, 1);
  });

  test('end listeners can remove another colliding entity', function () {
    var system = this.system;
    var a = collider();
    var b = collider();
    var c = collider();
    var d = collider();
    [a, b, c, d].forEach(function (el) { system.addCollider(el); });
    collide(system, a, b);
    collide(system, c, d);
    a.onEvent = function (name) {
      if (name === 'obbcollisionended') { system.removeCollider(d); }
    };
    system.removeCollider(b);
    assert.equal(system.collisions.length, 0);
    [a, b, c, d].forEach(function (el) {
      assert.equal(events(el, 'obbcollisionended').length, 1);
    });
  });

  test('separation end listeners do not resurrect removed contacts', function () {
    var system = this.system;
    var a = collider();
    var b = collider();
    var c = collider();
    var d = collider();
    [a, b, c, d].forEach(function (el) { system.addCollider(el); });
    collide(system, a, b);
    collide(system, c, d);
    system.collisions[0].detected = false;
    a.onEvent = function (name) {
      if (name === 'obbcollisionended') { system.removeCollider(d); }
    };
    system.clearCollisions();
    assert.equal(system.collisions.length, 0);
    [a, b, c, d].forEach(function (el) {
      assert.equal(events(el, 'obbcollisionended').length, 1);
    });
  });
});
