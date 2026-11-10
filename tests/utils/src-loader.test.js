/* global assert, setup, sinon, suite, teardown, test */
var srcLoader = require('utils/src-loader');

suite('src-loader', function () {
  var requests;
  var xhr;
  var urls = ['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png'];

  function cubemapSrc (faces) {
    return faces.map(function (url) { return 'url(' + url + ')'; }).join(', ');
  }

  function respond (index) {
    requests[index].respond(200, {'Content-Type': 'image/png'}, '');
  }

  setup(function () {
    requests = [];
    xhr = sinon.useFakeXMLHttpRequest();
    xhr.onCreate = function (request) { requests.push(request); };
  });

  teardown(function () {
    xhr.restore();
  });

  test('preserves face order when image checks finish in reverse order', function () {
    var callback = sinon.spy();
    srcLoader.validateCubemapSrc(cubemapSrc(urls), callback);
    [5, 4, 3, 2, 1, 0].forEach(respond);
    assert.equal(callback.callCount, 1);
    assert.deepEqual(callback.firstCall.args[0], urls);
  });

  test('waits for every face even when the last face finishes first', function () {
    var callback = sinon.spy();
    srcLoader.validateCubemapSrc(cubemapSrc(urls), callback);
    [5, 1, 3, 0, 4].forEach(respond);
    assert.equal(callback.callCount, 0);
    respond(2);
    assert.equal(callback.callCount, 1);
    assert.deepEqual(callback.firstCall.args[0], urls);
  });

  test('preserves duplicate face URLs at their own positions', function () {
    var callback = sinon.spy();
    var faces = ['side.png', 'side.png', 'top.png', 'bottom.png', 'front.png', 'back.png'];
    srcLoader.validateCubemapSrc(cubemapSrc(faces), callback);
    [4, 1, 5, 2, 0, 3].forEach(respond);
    assert.equal(callback.callCount, 1);
    assert.deepEqual(callback.firstCall.args[0], faces);
  });

  test('keeps concurrent cubemap validations independent', function () {
    var first = sinon.spy();
    var second = sinon.spy();
    var otherUrls = urls.map(function (url) { return 'other-' + url; });
    srcLoader.validateCubemapSrc(cubemapSrc(urls), first);
    srcLoader.validateCubemapSrc(cubemapSrc(otherUrls), second);
    [11, 0, 10, 2, 9, 4, 8, 1, 7, 5, 6, 3].forEach(respond);
    assert.equal(first.callCount, 1);
    assert.equal(second.callCount, 1);
    assert.deepEqual(first.firstCall.args[0], urls);
    assert.deepEqual(second.firstCall.args[0], otherUrls);
  });

  test('keeps already ordered image checks unchanged', function () {
    var callback = sinon.spy();
    srcLoader.validateCubemapSrc(cubemapSrc(urls), callback);
    [0, 1, 2, 3, 4, 5].forEach(respond);
    assert.equal(callback.callCount, 1);
    assert.deepEqual(callback.firstCall.args[0], urls);
  });
});
