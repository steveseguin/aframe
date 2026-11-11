/* global AFRAME, assert, setup, suite, teardown, test */

suite('device-orientation-permission-ui', function () {
  var component;
  var originalDeviceOrientationEvent;
  var requestPermission;

  function flushPromises () {
    return Promise.resolve().then(function () {});
  }

  setup(function () {
    originalDeviceOrientationEvent = Object.getOwnPropertyDescriptor(window, 'DeviceOrientationEvent');
    requestPermission = this.sinon.stub();
    Object.defineProperty(window, 'DeviceOrientationEvent', {
      configurable: true,
      value: {requestPermission: requestPermission}
    });
    component = Object.create(AFRAME.components['device-orientation-permission-ui'].Component.prototype);
    component.data = {
      enabled: true,
      denyButtonText: 'Deny',
      allowButtonText: 'Allow',
      deviceMotionMessage: 'Motion permission'
    };
    component.el = document.createElement('div');
    component.el.emit = this.sinon.spy();
    // Isolate permission responses from the test page's HTTP/HTTPS origin.
    component.showHTTPAlert = function () {};
  });

  teardown(function () {
    if (originalDeviceOrientationEvent) {
      Object.defineProperty(window, 'DeviceOrientationEvent', originalDeviceOrientationEvent);
    } else {
      delete window.DeviceOrientationEvent;
    }
  });

  test('reports an already granted permission during init', function () {
    requestPermission.returns(Promise.resolve('granted'));
    component.init();
    return flushPromises().then(function () {
      assert.ok(component.permissionGranted);
      assert.ok(component.el.emit.calledOnce);
      assert.ok(component.el.emit.calledWith('deviceorientationpermissiongranted'));
      assert.equal(component.el.children.length, 0);
    });
  });

  test('does not report a resolved denial as granted during init', function () {
    requestPermission.returns(Promise.resolve('denied'));
    component.init();
    return flushPromises().then(function () {
      assert.notOk(component.permissionGranted);
      assert.ok(component.el.emit.calledOnce);
      assert.ok(component.el.emit.calledWith('deviceorientationpermissionrejected'));
      assert.notOk(component.el.emit.calledWith('deviceorientationpermissiongranted'));
      assert.equal(component.el.children.length, 0);
    });
  });

  test('still shows the dialog when a request needs a user gesture', function () {
    requestPermission.returns(Promise.reject(new Error('User gesture required')));
    component.init();
    return flushPromises().then(function () {
      assert.notOk(component.permissionGranted);
      assert.notOk(component.el.emit.called);
      assert.equal(component.el.children.length, 1);
    });
  });

  test('does not request permission when disabled', function () {
    component.data.enabled = false;
    component.init();
    assert.notOk(requestPermission.called);
    assert.notOk(component.el.emit.called);
  });

  test('supports browsers without a permission request API', function () {
    delete window.DeviceOrientationEvent.requestPermission;
    component.init();
    assert.ok(component.permissionGranted);
    assert.notOk(component.el.emit.called);
  });

  ['granted', 'denied'].forEach(function (response) {
    test('preserves the allow-button result for ' + response, function () {
      requestPermission.returns(Promise.reject(new Error('User gesture required')));
      component.init();
      return flushPromises().then(function () {
        requestPermission.returns(Promise.resolve(response));
        component.onDeviceMotionDialogAllowClicked();
        return flushPromises();
      }).then(function () {
        assert.equal(!!component.permissionGranted, response === 'granted');
        assert.ok(component.el.emit.calledWith('deviceorientationpermissionrequested'));
        assert.ok(component.el.emit.calledWith(response === 'granted'
          ? 'deviceorientationpermissiongranted'
          : 'deviceorientationpermissionrejected'));
        assert.equal(component.el.children.length, 0);
      });
    });
  });
});
