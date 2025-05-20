import {
  calcHighestPlayedIndices,
  loadModels,
  maxValueDictMove,
  simulateSeed,
  toKey,
  valueDictToString,
} from "./bootstrap-helpers";

describe("bootstrap-helpers", () => {
  describe("toKey", () => {
    it("should return a string key formatted correctly when highestPlayedValue is -1", () => {
      // Create a dummy GameState object; note that this is a minimal stub for testing purposes.
      const dummyState: any = {
        highestPlayedValue: -1,
        players: [
          { cards: ["A", "K", "Q"] }, // dummy card representations
        ],
        playerIndex: 0,
      };
      const key = toKey(dummyState);
      expect(typeof key).toBe("string");
      // Expect the format to include a hyphen and end with '-' (empty highest played card representation).
      expect(key).toContain("-");
      expect(key.endsWith("-")).toBe(true);
    });
  });

  describe("calcHighestPlayedIndices", () => {
    it("should return [null] for 2 players", () => {
      expect(calcHighestPlayedIndices(2, 3, 0)).toEqual([null]);
    });

    it("should return [null] for playerIndex <= 1", () => {
      expect(calcHighestPlayedIndices(4, 3, 1)).toEqual([null]);
    });

    it("should return [null] for a 3-card game in the last player's turn", () => {
      expect(calcHighestPlayedIndices(4, 3, 3)).toEqual([null]);
    });

    it("should return an array of indices when playerIndex > 1", () => {
      // For 4 players and playerIndex = 2, expected indices are [0, 1]
      const indices = calcHighestPlayedIndices(4, 3, 2);
      expect(indices).toEqual([0, 1]);
    });
  });

  describe("valueDictToString", () => {
    it("should return a properly formatted string", () => {
      const valueDict = { A: 1.234, K: 0.567 };
      const result = valueDictToString(valueDict);
      expect(result).toMatch(/A: [\d.]+/);
      expect(result).toMatch(/K: [\d.]+/);
    });
  });

  describe("maxValueDictMove", () => {
    it("should find K = 11", () => {
      const values = { A: 0.5, K: 0.7, Q: 0.3 };
      const result = maxValueDictMove(values);
      expect(result).toBe(11);
    });

    it("should find Q = 10", () => {
      const values = { A: 0.5, Q: 0.7, J: 0.7, T: 0.7 };
      const result = maxValueDictMove(values);
      expect(result).toBe(10);
    });
  });

  describe("loadModels", () => {
    it("should return an object containing policyModels and policyLookups", async () => {
      // Create a dummy phase object with minimal requirements.
      const dummyPhase: any = {
        numberOfPlayers: 3,
        numberOfCards: 3,
        playerIndex: 0,
        toString: () => "dummyPhase",
      };
      const models = await loadModels(dummyPhase);
      expect(models).toHaveProperty("policyModels");
      expect(models).toHaveProperty("policyLookups");
    });
  });

  describe("simulateSeed", () => {
    it("should run without throwing an error", () => {
      const dummyPhase: any = {
        numberOfPlayers: 3,
        numberOfCards: 3,
        playerIndex: 0,
        highestPlayedIndex: null,
        toString: () => "dummyPhase",
      };
      // Dummy policy network calc function that returns the first available move.
      const dummyPolicyNetworkCalc = (state: any, moves: number[]) => moves[0];
      const cache = new Map();
      expect(() => simulateSeed("0", dummyPhase, cache, dummyPolicyNetworkCalc, 1000)).not.toThrow();
    });
  });

  // Additional test scaffolds can be added here as needed.
});
