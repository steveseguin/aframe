/* global suite, test */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.resolve(__dirname, '../../src/components/text.js');

// Exercise the unchanged production module with explicitly controlled loader callbacks.
// These adapters test lifecycle ordering, not font parsing or WebGL rendering.
function createFixture (mutateData) {
  const fonts = new Map();
  const images = new Map();
  const events = [];
  const objects = new Map();
  let definition;

  class Texture {
    dispose () { this.disposed = true; }
  }
  class Shader {
    init (data) {
      this.material = {
        map: data.map,
        dispose () { this.disposed = true; }
      };
    }
    update (data) { this.material.map = data.map; }
  }
  class SdfShader extends Shader {}
  SdfShader.prototype.name = 'sdf';
  class MsdfShader extends Shader {}
  MsdfShader.prototype.name = 'msdf';

  const THREE = {
    Texture,
    FrontSide: 0,
    BackSide: 1,
    DoubleSide: 2,
    ImageLoader: class {
      load (src, success) { images.set(src, success); }
    },
    Mesh: class {
      constructor (geometry, material) {
        Object.assign(this, {geometry, material, position: {}, scale: {set () {}}});
      }
    },
    LoaderUtils: {extractUrlBase: src => src.slice(0, src.lastIndexOf('/') + 1)}
  };
  const dependencies = {
    'three-bmfont-text': () => ({
      updates: [],
      update (data) { this.updates.push({...data}); },
      dispose () { this.disposed = true; }
    }),
    'load-bmfont': (src, callback) => fonts.set(src, callback),
    '../core/component': {
      registerComponent (name, component) {
        definition = component;
        return component;
      }
    },
    '../core/shader': {shaders: {sdf: {Shader: SdfShader}, msdf: {Shader: MsdfShader}}},
    '../lib/three': THREE,
    '../utils/': {debug: () => () => {}, extend: Object.assign},
    '../constants': {AFRAME_CDN_ROOT: 'https://fixture.invalid/'}
  };
  vm.runInNewContext(fs.readFileSync(sourcePath, 'utf8'), {
    module: {exports: {}},
    require (name) {
      assert.ok(name in dependencies, name);
      return dependencies[name];
    },
    Promise,
    isFinite
  }, {filename: sourcePath});

  const component = Object.create(definition);
  const defaults = {};
  Object.keys(definition.schema).forEach(key => {
    const property = definition.schema[key];
    defaults[key] = property.default === undefined
      ? (property.type === 'number' ? 0 : '')
      : property.default;
  });
  component.data = {...defaults, font: '/a/font.fnt', value: '123'};
  component.attrName = 'text';
  component.el = {
    setObject3D (name, object) { objects.set(name, object); },
    removeObject3D (name) { objects.delete(name); },
    emit (name, detail) { events.push({name, font: detail.font, fontId: detail.fontObj.id}); },
    getAttribute () { return null; }
  };
  component.init();
  component.update({});

  function font (id) {
    return {
      id,
      pages: ['atlas.png'],
      common: {lineHeight: 12},
      chars: [{id: 49, xadvance: 8, yoffset: 0}]
    };
  }
  async function flush () {
    // Drain both cached font/image Promise continuations without timers or network.
    for (let i = 0; i < 5; i++) { await Promise.resolve(); }
  }
  function change (updates) {
    const oldData = {...component.data};
    if (mutateData) {
      Object.assign(component.data, updates);
    } else {
      component.data = {...component.data, ...updates};
    }
    component.update(oldData);
  }
  function lastUpdate () {
    const updates = component.geometry.updates;
    return updates[updates.length - 1];
  }
  return {component, fonts, images, events, objects, font, flush, change, lastUpdate};
}

suite('text font asynchronous lifecycle', function () {
  test('late bitmap cannot overwrite latest font with in-place data updates', async () => {
    const fixture = createFixture(true);
    fixture.fonts.get('/a/font.fnt')(null, fixture.font('A'));
    await fixture.flush();
    fixture.change({font: '/b/font.fnt'});
    fixture.fonts.get('/b/font.fnt')(null, fixture.font('B'));
    await fixture.flush();
    fixture.images.get('/b/atlas.png')({src: '/b/atlas.png'});
    await fixture.flush();
    fixture.images.get('/a/atlas.png')({src: '/a/atlas.png'});
    await fixture.flush();
    assert.equal(fixture.component.currentFont.id, 'B');
    assert.equal(fixture.component.texture.image.src, '/b/atlas.png');
    assert.equal(fixture.lastUpdate().font.id, 'B');
    assert.equal(fixture.events.length, 1);
  });

  test('late metadata cannot overwrite the latest font', async () => {
    const fixture = createFixture();
    fixture.change({font: '/b/font.fnt'});
    fixture.fonts.get('/b/font.fnt')(null, fixture.font('B'));
    await fixture.flush();
    fixture.images.get('/b/atlas.png')({src: '/b/atlas.png'});
    await fixture.flush();
    const staleFont = fixture.font('A');
    staleFont.pages = ['old-atlas.png'];
    fixture.fonts.get('/a/font.fnt')(null, staleFont);
    await fixture.flush();
    assert.equal(fixture.component.currentFont.id, 'B');
    assert.equal(fixture.lastUpdate().font.id, 'B');
    assert.equal(fixture.images.size, 1);
    assert.equal(fixture.events.length, 1);
  });

  test('A to B to A shares cached loads but applies only the latest request', async () => {
    const fixture = createFixture();
    fixture.change({font: '/b/font.fnt'});
    fixture.change({font: '/a/font.fnt'});
    fixture.fonts.get('/a/font.fnt')(null, fixture.font('A'));
    await fixture.flush();
    fixture.images.get('/a/atlas.png')({src: '/a/atlas.png'});
    await fixture.flush();
    fixture.fonts.get('/b/font.fnt')(null, fixture.font('B'));
    await fixture.flush();
    if (fixture.images.has('/b/atlas.png')) {
      fixture.images.get('/b/atlas.png')({src: '/b/atlas.png'});
      await fixture.flush();
    }
    assert.equal(fixture.component.currentFont.id, 'A');
    assert.equal(fixture.component.texture.image.src, '/a/atlas.png');
    assert.equal(fixture.events.length, 1);
  });

  test('removal before metadata prevents atlas requests and later state mutation', async () => {
    const fixture = createFixture();
    fixture.component.remove();
    fixture.fonts.get('/a/font.fnt')(null, fixture.font('A'));
    await fixture.flush();
    assert.equal(fixture.images.size, 0);
    assert.equal(fixture.events.length, 0);
    assert.equal(fixture.component.currentFont, undefined);
    assert.equal(fixture.objects.size, 0);
  });

  test('removal before bitmap completion stays removed', async () => {
    const fixture = createFixture();
    fixture.fonts.get('/a/font.fnt')(null, fixture.font('A'));
    await fixture.flush();
    fixture.component.remove();
    fixture.images.get('/a/atlas.png')({src: '/a/atlas.png'});
    await fixture.flush();
    assert.equal(fixture.events.length, 0);
    assert.equal(fixture.component.geometry, null);
    assert.equal(fixture.component.texture, null);
    assert.equal(fixture.objects.size, 0);
  });

  test('normal request uses latest value after a value-only update', async () => {
    const fixture = createFixture();
    fixture.fonts.get('/a/font.fnt')(null, fixture.font('A'));
    await fixture.flush();
    fixture.change({value: 'latest'});
    fixture.images.get('/a/atlas.png')({src: '/a/atlas.png'});
    await fixture.flush();
    assert.equal(fixture.component.currentFont.id, 'A');
    assert.equal(fixture.lastUpdate().text, 'latest');
    assert.equal(fixture.events.length, 1);
    assert.equal(fixture.objects.size, 1);
  });
});
