var registerComponent = require('../core/component').registerComponent;
var THREE = require('../lib/three');
var utils = require('../utils/');
var warn = utils.debug('components:gltf-model:warn');

/**
 * glTF model loader.
 */
module.exports.Component = registerComponent('gltf-model', {
  schema: {type: 'model'},

  init: function () {
    var self = this;
    var dracoLoader = this.system.getDRACOLoader();
    var meshoptDecoder = this.system.getMeshoptDecoder();
    var ktxLoader = this.system.getKTX2Loader();
    this.model = null;
    this.loadRequest = null;
    this.loader = new THREE.GLTFLoader();
    if (dracoLoader) {
      this.loader.setDRACOLoader(dracoLoader);
    }
    if (meshoptDecoder) {
      this.ready = meshoptDecoder.then(function (meshoptDecoder) {
        self.loader.setMeshoptDecoder(meshoptDecoder);
      });
    } else {
      this.ready = Promise.resolve();
    }
    if (ktxLoader) {
      this.loader.setKTX2Loader(ktxLoader);
    }
  },

  update: function () {
    var self = this;
    var el = this.el;
    var src = this.data;
    var request;

    if (!src) {
      this.loadRequest = null;
      return;
    }

    this.remove();
    // Identify this update even if a later update reuses the same URL.
    request = this.loadRequest = {};

    this.ready.then(function () {
      if (self.loadRequest !== request) { return; }
      self.loader.load(src, function gltfLoaded (gltfModel) {
        if (self.loadRequest !== request) { return; }
        self.model = gltfModel.scene || gltfModel.scenes[0];
        self.model.animations = gltfModel.animations;

        el.setObject3D('mesh', self.model);
        el.emit('model-loaded', {format: 'gltf', model: self.model});
      }, undefined /* onProgress */, function gltfFailed (error) {
        if (self.loadRequest !== request) { return; }
        var message = (error && error.message) ? error.message : 'Failed to load glTF model';
        warn(message);
        el.emit('model-error', {format: 'gltf', src: src});
      });
    });
  },

  remove: function () {
    this.loadRequest = null;
    if (!this.model) { return; }
    this.el.removeObject3D('mesh');
  }
});
