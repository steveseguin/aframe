/* global assert, process, setup, suite, test, THREE */
const entityFactory = require('../helpers').entityFactory;

suite('tracked-controls-webxr', function () {
  var component;
  var controller;
  var el;
  var system;
  var standingMatrix = new THREE.Matrix4();

  setup(function (done) {
    standingMatrix.identity();
    el = entityFactory();
    setTimeout(() => {
      el.sceneEl.addEventListener('loaded', function () {
        system = el.sceneEl.systems['tracked-controls-webxr'];
        el.components['tracked-controls'] = {};
        controller = {
          handedness: 'left',
          profiles: ['test']
        };
        system.controllers = [controller];
        el.setAttribute('tracked-controls-webxr', {'hand': 'right'});
        component = el.components['tracked-controls-webxr'];
        component.controller = undefined;
        done();
      });
    });
  });

  suite('updateGamepad', function () {
    test('matches controller with same hand', function () {
      assert.strictEqual(component.controller, undefined);
      el.setAttribute('tracked-controls-webxr', {id: 'test', hand: 'left'});
      component.updateController();
      assert.equal(component.controller, controller);
    });

    test('matches generic controller', function () {
      controller = {
        handedness: 'left',
        profiles: ['generic-touchpad']
      };
      system.controllers = [controller];
      assert.strictEqual(component.controller, undefined);
      el.setAttribute('tracked-controls-webxr',
        {id: 'generic', hand: 'left', iterateControllerProfiles: true});
      component.updateController();
      assert.equal(component.controller, controller);
    });
  });

  suite('autoHide', function () {
    test('updates visibility when the matched controller disconnects and reconnects', function () {
      el.setAttribute('tracked-controls-webxr', {id: 'test', hand: 'left'});
      assert.strictEqual(el.object3D.visible, true);
      system.controllers = [];
      component.updateController();
      assert.strictEqual(el.object3D.visible, false);
      system.controllers = [controller];
      component.updateController();
      assert.strictEqual(el.object3D.visible, true);
    });

    test('preserves application visibility when autoHide is false', function () {
      el.setAttribute('tracked-controls-webxr', {autoHide: false, id: 'test', hand: 'left'});
      el.object3D.visible = false;
      component.updateController();
      assert.strictEqual(el.object3D.visible, false);
      el.object3D.visible = true;
      system.controllers = [];
      component.updateController();
      assert.strictEqual(el.object3D.visible, true);
    });
  });

  suite('tick', function () {
    test('updates pose and buttons even if mesh is not defined', function () {
      el.sceneEl.frame = {
        getPose: function () {
          var euler = new THREE.Euler(Math.PI / 2, 0, 0);
          return {
            transform: {
              matrix: new THREE.Matrix4().compose(
                new THREE.Vector3(1, 2, 3),
                new THREE.Quaternion().setFromEuler(euler),
                new THREE.Vector3(1, 1, 1)).elements
            }
          };
        }
      };
      component.system.referenceSpace = {};
      component.controller = {};
      component.tick();
      assert.shallowDeepEqual(component.el.getAttribute('position'), {x: 1, y: 2, z: 3});
      assert.shallowDeepEqual(Math.round(component.el.getAttribute('rotation').x), 90);
    });
  });
});
