var registerSystem = require('../core/system').registerSystem;

registerSystem('obb-collider', {
  schema: {
    showColliders: {default: false}
  },

  init: function () {
    this.collisions = [];
    this.colliderEls = [];
  },

  addCollider: function (colliderEl) {
    this.colliderEls.push(colliderEl);
    if (this.data.showColliders) {
      colliderEl.components['obb-collider'].showCollider();
    } else {
      colliderEl.components['obb-collider'].hideCollider();
    }
    this.tick = this.detectCollisions;
  },

  removeCollider: function (colliderEl) {
    var colliderEls = this.colliderEls;
    var elIndex = colliderEls.indexOf(colliderEl);
    var collisions = this.collisions;
    var endedCollisions = [];
    var i;
    colliderEl.components['obb-collider'].hideCollider();
    if (elIndex > -1) { colliderEls.splice(elIndex, 1); }
    if (colliderEls.length === 0) { this.tick = undefined; }

    // Remove contacts before events can remove another collider.
    this.collisions = [];
    for (i = 0; i < collisions.length; i++) {
      if (collisions[i].componentA.el === colliderEl ||
          collisions[i].componentB.el === colliderEl) {
        endedCollisions.push(collisions[i]);
      } else {
        this.collisions.push(collisions[i]);
      }
    }
    for (i = 0; i < endedCollisions.length; i++) {
      this.emitCollisionEnded(endedCollisions[i]);
    }
  },

  registerCollision: function (componentA, componentB) {
    var collisions = this.collisions;
    var existingCollision = false;
    var boundingBoxA = componentA.obb;
    var boundingBoxB = componentB.obb;
    var collisionMeshA = componentA.renderColliderMesh;
    var collisionMeshB = componentB.renderColliderMesh;
    if (collisionMeshA) { collisionMeshA.material.color.set(0xff0000); }
    if (collisionMeshB) { collisionMeshB.material.color.set(0xff0000); }
    for (var i = 0; i < collisions.length; i++) {
      if (collisions[i].componentA.obb === boundingBoxA && collisions[i].componentB.obb === boundingBoxB ||
          collisions[i].componentA.obb === boundingBoxB && collisions[i].componentB.obb === boundingBoxA) {
        existingCollision = true;
        collisions[i].detected = true;
        break;
      }
    }
    if (!existingCollision) {
      collisions.push({
        componentA: componentA,
        componentB: componentB,
        detected: true
      });
      componentA.el.emit('obbcollisionstarted', {trackedObject3D: componentA.trackedObject3D, withEl: componentB.el});
      componentB.el.emit('obbcollisionstarted', {trackedObject3D: componentB.trackedObject3D, withEl: componentA.el});
    }
  },

  resetCollisions: function () {
    var collisions = this.collisions;
    for (var i = 0; i < collisions.length; i++) {
      collisions[i].detected = false;
    }
  },

  clearCollisions: function () {
    var collisions = this.collisions;
    var detectedCollisions = [];
    var endedCollisions = [];
    var i;
    for (i = 0; i < collisions.length; i++) {
      if (!collisions[i].detected) {
        endedCollisions.push(collisions[i]);
      } else {
        detectedCollisions.push(collisions[i]);
      }
    }
    // Publish the remaining contacts before events can remove another collider.
    this.collisions = detectedCollisions;
    for (i = 0; i < endedCollisions.length; i++) {
      this.emitCollisionEnded(endedCollisions[i]);
    }
  },

  emitCollisionEnded: function (collision) {
    var componentA = collision.componentA;
    var componentB = collision.componentB;
    var collisionMeshA = componentA.renderColliderMesh;
    var collisionMeshB = componentB.renderColliderMesh;

    if (collisionMeshA) { collisionMeshA.material.color.set(0x00ff00); }
    componentA.el.emit('obbcollisionended', {trackedObject3D: this.trackedObject3D, withEl: componentB.el});

    if (collisionMeshB) { collisionMeshB.material.color.set(0x00ff00); }
    componentB.el.emit('obbcollisionended', {trackedObject3D: this.trackedObject3D, withEl: componentA.el});
  },

  detectCollisions: function () {
    var boxA;
    var boxB;
    var componentA;
    var componentB;
    var colliderEls = this.colliderEls;
    if (colliderEls.length < 2) { return; }
    this.resetCollisions();
    for (var i = 0; i < colliderEls.length; i++) {
      componentA = colliderEls[i].components['obb-collider'];
      boxA = colliderEls[i].components['obb-collider'].obb;
      // ignore bounding box with 0 volume.
      if (boxA.halfSize.x === 0 || boxA.halfSize.y === 0 || boxA.halfSize.z === 0) {
        continue;
      }
      for (var j = i + 1; j < colliderEls.length; j++) {
        componentB = colliderEls[j].components['obb-collider'];
        boxB = componentB.obb;
        // ignore bounding box with 0 volume.
        if (boxB.halfSize.x === 0 || boxB.halfSize.y === 0 || boxB.halfSize.z === 0) {
          continue;
        }
        if (boxA.intersectsOBB(boxB)) {
          this.registerCollision(componentA, componentB);
        }
      }
    }
    this.clearCollisions();
  }
});
