export interface RandomSource {
  next(): number;
}

export class SeededRandom implements RandomSource {
  #state: number;

  constructor(seed: number) {
    this.#state = seed >>> 0 || 1;
  }

  next(): number {
    let value = this.#state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.#state = value >>> 0;
    return this.#state / 0x1_0000_0000;
  }
}
