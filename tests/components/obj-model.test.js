/* global assert, process, setup, suite, test */
var THREE = require('../../src/lib/three');
var entityFactory = require('../helpers').entityFactory;

var MTL = '/base/tests/assets/crate/crate.mtl';
var OBJ = '/base/tests/assets/crate/crate.obj';

suite('obj-model', function () {
  setup(function (done) {
    var el;
    var objAsset = document.createElement('a-asset-item');
    var mtlAsset = document.createElement('a-asset-item');
    mtlAsset.setAttribute('id', 'mtl');
    mtlAsset.setAttribute('src', MTL);
    objAsset.setAttribute('id', 'obj');
    objAsset.setAttribute('src', OBJ);
    el = this.el = entityFactory({assets: [mtlAsset, objAsset]});
    if (el.hasLoaded) { done(); }
    el.addEventListener('loaded', function () {
      done();
    });
  });

  test('can load .OBJ only', function (done) {
    var el = this.el;
    el.addEventListener('model-loaded', function () {
      assert.ok(el.components['obj-model'].model);
      done();
    });
    el.setAttribute('obj-model', 'obj', '#obj');
  });

  test('can load .OBJ + .MTL', function (done) {
    var el = this.el;
    var handled = false;  // Event listener is not getting torn down for some reason.
    el.addEventListener('model-loaded', function () {
      if (handled) { return; }
      handled = true;
      assert.ok(el.components['obj-model'].model);
      done();
    });
    el.setAttribute('obj-model', {mtl: '#mtl', obj: '#obj'});
  });

  test('can load .OBJ + .MTL with url()', function (done) {
    var el = this.el;
    var handled = false;  // Event listener is not getting torn down for some reason.
    el.addEventListener('model-loaded', function () {
      if (handled) { return; }
      handled = true;
      assert.ok(el.components['obj-model'].model);
      done();
    });
    el.setAttribute('obj-model', {mtl: `url(${MTL})`, obj: `url(${OBJ})`});
  });

  test('can load multiple .OBJ', function (done) {
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
      assert.notEqual(el.components['obj-model'].model, el2.components['obj-model'].model);
      done();
    });

    el2.addEventListener('loaded', function () {
      el.setAttribute('obj-model', {obj: '#obj'});
      el2.setAttribute('obj-model', {obj: '#obj'});
    });
    el.sceneEl.appendChild(el2);
  });

  test('can load .OBJ with material', function (done) {
    var el = this.el;
    el.setAttribute('material', 'color', 'red');
    el.addEventListener('object3dset', () => {
      var material = el.getObject3D('mesh').children[0].material;
      assert.equal(material.color.r, 1);
      done();
    });
    el.setAttribute('obj-model', 'obj', '#obj');
  });

  test('can load .OBJ with reset material', function (done) {
    var el = this.el;
    el.setAttribute('material', 'color', 'red');
    el.addEventListener('object3dset', () => {
      el.removeAttribute('material');
      el.setAttribute('material', 'color', 'blue');
      setTimeout(() => {
        assert.equal(el.getObject3D('mesh').children[0].material.color.b, 1);
        done();
      });
    });
    el.setAttribute('obj-model', 'obj', '#obj');
  });
  suite('pending loads', function () {
    setup(function () {
      var requests = this.requests = [];
      var materials = this.materials = [];
      this.el.setAttribute('obj-model', '');
      this.component = this.el.components['obj-model'];
      this.sinon.stub(this.component.objLoader, 'load').callsFake(function (src, onLoad) {
        requests.push({src: src, onLoad: onLoad});
      });
      this.sinon.stub(this.component.mtlLoader, 'load').callsFake(function (src, onLoad) {
        materials.push({src: src, onLoad: onLoad});
      });
      this.loaded = this.sinon.spy();
      this.el.addEventListener('model-loaded', this.loaded);
    });

    test('keeps the newest OBJ when loads finish in reverse order', function () {
      var model = new THREE.Object3D();
      this.el.setAttribute('obj-model', {obj: 'url(first.obj)'});
      this.el.setAttribute('obj-model', {obj: 'url(second.obj)'});
      this.requests[1].onLoad(model);
      this.requests[0].onLoad(new THREE.Object3D());
      assert.strictEqual(this.component.model, model);
      assert.strictEqual(this.el.getObject3D('mesh'), model);
      assert.equal(this.loaded.callCount, 1);
      assert.strictEqual(this.loaded.firstCall.args[0].detail.model, model);
    });

    test('distinguishes repeated requests for the same OBJ URL', function () {
      var model = new THREE.Object3D();
      this.el.setAttribute('obj-model', {obj: 'url(first.obj)'});
      this.el.setAttribute('obj-model', {obj: 'url(second.obj)'});
      this.el.setAttribute('obj-model', {obj: 'url(first.obj)'});
      this.requests[2].onLoad(model);
      this.requests[0].onLoad(new THREE.Object3D());
      this.requests[1].onLoad(new THREE.Object3D());
      assert.strictEqual(this.el.getObject3D('mesh'), model);
      assert.equal(this.loaded.callCount, 1);
    });

    test('ignores an OBJ result after removal before the first model arrives', function () {
      this.el.setAttribute('obj-model', {obj: 'url(first.obj)'});
      this.el.removeAttribute('obj-model');
      this.requests[0].onLoad(new THREE.Object3D());
      assert.notOk(this.el.getObject3D('mesh'));
      assert.equal(this.loaded.callCount, 0);
    });

    test('invalidates pending OBJ loads when the source is cleared', function () {
      this.el.setAttribute('obj-model', {obj: 'url(first.obj)'});
      this.el.setAttribute('obj-model', {obj: ''});
      this.requests[0].onLoad(new THREE.Object3D());
      assert.notOk(this.el.getObject3D('mesh'));
      assert.equal(this.loaded.callCount, 0);
    });

    test('does not start an OBJ load from an obsolete MTL callback', function () {
      var material = {preload: this.sinon.spy()};
      var model = new THREE.Object3D();
      var setMaterials = this.sinon.spy(this.component.objLoader, 'setMaterials');
      this.el.setAttribute('obj-model', {obj: 'url(first.obj)', mtl: 'url(first.mtl)'});
      this.el.setAttribute('obj-model', {obj: 'url(second.obj)', mtl: ''});
      this.requests[0].onLoad(model);
      this.materials[0].onLoad(material);
      assert.equal(material.preload.callCount, 0);
      assert.equal(setMaterials.callCount, 0);
      assert.equal(this.requests.length, 1);
      assert.strictEqual(this.el.getObject3D('mesh'), model);
      assert.equal(this.loaded.callCount, 1);
    });

    test('does not start an OBJ load after removal while its MTL is pending', function () {
      var material = {preload: this.sinon.spy()};
      this.el.setAttribute('obj-model', {obj: 'url(first.obj)', mtl: 'url(first.mtl)'});
      this.el.removeAttribute('obj-model');
      this.materials[0].onLoad(material);
      assert.equal(material.preload.callCount, 0);
      assert.equal(this.requests.length, 0);
      assert.equal(this.loaded.callCount, 0);
    });

    test('ignores an obsolete OBJ result after its MTL has loaded', function () {
      var model = new THREE.Object3D();
      var material = {preload: this.sinon.spy()};
      this.el.setAttribute('obj-model', {obj: 'url(first.obj)', mtl: 'url(first.mtl)'});
      this.materials[0].onLoad(material);
      this.el.setAttribute('obj-model', {obj: 'url(second.obj)', mtl: ''});
      this.requests[1].onLoad(model);
      this.requests[0].onLoad(new THREE.Object3D());
      assert.strictEqual(this.component.model, model);
      assert.strictEqual(this.el.getObject3D('mesh'), model);
      assert.equal(this.loaded.callCount, 1);
    });

    test('still attaches the current OBJ with MTL and emits its model', function () {
      var model = new THREE.Object3D();
      var material = {preload: this.sinon.spy()};
      this.el.setAttribute('obj-model', {obj: 'url(first.obj)', mtl: 'url(first.mtl)'});
      this.materials[0].onLoad(material);
      this.requests[0].onLoad(model);
      assert.equal(material.preload.callCount, 1);
      assert.strictEqual(this.component.model, model);
      assert.strictEqual(this.el.getObject3D('mesh'), model);
      assert.equal(this.loaded.callCount, 1);
      assert.equal(this.loaded.firstCall.args[0].detail.format, 'obj');
      assert.strictEqual(this.loaded.firstCall.args[0].detail.model, model);
    });
  });

});
