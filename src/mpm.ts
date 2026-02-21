export const n_grid = 64;
export const num_particles = 12000;
const dx = 1.0 / n_grid;
const inv_dx = 1.0 / dx;
const dt = 2e-4;
const p_vol = (dx * 0.5) ** 2;
const p_rho = 1;
const p_mass = p_vol * p_rho;
const gravity = 9.8;
const bound = 3;
const E = 1000; // Bulk modulus

export class FluidMPM {
  x: Float32Array;
  v: Float32Array;
  C: Float32Array;
  J: Float32Array;
  
  grid_v: Float32Array;
  grid_m: Float32Array;

  mouse_x: number = -1;
  mouse_y: number = -1;
  mouse_active: boolean = false;

  constructor() {
    this.x = new Float32Array(num_particles * 2);
    this.v = new Float32Array(num_particles * 2);
    this.C = new Float32Array(num_particles * 4);
    this.J = new Float32Array(num_particles).fill(1);
    
    this.grid_v = new Float32Array(n_grid * n_grid * 2);
    this.grid_m = new Float32Array(n_grid * n_grid);

    // Initialize particles in a block
    let p = 0;
    for (let i = 0; i < num_particles; i++) {
      this.x[p * 2] = 0.15 + Math.random() * 0.7;
      this.x[p * 2 + 1] = 0.15 + Math.random() * 0.7;
      this.v[p * 2] = 0;
      this.v[p * 2 + 1] = 0;
      p++;
    }
  }

  step() {
    const x = this.x;
    const v = this.v;
    const C = this.C;
    const J = this.J;
    const grid_v = this.grid_v;
    const grid_m = this.grid_m;

    grid_v.fill(0);
    grid_m.fill(0);

    // P2G
    for (let p = 0; p < num_particles; p++) {
      const p2 = p * 2;
      const p4 = p * 4;
      const px = x[p2];
      const py = x[p2 + 1];
      
      const cx = px * inv_dx;
      const cy = py * inv_dx;
      
      const bx = Math.floor(cx - 0.5);
      const by = Math.floor(cy - 0.5);
      
      const fx = cx - bx;
      const fy = cy - by;
      
      const w00 = 0.5 * (1.5 - fx) * (1.5 - fx);
      const w01 = 0.75 - (fx - 1) * (fx - 1);
      const w02 = 0.5 * (fx - 0.5) * (fx - 0.5);
      
      const w10 = 0.5 * (1.5 - fy) * (1.5 - fy);
      const w11 = 0.75 - (fy - 1) * (fy - 1);
      const w12 = 0.5 * (fy - 0.5) * (fy - 0.5);
      
      const pressure = Math.min(0.1, E * (J[p] - 1));
      const stress = -pressure * 4 * dt * inv_dx * inv_dx * p_vol;
      
      const vp_x = v[p2];
      const vp_y = v[p2 + 1];
      const cp0 = C[p4];
      const cp1 = C[p4 + 1];
      const cp2 = C[p4 + 2];
      const cp3 = C[p4 + 3];

      const affine0 = stress + p_mass * cp0;
      const affine1 = p_mass * cp1;
      const affine2 = p_mass * cp2;
      const affine3 = stress + p_mass * cp3;

      for (let i = 0; i < 3; i++) {
        const weight_x = i === 0 ? w00 : i === 1 ? w01 : w02;
        const dpos_x = (i - fx) * dx;
        const base_idx = (bx + i) * n_grid + by;
        
        for (let j = 0; j < 3; j++) {
          const weight_y = j === 0 ? w10 : j === 1 ? w11 : w12;
          const weight = weight_x * weight_y;
          const dpos_y = (j - fy) * dx;
          
          const idx = base_idx + j;
          const idx2 = idx * 2;
          
          grid_m[idx] += weight * p_mass;
          grid_v[idx2] += weight * (p_mass * vp_x + affine0 * dpos_x + affine1 * dpos_y);
          grid_v[idx2 + 1] += weight * (p_mass * vp_y + affine2 * dpos_x + affine3 * dpos_y);
        }
      }
    }

    // Grid update
    for (let i = 0; i < n_grid; i++) {
      const i_bound_low = i < bound;
      const i_bound_high = i > n_grid - bound;
      for (let j = 0; j < n_grid; j++) {
        const idx = i * n_grid + j;
        if (grid_m[idx] > 0) {
          const idx2 = idx * 2;
          const inv_m = 1.0 / grid_m[idx];
          grid_v[idx2] *= inv_m;
          grid_v[idx2 + 1] *= inv_m;
          
          grid_v[idx2 + 1] -= gravity * dt;
          
          if (i_bound_low && grid_v[idx2] < 0) grid_v[idx2] = 0;
          if (i_bound_high && grid_v[idx2] > 0) grid_v[idx2] = 0;
          if (j < bound && grid_v[idx2 + 1] < 0) grid_v[idx2 + 1] = 0;
          if (j > n_grid - bound && grid_v[idx2 + 1] > 0) grid_v[idx2 + 1] = 0;
        }
      }
    }

    // G2P
    for (let p = 0; p < num_particles; p++) {
      const p2 = p * 2;
      const p4 = p * 4;
      const px = x[p2];
      const py = x[p2 + 1];
      
      const cx = px * inv_dx;
      const cy = py * inv_dx;
      
      const bx = Math.floor(cx - 0.5);
      const by = Math.floor(cy - 0.5);
      
      const fx = cx - bx;
      const fy = cy - by;
      
      const w00 = 0.5 * (1.5 - fx) * (1.5 - fx);
      const w01 = 0.75 - (fx - 1) * (fx - 1);
      const w02 = 0.5 * (fx - 0.5) * (fx - 0.5);
      
      const w10 = 0.5 * (1.5 - fy) * (1.5 - fy);
      const w11 = 0.75 - (fy - 1) * (fy - 1);
      const w12 = 0.5 * (fy - 0.5) * (fy - 0.5);
      
      let new_vx = 0;
      let new_vy = 0;
      let c0 = 0, c1 = 0, c2 = 0, c3 = 0;
      
      for (let i = 0; i < 3; i++) {
        const weight_x = i === 0 ? w00 : i === 1 ? w01 : w02;
        const dpos_x = i - fx;
        const base_idx = (bx + i) * n_grid + by;
        
        for (let j = 0; j < 3; j++) {
          const weight_y = j === 0 ? w10 : j === 1 ? w11 : w12;
          const weight = weight_x * weight_y;
          const dpos_y = j - fy;
          
          const idx = base_idx + j;
          const idx2 = idx * 2;
          const g_vx = grid_v[idx2];
          const g_vy = grid_v[idx2 + 1];
          
          new_vx += weight * g_vx;
          new_vy += weight * g_vy;
          
          const w_inv_dx = 4 * inv_dx * weight;
          c0 += w_inv_dx * g_vx * dpos_x;
          c1 += w_inv_dx * g_vx * dpos_y;
          c2 += w_inv_dx * g_vy * dpos_x;
          c3 += w_inv_dx * g_vy * dpos_y;
        }
      }
      
      C[p4] = c0;
      C[p4 + 1] = c1;
      C[p4 + 2] = c2;
      C[p4 + 3] = c3;
      
      v[p2] = new_vx;
      v[p2 + 1] = new_vy;
      
      if (this.mouse_active) {
        const mdx = x[p2] - this.mouse_x;
        const mdy = x[p2 + 1] - this.mouse_y;
        const distSq = mdx * mdx + mdy * mdy;
        if (distSq < 0.0025 && distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const force = (0.05 - dist) * 200;
          v[p2] += (mdx / dist) * force;
          v[p2 + 1] += (mdy / dist) * force;
        }
      }

      x[p2] += v[p2] * dt;
      x[p2 + 1] += v[p2 + 1] * dt;
      
      // Clamp to bounds just in case
      if (x[p2] < bound * dx) x[p2] = bound * dx;
      if (x[p2] > 1 - bound * dx) x[p2] = 1 - bound * dx;
      if (x[p2 + 1] < bound * dx) x[p2 + 1] = bound * dx;
      if (x[p2 + 1] > 1 - bound * dx) x[p2 + 1] = 1 - bound * dx;

      J[p] *= 1 + dt * (C[p4] + C[p4 + 3]);
    }
  }
}
