/* global assert, process, setup, suite, test */
var entityFactory = require('../helpers').entityFactory;
var THREE = require('index').THREE;

var SRC = '/base/tests/assets/box/Box.gltf';
var SRC_NO_DEFAULT_SCENE = '/base/tests/assets/box/Box_no_default_scene.gltf';

suite('gltf-model', function () {
  setup(function (done) {
    var el;
    var asset = document.createElement('a-asset-item');
    asset.setAttribute('id', 'gltf');
    asset.setAttribute('src', SRC);
    el = this.el = entityFactory({assets: [asset]});
    if (el.hasLoaded) { done(); }
    el.addEventListener('loaded', function () {
      done();
    });
  });

  test('can load', function (done) {
    var el = this.el;
    el.addEventListener('model-loaded', function () {
      assert.ok(el.components['gltf-model'].model);
      done();
    });
    el.setAttribute('gltf-model', '#gltf');
  });

  test('can load with url()', function (done) {
    var el = this.el;
    el.addEventListener('model-loaded', function () {
      assert.ok(el.components['gltf-model'].model);
      done();
    });
    el.setAttribute('gltf-model', `url(${SRC})`);
  });

  test('can load multiple models', function (done) {
    var el = this.el;
    var el2 = document.createElement('a-entity');
    var elPromise = new Promise(function (resolve) {
      el.addEventListener('model-loaded', resolve);
    });
    var el2Promise = new Promise(function (resolve) {
      el2.addEventListener('model-loaded', resolve);
    });

    Promise.all([elPromise, el2Promise]).then(function () {
      assert.ok(el.getObject3D('mesh'));
      assert.ok(el2.getObject3D('mesh'));
      assert.notEqual(el.components['gltf-model'].model, el2.components['gltf-model'].model);
      done();
    });

    el2.addEventListener('loaded', function () {
      el.setAttribute('gltf-model', '#gltf');
      el2.setAttribute('gltf-model', '#gltf');
    });
    el.sceneEl.appendChild(el2);
  });

  test('attaches animation clips to model', function (done) {
    var el = this.el;
    var sceneMock = new THREE.Object3D();
    var animations = [
      new THREE.AnimationClip('run', 1.0, []),
      new THREE.AnimationClip('jump', 1.0, [])
    ];
    var gltfMock = {
      scene: sceneMock,
      scenes: [sceneMock],
      animations: animations
    };

    this.sinon.replace(THREE, 'GLTFLoader', function MockGLTFLoader () {
      this.load = function (url, onLoad) {
        process.nextTick(onLoad.bind(null, gltfMock));
      };
      this.setDRACOLoader = function () {};
    });

    el.addEventListener('model-loaded', function () {
      var model = el.components['gltf-model'].model;
      assert.ok(model);
      assert.equal(model.animations, animations);
      done();
    });

    el.setAttribute('gltf-model', '#gltf');
  });

  test('can load data not including default scene', function (done) {
    var el = this.el;
    el.addEventListener('model-loaded', function () {
      assert.ok(el.components['gltf-model'].model);
      done();
    });
    el.setAttribute('gltf-model', `url(${SRC_NO_DEFAULT_SCENE})`);
  });

  suite('pending loads', function () {
    setup(function () {
      var requests = this.requests = [];
      this.el.setAttribute('gltf-model', '');
      this.component = this.el.components['gltf-model'];
      this.sinon.stub(this.component.loader, 'load').callsFake(function (src, onLoad, onProgress, onError) {
        requests.push({src: src, onLoad: onLoad, onError: onError});
      });
      this.loaded = this.sinon.spy();
      this.failed = this.sinon.spy();
      this.el.addEventListener('model-loaded', this.loaded);
      this.el.addEventListener('model-error', this.failed);
    });

    test('keeps the newest model when requests complete in reverse order', function () {
      var self = this;
      var scene = new THREE.Object3D();
      var animations = [];
      this.el.setAttribute('gltf-model', SRC);
      return this.component.ready.then(function () {
        self.el.setAttribute('gltf-model', SRC_NO_DEFAULT_SCENE);
        return self.component.ready;
      }).then(function () {
        assert.equal(self.requests.length, 2);
        self.requests[1].onLoad({scenes: [scene], animations: animations});
        self.requests[0].onLoad({scene: new THREE.Object3D(), animations: []});
        assert.strictEqual(self.component.model, scene);
        assert.strictEqual(self.el.getObject3D('mesh'), scene);
        assert.strictEqual(scene.animations, animations);
        assert.equal(self.loaded.callCount, 1);
        assert.strictEqual(self.loaded.firstCall.args[0].detail.model, scene);
      });
    });

    test('ignores an older request even when the newest request uses the same URL', function () {
      var self = this;
      var scene = new THREE.Object3D();
      this.el.setAttribute('gltf-model', SRC);
      return this.component.ready.then(function () {
        self.el.setAttribute('gltf-model', SRC_NO_DEFAULT_SCENE);
        return self.component.ready;
      }).then(function () {
        self.el.setAttribute('gltf-model', SRC);
        return self.component.ready;
      }).then(function () {
        assert.equal(self.requests.length, 3);
        self.requests[2].onLoad({scene: scene, animations: []});
        self.requests[0].onLoad({scene: new THREE.Object3D(), animations: []});
        self.requests[1].onLoad({scene: new THREE.Object3D(), animations: []});
        assert.strictEqual(self.el.getObject3D('mesh'), scene);
        assert.equal(self.loaded.callCount, 1);
      });
    });

    test('ignores success and errors after removal', function () {
      var self = this;
      this.el.setAttribute('gltf-model', SRC);
      return this.component.ready.then(function () {
        self.el.removeAttribute('gltf-model');
        self.requests[0].onLoad({scene: new THREE.Object3D(), animations: []});
        self.requests[0].onError(new Error('stale failure'));
        assert.notOk(self.el.getObject3D('mesh'));
        assert.equal(self.loaded.callCount, 0);
        assert.equal(self.failed.callCount, 0);
      });
    });

    test('only starts the latest request after decoder readiness', function () {
      var self = this;
      var resolveReady;
      this.component.ready = new Promise(function (resolve) { resolveReady = resolve; });
      this.el.setAttribute('gltf-model', SRC);
      this.el.setAttribute('gltf-model', SRC_NO_DEFAULT_SCENE);
      resolveReady();
      return this.component.ready.then(function () {
        assert.equal(self.requests.length, 1);
        assert.equal(self.requests[0].src, SRC_NO_DEFAULT_SCENE);
      });
    });

    test('does not start a removed request after decoder readiness', function () {
      var self = this;
      var resolveReady;
      this.component.ready = new Promise(function (resolve) { resolveReady = resolve; });
      this.el.setAttribute('gltf-model', SRC);
      this.el.removeAttribute('gltf-model');
      resolveReady();
      return this.component.ready.then(function () {
        assert.equal(self.requests.length, 0);
      });
    });

    test('ignores stale errors but reports the current error', function () {
      var self = this;
      this.el.setAttribute('gltf-model', SRC);
      return this.component.ready.then(function () {
        self.el.setAttribute('gltf-model', SRC_NO_DEFAULT_SCENE);
        return self.component.ready;
      }).then(function () {
        self.requests[0].onError(new Error('stale failure'));
        assert.equal(self.failed.callCount, 0);
        self.requests[1].onError(new Error('current failure'));
        assert.equal(self.failed.callCount, 1);
        assert.equal(self.failed.firstCall.args[0].detail.src, SRC_NO_DEFAULT_SCENE);
        assert.equal(self.failed.firstCall.args[0].detail.format, 'gltf');
      });
    });

    test('invalidates a pending load when the source is cleared', function () {
      var self = this;
      this.el.setAttribute('gltf-model', SRC);
      return this.component.ready.then(function () {
        self.el.setAttribute('gltf-model', '');
        self.requests[0].onLoad({scene: new THREE.Object3D(), animations: []});
        assert.notOk(self.el.getObject3D('mesh'));
        assert.equal(self.loaded.callCount, 0);
      });
    });
  });

});
