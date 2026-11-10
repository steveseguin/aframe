/* global assert, setup, suite, test, THREE */

suite('reflection', function () {
  setup(function (done) {
    var el = this.sceneEl = document.createElement('a-scene');
    document.body.appendChild(el);
    const directionalLight = document.createElement('a-entity');
    directionalLight.setAttribute('light', {color: '#FFF', intensity: 0.6, castShadow: true});
    directionalLight.setAttribute('position', {x: -0.5, y: 1, z: 1});
    directionalLight.setAttribute('id', 'dirlight');
    el.appendChild(directionalLight);
    el.addEventListener('loaded', function () { done(); });
  });

  test('set environment on the scene', function () {
    var sceneEl = this.sceneEl;
    assert.isNull(sceneEl.object3D.environment);
    sceneEl.setAttribute('reflection', {directionalLight: '#dirlight'});
    assert.isNotNull(sceneEl.object3D.environment);
  });

  test('does not restore environment after removal and VR exit', function () {
    var sceneEl = this.sceneEl;
    sceneEl.setAttribute('reflection', {directionalLight: '#dirlight'});
    sceneEl.removeAttribute('reflection');
    sceneEl.emit('exit-vr');
    assert.isNull(sceneEl.object3D.environment);
  });

  test('does not overwrite a replacement environment after removal', function () {
    var sceneEl = this.sceneEl;
    var environment = new THREE.CubeTexture();
    sceneEl.setAttribute('reflection', {directionalLight: '#dirlight'});
    sceneEl.removeAttribute('reflection');
    sceneEl.object3D.environment = environment;
    sceneEl.emit('exit-vr');
    assert.strictEqual(sceneEl.object3D.environment, environment);
    environment.dispose();
  });

  test('removes both VR event listeners', function () {
    var sceneEl = this.sceneEl;
    sceneEl.setAttribute('reflection', {directionalLight: '#dirlight'});
    var component = sceneEl.components.reflection;
    var spy = this.sinon.spy(sceneEl, 'removeEventListener');
    sceneEl.removeAttribute('reflection');
    assert.ok(spy.calledWith('enter-vr', component.onEnterVR));
    assert.ok(spy.calledWith('exit-vr', component.onExitVR));
  });

});
