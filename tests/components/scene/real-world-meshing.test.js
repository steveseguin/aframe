/* global assert, setup, suite, test */
var Component = require('components/scene/real-world-meshing').Component;

suite('real-world-meshing', function () {
  var component;
  var sceneEl;

  setup(function () {
    component = Object.create(Component.prototype);
    sceneEl = component.el = document.createElement('div');
    sceneEl.renderer = {xr: {}};
    sceneEl.frame = {detectedMeshes: new Set(), detectedPlanes: new Set()};
    component.data = {meshesEnabled: true, planesEnabled: true, filterLabels: []};
    component.meshEntities = [];
    component.initWorldMeshEntity = function () {};
  });

  function detectMesh (label) {
    var mesh = {semanticLabel: label || 'table', lastChangedTime: 1};
    sceneEl.frame.detectedMeshes.add(mesh);
    component.detectMeshes();
    return mesh;
  }

  function assertEmpty () {
    assert.equal(sceneEl.children.length, 0);
    assert.equal(component.meshEntities.length, 0);
  }

  test('retains the entity for a detected mesh', function () {
    detectMesh();
    var el = component.meshEntities[0].el;
    component.detectMeshes();
    assert.equal(component.meshEntities.length, 1);
    assert.strictEqual(component.meshEntities[0].el, el);
    assert.strictEqual(sceneEl.firstChild, el);
  });

  test('removes the entity when its mesh is no longer detected', function () {
    var mesh = detectMesh();
    sceneEl.frame.detectedMeshes.delete(mesh);
    component.detectMeshes();
    assertEmpty();
  });

  test('removes the entity when its plane is no longer detected', function () {
    sceneEl.frame.detectedPlanes.add({semanticLabel: 'table', lastChangedTime: 1});
    component.detectMeshes();
    sceneEl.frame.detectedPlanes.clear();
    component.detectMeshes();
    assertEmpty();
  });

  test('removes entities when meshes are disabled', function () {
    detectMesh();
    component.data.meshesEnabled = false;
    component.detectMeshes();
    assertEmpty();
  });

  test('removes entities when planes are disabled', function () {
    sceneEl.frame.detectedPlanes.add({semanticLabel: 'table', lastChangedTime: 1});
    component.detectMeshes();
    component.data.planesEnabled = false;
    component.detectMeshes();
    assertEmpty();
  });

  test('removes an existing entity excluded by filterLabels', function () {
    detectMesh('table');
    component.data.filterLabels = ['wall'];
    component.detectMeshes();
    assertEmpty();
  });

  test('retains detected entities and creates new ones after removal', function () {
    var removedMesh = detectMesh();
    var retainedMesh = detectMesh();
    var retainedEl = component.meshEntities[1].el;
    var newMesh = {semanticLabel: 'table', lastChangedTime: 1};
    sceneEl.frame.detectedMeshes.delete(removedMesh);
    sceneEl.frame.detectedMeshes.add(newMesh);
    component.detectMeshes();
    assert.equal(sceneEl.children.length, 2);
    assert.equal(component.meshEntities.length, 2);
    assert.strictEqual(component.meshEntities[0].mesh, retainedMesh);
    assert.strictEqual(component.meshEntities[0].el, retainedEl);
    assert.strictEqual(component.meshEntities[1].mesh, newMesh);
  });

  test('supports repeated empty detection and later reappearance', function () {
    var mesh = detectMesh();
    sceneEl.frame.detectedMeshes.clear();
    component.detectMeshes();
    component.detectMeshes();
    assertEmpty();
    sceneEl.frame.detectedMeshes.add(mesh);
    component.detectMeshes();
    assert.equal(sceneEl.children.length, 1);
    assert.equal(component.meshEntities.length, 1);
  });
});
