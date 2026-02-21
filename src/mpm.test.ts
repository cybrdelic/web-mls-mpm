import { test } from 'node:test';
import assert from 'node:assert';
import { FluidMPM, num_particles } from './mpm.js';

test('Fluid should remain relatively incompressible under gravity', () => {
  const mpm = new FluidMPM();
  
  // Run simulation for a while to let it settle under gravity
  // 5000 steps at dt=2e-4 is 1 second.
  for (let i = 0; i < 5000; i++) {
    mpm.step();
  }
  
  let minJ = 1.0;
  let maxJ = 1.0;
  let avgJ = 0;
  
  for (let i = 0; i < num_particles; i++) {
    const j = mpm.J[i];
    if (j < minJ) minJ = j;
    if (j > maxJ) maxJ = j;
    avgJ += j;
  }
  avgJ /= num_particles;
  
  console.log(`Min J: ${minJ}, Max J: ${maxJ}, Avg J: ${avgJ}`);
  
  // If the stress tensor is missing the factor of 4, minJ will drop to ~0.5 or lower.
  // With the correct stress tensor, it should stay above 0.8.
  assert.ok(minJ > 0.8, `Fluid compressed too much! Minimum J: ${minJ}. Expected > 0.8. Check stress tensor calculation.`);
});

test('Stress tensor resists compression but allows tension up to a limit', () => {
  const mpm = new FluidMPM();
  
  // Set up a single particle in the middle
  mpm.x[0] = 0.5;
  mpm.x[1] = 0.5;
  mpm.v[0] = 0;
  mpm.v[1] = 0;
  
  // Force it to be highly compressed
  mpm.J[0] = 0.5;
  
  // Move other particles far away so they don't interfere
  for (let i = 1; i < num_particles; i++) {
    mpm.x[i * 2] = 0.1;
    mpm.x[i * 2 + 1] = 0.1;
  }
  
  mpm.step();
  
  // The particle is at (0.5, 0.5). Grid size is 64x64.
  // So it's at grid cell (32, 32).
  // The nodes around it should have velocities pointing away from it.
  // Node (33, 32) should have positive x velocity.
  // Node (31, 32) should have negative x velocity.
  
  const idxRight = 33 * 64 + 32;
  const idxLeft = 31 * 64 + 32;
  
  const vRightX = mpm.grid_v[idxRight * 2];
  const vLeftX = mpm.grid_v[idxLeft * 2];
  
  assert.ok(vRightX > 0, `Right node should be pushed right, got ${vRightX}`);
  assert.ok(vLeftX < 0, `Left node should be pushed left, got ${vLeftX}`);
  
  // Now test tension (expansion)
  const mpm2 = new FluidMPM();
  mpm2.x[0] = 0.5;
  mpm2.x[1] = 0.5;
  mpm2.v[0] = 0;
  mpm2.v[1] = 0;
  
  // Force it to be highly expanded
  mpm2.J[0] = 2.0;
  
  for (let i = 1; i < num_particles; i++) {
    mpm2.x[i * 2] = 0.1;
    mpm2.x[i * 2 + 1] = 0.1;
  }
  
  mpm2.step();
  
  const vRightX2 = mpm2.grid_v[idxRight * 2];
  const vLeftX2 = mpm2.grid_v[idxLeft * 2];
  
  // It should pull inwards, but weakly (clamped to 0.1 tension)
  assert.ok(vRightX2 < 0, `Right node should be pulled left, got ${vRightX2}`);
  assert.ok(vLeftX2 > 0, `Left node should be pulled right, got ${vLeftX2}`);
  
  // The push outward (compression resistance) should be much stronger than the pull inward (tension limit)
  assert.ok(Math.abs(vRightX) > Math.abs(vRightX2) * 10, 'Compression resistance should be much stronger than tension limit');
});
