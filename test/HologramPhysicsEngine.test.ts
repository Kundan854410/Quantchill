import test from 'node:test';
import assert from 'node:assert/strict';
import { HologramPhysicsEngine } from '../src/services/3d/HologramPhysicsEngine';

test('HologramPhysicsEngine initializes correctly', async () => {
  const engine = new HologramPhysicsEngine({
    mass: 1.0,
    damping: 0.95,
    springConstant: 0.5
  });

  await engine.initialize();

  const position = engine.getPosition();
  assert.equal(position.x, 0);
  assert.equal(position.y, 0);
  assert.equal(position.z, 0);
});

test('HologramPhysicsEngine applies push force correctly', async () => {
  const engine = new HologramPhysicsEngine({
    mass: 1.0,
    damping: 0.95,
    springConstant: 0.5
  });

  await engine.initialize();

  engine.applyPushForce({ x: 5, y: 0, z: 0 });
  const position = engine.updatePosition(0.016); // ~60fps frame time

  assert.ok(position.x > 0, 'Position should move in positive X direction');
});

test('HologramPhysicsEngine applies pull force correctly', async () => {
  const engine = new HologramPhysicsEngine({
    mass: 1.0,
    damping: 0.95,
    springConstant: 0.5
  });

  await engine.initialize();

  engine.applyPullForce({ x: 5, y: 0, z: 0 });
  const position = engine.updatePosition(0.016);

  assert.ok(position.x < 0, 'Position should move in negative X direction');
});

test('HologramPhysicsEngine returns to rest position', async () => {
  const engine = new HologramPhysicsEngine({
    mass: 1.0,
    damping: 0.98,
    springConstant: 0.8
  });

  await engine.initialize();

  engine.applyPushForce({ x: 10, y: 0, z: 0 });

  // Simulate multiple frames to let spring bring it back
  for (let i = 0; i < 100; i++) {
    engine.updatePosition(0.016);
  }

  const position = engine.getPosition();
  const velocity = engine.getVelocity();

  // Should be close to rest position with low velocity
  assert.ok(Math.abs(position.x) < 1, 'Should return close to rest position');
  assert.ok(velocity < 0.5, 'Velocity should be low');
});

test('HologramPhysicsEngine clamps position to bounds', async () => {
  const engine = new HologramPhysicsEngine({
    mass: 0.5, // Lower mass for larger movement
    damping: 0.5, // Lower damping to allow more movement
    springConstant: 0.1 // Lower spring constant
  });

  await engine.initialize();

  // Apply very large force
  for (let i = 0; i < 50; i++) {
    engine.applyPushForce({ x: 100, y: 100, z: 100 });
    engine.updatePosition(0.016);
  }

  const position = engine.getPosition();

  assert.ok(position.x <= 10 && position.x >= -10, 'X should be clamped');
  assert.ok(position.y <= 10 && position.y >= -10, 'Y should be clamped');
  assert.ok(position.z <= 10 && position.z >= -10, 'Z should be clamped');
});

test('HologramPhysicsEngine velocity increases with force', async () => {
  const engine = new HologramPhysicsEngine({
    mass: 1.0,
    damping: 0.95,
    springConstant: 0.5
  });

  await engine.initialize();

  engine.applyPushForce({ x: 2, y: 0, z: 0 });
  engine.updatePosition(0.016);
  const velocity1 = engine.getVelocity();

  engine.applyPushForce({ x: 10, y: 0, z: 0 });
  engine.updatePosition(0.016);
  const velocity2 = engine.getVelocity();

  assert.ok(velocity2 > velocity1, 'Larger force should produce higher velocity');
});
