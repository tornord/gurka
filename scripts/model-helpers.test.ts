import { findMaxIndex } from "./model-helpers";

describe("findMaxIndex", () => {
  it("should return the index of the maximum value in an array", () => {
    const array = [1, 3, 2, 5, 4];
    const index = findMaxIndex(array);
    expect(index).toBe(3);
  });

  it("should return the index of the last occurrence when the maximum value appears more than once", () => {
    const array = [1, 5, 3, 5, 2];
    const index = findMaxIndex(array);
    expect(index).toBe(3);
  });

  it("should work for a single-element array", () => {
    const array = [42];
    const index = findMaxIndex(array);
    expect(index).toBe(0);
  });
});
