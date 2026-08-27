import type {
  Robot,
  TelemetryBatch,
  TelemetryReading,
} from '@olivaw/contracts';
import { robots as defaultRobots } from '@olivaw/contracts/fixtures';
import { sites } from '@olivaw/contracts/fixtures';
import { SeededRandom, type RandomSource } from './random.js';

interface RobotState {
  sequence: number;
  x: number;
  y: number;
  heading: number;
  speedMps: number;
  batteryPercent: number;
  task: string;
  fault?: string;
  disconnectedTicks: number;
  chargerX: number;
  chargerY: number;
}

export interface SimulatorOptions {
  seed?: number;
  robots?: readonly Robot[];
  random?: RandomSource;
  initialBatteryPercent?: number;
}

const tasks = [
  'Moving inventory',
  'Delivering tote',
  'Returning to staging',
  'Cycle count',
];

export class SimulatorEngine {
  readonly #robots: readonly Robot[];
  readonly #random: RandomSource;
  readonly #states = new Map<string, RobotState>();

  constructor(options: SimulatorOptions = {}) {
    this.#robots = options.robots ?? defaultRobots;
    this.#random = options.random ?? new SeededRandom(options.seed ?? 42);
    for (const robot of this.#robots) {
      const site = sites.find((candidate) => candidate.id === robot.siteId);
      const charger = site?.features.find(
        (feature) => feature.type === 'charger',
      );
      this.#states.set(robot.id, {
        sequence: 0,
        x: 10 + this.#random.next() * 80,
        y: 10 + this.#random.next() * 70,
        heading: this.#random.next() * 360,
        speedMps: 0.6 + this.#random.next() * 1.2,
        batteryPercent:
          options.initialBatteryPercent ?? 30 + this.#random.next() * 70,
        task:
          tasks[Math.floor(this.#random.next() * tasks.length)] ?? tasks[0]!,
        disconnectedTicks: 0,
        chargerX: charger ? charger.x + charger.width / 2 : 50,
        chargerY: charger ? charger.y + charger.height / 2 : 50,
      });
    }
  }

  tick(observedAt = new Date()): TelemetryBatch {
    const readings: TelemetryReading[] = [];
    for (const robot of this.#robots) {
      const state = this.#states.get(robot.id)!;
      this.#advanceState(state);
      if (state.disconnectedTicks > 0) {
        state.disconnectedTicks -= 1;
        continue;
      }
      state.sequence += 1;
      readings.push({
        robotId: robot.id,
        sequence: state.sequence,
        observedAt: observedAt.toISOString(),
        batteryPercent: Number(state.batteryPercent.toFixed(2)),
        position: {
          x: Number(state.x.toFixed(2)),
          y: Number(state.y.toFixed(2)),
          heading: Number(state.heading.toFixed(2)),
        },
        speedMps: Number(state.speedMps.toFixed(2)),
        task: state.task,
        ...(state.fault ? { fault: state.fault } : {}),
      });
    }
    return { readings };
  }

  #advanceState(state: RobotState): void {
    if (state.disconnectedTicks === 0 && this.#random.next() < 0.0015) {
      state.disconnectedTicks = 8 + Math.floor(this.#random.next() * 16);
    }

    if (state.task === 'Charging') {
      state.speedMps = 0;
      state.batteryPercent = Math.min(100, state.batteryPercent + 1.2);
      if (state.batteryPercent >= 90) state.task = 'Moving inventory';
      this.#updateFault(state);
      return;
    }

    if (state.task === 'Returning to charger') {
      const deltaX = state.chargerX - state.x;
      const deltaY = state.chargerY - state.y;
      const distance = Math.hypot(deltaX, deltaY);
      const step = Math.min(distance, 1.2 * 0.35);
      state.heading =
        ((Math.atan2(deltaY, deltaX) * 180) / Math.PI + 360) % 360;
      state.speedMps = step / 0.35;
      if (distance <= step) {
        state.x = state.chargerX;
        state.y = state.chargerY;
        state.speedMps = 0;
        state.task = 'Charging';
      } else {
        state.x += (deltaX / distance) * step;
        state.y += (deltaY / distance) * step;
        state.batteryPercent = Math.max(0, state.batteryPercent - 0.01);
      }
      this.#updateFault(state);
      return;
    }

    state.heading =
      (state.heading + (this.#random.next() - 0.5) * 18 + 360) % 360;
    state.speedMps = Math.max(
      0.2,
      Math.min(2.2, state.speedMps + (this.#random.next() - 0.5) * 0.25),
    );
    const radians = (state.heading * Math.PI) / 180;
    state.x += Math.cos(radians) * state.speedMps * 0.35;
    state.y += Math.sin(radians) * state.speedMps * 0.35;

    if (state.x < 4 || state.x > 96) {
      state.x = Math.max(4, Math.min(96, state.x));
      state.heading = (180 - state.heading + 360) % 360;
    }
    if (state.y < 5 || state.y > 94) {
      state.y = Math.max(5, Math.min(94, state.y));
      state.heading = (360 - state.heading) % 360;
    }

    state.batteryPercent = Math.max(
      0,
      state.batteryPercent - 0.025 - state.speedMps * 0.006,
    );
    if (state.batteryPercent < 8) state.task = 'Returning to charger';

    this.#updateFault(state);
    if (state.task !== 'Returning to charger' && this.#random.next() < 0.003) {
      state.task =
        tasks[Math.floor(this.#random.next() * tasks.length)] ?? tasks[0]!;
    }
  }

  #updateFault(state: RobotState): void {
    if (!state.fault && this.#random.next() < 0.001)
      state.fault = 'Wheel resistance high';
    else if (state.fault && this.#random.next() < 0.08) delete state.fault;
  }
}
