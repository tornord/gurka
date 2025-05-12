import { randomNumberGenerator } from "./RandomNumberGenerator";

describe("randomNumberGenerator", () => {
  it("should produce a number between 0 and 1", () => {
    const rng = randomNumberGenerator("test-seed");
    const value = rng();
    expect(value).toBe(0.9373688343912363);
  });

  it("should produce consistent sequences with the same seed", () => {
    const seed = "consistent-seed";
    const rng1 = randomNumberGenerator(seed);
    const rng2 = randomNumberGenerator(seed);
    const sequence1 = Array.from({ length: 5 }, () => rng1());
    const sequence2 = Array.from({ length: 5 }, () => rng2());
    expect(sequence1).toEqual(sequence2);
  });
});
