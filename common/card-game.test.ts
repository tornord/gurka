import {
  calcRemainingDeck,
  cardFromString,
  cardToString,
  Deck,
  GameState,
  generateRandomGameState,
  indexArray,
  Player,
  randomGameState,
  sortCards,
  valuateMonteCarlo,
  valuateStatic,
} from "./card-game";
import { randomNumberGenerator } from "./RandomNumberGenerator";

const { floor } = Math;

function runValuate(seed: string, numberOfPlayers: number, playerIndex: number = 0) {
  const deck = new Deck();
  const rng = randomNumberGenerator(seed);
  const players = [...Array(numberOfPlayers)].map(() => new Player(deck.nextCards(rng, 2)));
  const state = new GameState(deck, players, playerIndex);
  const cs = state.toString();
  const ps = [];
  for (let j = 0; j < players.length; j++) {
    const idx = state.possibleMoves()[0];
    ps.push(cardToString(state.playCard(idx)));
  }
  const valuations = players.map((_, i) => valuateStatic(state, i, true));
  const highestDiscardeds = players
    .map((p) => (p.highestDiscarded >= 0 ? cardToString(p.highestDiscarded) : " "))
    .join("");
  return { cards: cs, playedCards: ps.join(""), valuations, playerIndex: state.playerIndex, highestDiscardeds };
}

function runTwoCardsSimulation(seed: string, runs: number, playerIndex: number = 1) {
  const rng = randomNumberGenerator(seed);
  const deck = new Deck();

  // Draw 2 cards for player 0
  const player0Cards = deck.nextCards(rng, 2);
  sortCards(player0Cards);
  // const player0CardsStr = player0Cards.map((c) => cardToString(c)).join("");

  let totalValuation = 0;
  for (let i = 0; i < runs; i++) {
    const deckCopy = deck.clone();
    const players = [];
    players.push(new Player([...player0Cards]));
    for (let j = 1; j < 5; j++) {
      const cs = deckCopy.nextCards(rng, 2);
      players.push(new Player(cs));
    }
    const state = new GameState(deckCopy, players, playerIndex);
    for (let j = 0; j < 5; j++) {
      const idx = state.possibleMoves()[0];
      state.playCard(idx);
    }
    // const cs = state.toString();
    const v = valuateStatic(state, 0);
    totalValuation += v;
  }
  return totalValuation;
}

describe("card-game", () => {
  describe("cardToString", () => {
    test("should convert a card id to the correct string", () => {
      const expected = "23456789TJQKA".split("");
      for (let i = 0; i < 13; i++) {
        expect(cardToString(i)).toBe(expected[i]);
      }
    });
  });

  describe("cardFromString", () => {
    test("should convert a card string to the correct id (skip suit)", () => {
      expect("23456789TJQKA".split("").map(cardFromString)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });

    test("should throw an error for invalid card strings", () => {
      expect(() => cardFromString("D")).toThrow("Invalid card: D");
    });
  });

  describe("sortCards", () => {
    test("should sort cards in ascending order", () => {
      expect(sortCards([3, 1, 2])).toEqual([1, 2, 3]);
    });

    test("should sort cards in ascending order", () => {
      expect(sortCards([11, 23, 35, 47]).map(cardToString).join("")).toEqual("TJQK");
    });
  });

  describe("Deck", () => {
    test("nextCard should produce all unique cards", () => {
      const deck = new Deck();
      const rng = () => Math.random();
      const drawn = Array.from({ length: 52 }, () => deck.nextCard(rng));
      expect(new Set(drawn).size).toBe(52);
    });

    test("remainingDeck", () => {
      const deck = new Deck([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const rng = randomNumberGenerator("124");
      const drawn = deck.nextCards(rng, 3);
      const r = deck.remainingDeck(drawn);
      expect(r.cards).toEqual([0, 1, 3, 5, 7, 8, 9]);
    });
  });

  describe("Deck.nextCards", () => {
    test("should produce all unique cards", () => {
      const deck = new Deck();
      const rng = () => Math.random();
      const drawn = deck.nextCards(rng, 52);
      expect(new Set(drawn).size).toBe(52);
    });

    test("draw 3 cards", () => {
      const deck = new Deck();
      const rng = randomNumberGenerator("123");
      const drawn = deck.nextCards(rng, 3);
      expect(drawn.length).toBe(3);
      expect(drawn.map(cardToString).join("")).toBe("238");
    });
  });

  describe("Player", () => {
    test("should initialize with the correct number of cards", () => {
      const player = new Player([5, 10, 15]);
      expect(Array.isArray(player.cards)).toBe(true);
      expect(player.cards).toHaveLength(3);
    });
  });

  describe("GameState", () => {
    test("should allow deck and players to be properly assigned", () => {
      const deck = new Deck();
      const players = [new Player([1, 2, 3]), new Player([4, 5, 6])];
      const state = new GameState(deck, players, 0);
      expect(state.deck).toBe(deck);
      expect(state.players).toEqual(players);
    });

    test("GameState toString", () => {
      const state = generateRandomGameState("123", 3, 3, 0);
      expect(state.toString()).toBe("*238,8JK,66A");
      expect(state.toString(false)).toBe("P1* 238 :\nP2  8JK :\nP3  66A :");
    });

    test("GameState clone", () => {
      const state = generateRandomGameState("123", 3, 3, 0);
      const state1 = state.clone();
      expect(state1.toString(false)).toEqual(state.toString(false));
      state.playCard(0);
      expect(state1.toString(false)).not.toEqual(state.toString(false));
    });

    test("calcRemainingDeck", () => {
      const state = generateRandomGameState("123", 3, 3, 0, indexArray(20));
      for (let i = 0; i < state.players.length; i++) {
        state.playCard(state.possibleMoves().at(-1)!);
      }
      const s = state.toString(false);
      expect(s).toEqual("P1  35 : 7\nP2* 68 : Q\nP3  46 : 3 3");
      const remainingDeck = calcRemainingDeck(state);
      expect(remainingDeck.cards).toEqual([0, 13, 14, 2, 15, 3, 16, 4, 18, 6, 7, 8, 9, 11, 12]);
    });

    test("randomGameState 124", () => {
      const seed = "124";
      const state = generateRandomGameState(seed, 3, 3, 0, indexArray(20));
      for (let i = 0; i < state.players.length; i++) {
        state.playCard(state.possibleMoves().at(-1)!);
      }
      const rng = randomNumberGenerator(seed);
      const s0 = state.toString(false);
      expect(s0).toEqual("P1* 5J : A\nP2  6K : 2 2\nP3  TQ : 3 3");
      const remainingDeck = calcRemainingDeck(state);
      const state1 = randomGameState(state, rng, remainingDeck);
      expect(state1).not.toBeNull();
      const s1 = state1!.toString(false);
      expect(s1).toEqual("P1* 5J : A\nP2  78 : 2 2\nP3  24 : 3 3");
    });
    test("randomGameState 108, drawn card is lower than highest discarded card", () => {
      const state = generateRandomGameState("123", 3, 3, 0, indexArray(20));
      for (let i = 0; i < state.players.length; i++) {
        state.playCard(state.possibleMoves().at(-1)!);
      }
      const s0 = state.toString(false);
      expect(s0).toEqual("P1  35 : 7\nP2* 68 : Q\nP3  46 : 3 3");
      const rng = randomNumberGenerator("110");
      const remainingDeck = calcRemainingDeck(state);
      const state1 = randomGameState(state, rng, remainingDeck);
      expect(state1).toBeNull();
    });
  });

  describe("valuate", () => {
    const calcStaticValues = (cards: string, includeOtherPlayers: boolean = true) => {
      const players = cards.split(",").map((c) => new Player([cardFromString(c)]));
      const state = new GameState(new Deck(), players, 0);
      return players.map((_, i) => valuateStatic(state, i, includeOtherPlayers));
    };

    test("should return card rank when player has highest card", () => {
      expect(calcStaticValues("A,9")).toEqual([-50, 50]);
      expect(calcStaticValues("A,K")).toEqual([-50, 50]);
      expect(calcStaticValues("K,Q")).toEqual([-13, 13]);
      expect(calcStaticValues("Q,J")).toEqual([-12, 12]);
      expect(calcStaticValues("J,T")).toEqual([-11, 11]);
      expect(calcStaticValues("T,9")).toEqual([-10, 10]);
      expect(calcStaticValues("9,9,8")).toEqual([-4.5, -4.5, 9]);
      expect(calcStaticValues("Q,Q,Q,7")).toEqual([-4, -4, -4, 12]);
      expect(calcStaticValues("7,Q,Q,Q")).toEqual([12, -4, -4, -4]);
      expect(calcStaticValues("7,Q,Q,Q", false)).toEqual([0, 12, 12, 12]);
    });

    test("should handle tied highest cards", () => {
      expect(calcStaticValues("A,A")).toEqual([-50, -50]);
    });

    test("5 players with random cards", () => {
      const deck = new Deck();
      const rng = randomNumberGenerator("123");
      const cs = deck.nextCards(rng, 5);
      expect(calcStaticValues(cs.map((d) => cardToString(d)).join(","))).toEqual([3.25, 3.25, 3.25, 3.25, -13]);
    });

    test("5 players with random 2 cards each - 1", () => {
      const res = runValuate("126", 5);
      expect(res.cards).toEqual("*69,35,27,3T,JQ");
      expect(res.playedCards).toEqual("932TQ");
      expect(res.valuations).toEqual([2.75, 2.75, 2.75, 2.75, -11]);
      expect(res.playerIndex).toEqual(4);
      expect(res.highestDiscardeds).toEqual(" 32  ");
    });

    test("5 players with random 2 cards each - 2", () => {
      const res = runValuate("127", 5);
      expect(res.cards).toEqual("*46,JQ,7Q,25,TK");
      expect(res.playedCards).toEqual("6QQ2K");
      expect(res.valuations).toEqual([2.75, -11, 2.75, 2.75, 2.75]);
      expect(res.playerIndex).toEqual(4);
      expect(res.highestDiscardeds).toEqual("   2 ");
    });

    test("5 players with random 2 cards each - 3", () => {
      const res = runValuate("128", 5);
      expect(res.cards).toEqual("*49,27,4A,QQ,TK");
      expect(res.playedCards).toEqual("92AQT");
      expect(res.valuations).toEqual([3.25, 3.25, 3.25, 3.25, -13]);
      expect(res.playerIndex).toEqual(2);
      expect(res.highestDiscardeds).toEqual(" 2 QT");
    });

    test("8 players with random 2 cards each - 4", () => {
      const res = runValuate("136", 8, 1);
      expect(res.cards).toEqual("8Q,*26,34,3K,9J,4A,TA,4A");
      expect(res.playedCards).toEqual("63K9AT48");
      expect(res.valuations).toEqual([50, 50, 50, 50, 50, 50, -50, -50]);
      expect(res.playerIndex).toEqual(5);
      expect(res.highestDiscardeds).toEqual("8 3 9 T4");
    });

    test("Average valuation for player 0 over 1600 runs - 1", () => {
      const t = runTwoCardsSimulation("130", 1600); // cards = 6T
      expect(t).toBe(5552); // 5552 / 1600 = 3.47
    });

    describe("monto carlo", () => {
      test("Average valuation for player 0 over 1600 runs - 2", () => {
        const t = runTwoCardsSimulation("133", 1600); // cards = Q4
        expect(t).toBe(10216); // 10216 / 1600 = 6.385
      });

      test("Average valuation for player 0 over 1600 runs - 2", () => {
        const t = runTwoCardsSimulation("133", 1600, 0); // cards = Q4, player 0 starts
        expect(t).toBe(0); // 0 / 1600 = 0
      });

      test("Average valuation for player 0 over 1600 runs - 3", () => {
        const t = runTwoCardsSimulation("126", 1600); // cards = 96
        expect(t).toBe(3168); // 3168 / 1600 = 1.98
      });
    });

    describe("possibleMoves", () => {
      const generateState = (cards: string, highest: string) => {
        const rng = randomNumberGenerator("X");
        const randomSuit = () => (rng() < 0.25 ? 0 : rng() < 0.5 ? 1 : rng() < 0.75 ? 2 : 3);
        const deck = new Deck();
        const p = new Player(cards.split("").map((d) => cardFromString(d) + 13 * randomSuit()));
        const res = new GameState(deck, [p], 0);
        res.highestPlayedValue = highest === "" ? -1 : cardFromString(highest);
        return res;
      };
      const generateState2 = (cards: string, highest: string) => {
        const rng = randomNumberGenerator("X");
        const randomSuit = () => (rng() < 0.25 ? 0 : rng() < 0.5 ? 1 : rng() < 0.75 ? 2 : 3);
        const deck = new Deck();
        const p1 = new Player(deck.nextCards(rng, 2), [cardFromString(highest)]);
        const p2 = new Player(cards.split("").map((d) => cardFromString(d) + 13 * randomSuit()));
        const res = new GameState(deck, [p1, p2], 1);
        res.highestPlayedValue = highest === "" ? -1 : cardFromString(highest);
        return res;
      };

      test("various situations", () => {
        expect(generateState("234", "").possibleMoves()).toEqual([1, 2]);
        expect(generateState("J", "").possibleMoves()).toEqual([]);
        expect(generateState("JJ", "").possibleMoves()).toEqual([1]);
        expect(generateState("345", "2").possibleMoves()).toEqual([1, 2]);
        expect(generateState("3345", "2").possibleMoves()).toEqual([1, 2, 3]);
        expect(generateState("579", "8").possibleMoves()).toEqual([0, 2]);
        expect(generateState("334Q", "J").possibleMoves()).toEqual([0, 3]);
        expect(generateState("334Q", "K").possibleMoves()).toEqual([0]);
        expect(generateState("334Q", "A").possibleMoves()).toEqual([0]);
        expect(generateState("79", "7").possibleMoves()).toEqual([1]);
        expect(generateState("34K", "Q").possibleMoves()).toEqual([0, 2]);
        expect(generateState("333", "2").possibleMoves()).toEqual([1]);
        expect(generateState("333444", "2").possibleMoves()).toEqual([1, 3]);
        expect(generateState("333444", "4").possibleMoves()).toEqual([0, 3]);
        expect(generateState("34", "4").possibleMoves()).toEqual([1]);
        expect(generateState("KA", "A").possibleMoves()).toEqual([0]);
        expect(generateState("AA", "A").possibleMoves()).toEqual([0]);
        expect(generateState("55", "5").possibleMoves()).toEqual([1]);
        expect(generateState("TJQ", "T").possibleMoves()).toEqual([1, 2]);
        expect(generateState("778899", "8").possibleMoves()).toEqual([0, 2, 4]);
        expect(generateState("2QK", "").possibleMoves()).toEqual([1, 2]);
        expect(generateState("2QK", "7").possibleMoves()).toEqual([0, 1, 2]);
        expect(generateState("KA", "K").possibleMoves()).toEqual([1]);
        expect(generateState("3T", "9").possibleMoves()).toEqual([1]);
        expect(generateState("5QA", "K").possibleMoves()).toEqual([0, 2]);
        expect(generateState2("5QA", "K").possibleMoves()).toEqual([2]);
        expect(generateState2("2TJ", "9").possibleMoves()).toEqual([1]);
      });

      test("5 players with random three cards each", () => {
        // for (let i = 100; i < 10000; i++) {
        const rng = randomNumberGenerator("646");
        const deck = new Deck();
        const ps = [...Array(5)].map(() => new Player(sortCards(deck.nextCards(rng, 3))));
        const state = new GameState(deck, ps, 0);
        for (let j = 0; j < ps.length - 1; j++) {
          const ms = state.possibleMoves();
          const idx = ms[0];
          state.playCard(idx);
        }
        const s = state.toString(false);
        const ms = state.possibleMoves();
        expect(ms.length).toEqual(1);
        expect(s).toEqual("P1  37 : 7\nP2  9T : 4 4\nP3  67 : 5 5\nP4  2A : 2 2\nP5* 9TA :");
        state.playCard(ms[0]);
        const x = valuateMonteCarlo(state, rng, 1000, state.playerIndex);
        expect(state.toString(false)).toEqual("P1  37 : 7\nP2  9T : 4 4\nP3  67 : 5 5\nP4  2A : 2 2\nP5* 9A : T");
        expect(x!.value).toBe(63 / 927);
      });
    });
  });

  describe("valuateMonteCarlo", () => {
    test("123", () => {
      const seed = "123";
      const state = generateRandomGameState(seed, 3, 3, 0, indexArray(20));
      for (let i = 0; i < state.players.length; i++) {
        state.playCard(state.possibleMoves().at(-1)!);
      }
      const rng = randomNumberGenerator(seed);
      const s0 = state.toString(false);
      expect(s0).toEqual("P1  35 : 7\nP2* 68 : Q\nP3  46 : 3 3");
      let x = valuateMonteCarlo(state, rng, 0);
      expect(x).toBeNull();
      x = valuateMonteCarlo(state, rng, 1000);
      expect(x!.totalValuation).toBe(1950);
      expect(x!.runs).toBe(879);
    });

    test("102 - a choise of 2 cards, 7 or K ", () => {
      const seed = "102";
      const origState = generateRandomGameState(seed, 3, 3, 0, indexArray(52));
      let ms = origState.possibleMoves();
      expect(ms.length).toBe(2);
      const state1 = origState.clone();
      state1.playCard(ms[0]); // 7
      state1.playCard(ms[1]);
      state1.playCard(ms[0]);
      const state2 = origState.clone();
      state2.playCard(ms[1]); // K
      state2.playCard(ms[0]);
      state2.playCard(ms[1]);
      const runState = (s: GameState) => {
        const rng = randomNumberGenerator(seed);
        const x = valuateMonteCarlo(s, rng, 1600, 0);
        const ss = s.toString(false);
        for (let j = 0; j < s.players.length; j++) {
          ms = s.possibleMoves();
          s.playCard(ms[0]);
        }
        const y = valuateStatic(s, 0);
        return { x, y, ss };
      };
      const x1 = runState(state1);
      const x2 = runState(state2);
      expect(x1.ss).toEqual("P1  6K : 7\nP2  66 : T\nP3* 5A : Q");
      expect(x1.x!.value).toBe(4521 / 1600);
      expect(x1.y).toBe(13);
      expect(x2.ss).toEqual("P1  67 : K\nP2  6T : 6 6\nP3* 5Q : A");
      expect(x2.x!.value).toBe(3087 / 1357);
      expect(x2.y).toBe(0);
    });

    const randomItem = (arr: number[], rng: () => number) => {
      const n = floor(rng() * arr.length);
      return arr[n];
    };

    test("5 players with random three cards each", () => {
      const rng = randomNumberGenerator("128");
      const deck = new Deck(indexArray(26));
      const ps = [...Array(5)].map(() => new Player(sortCards(deck.nextCards(rng, 3))));
      const state0 = new GameState(deck, ps, 0);
      for (let j = 0; j < ps.length - 1; j++) {
        const ms = state0.possibleMoves();
        const idx = randomItem(ms, rng);
        state0.playCard(idx);
      }
      const ms = state0.possibleMoves();
      const rng0 = randomNumberGenerator("129");
      const x0 = valuateMonteCarlo(state0, rng0, 1600, 4);
      expect(x0!.value).toBe(4827 / 1058);
      const state1 = state0.clone();
      state1.playCard(ms[0]);
      const s1 = state1.toString(false);
      expect(s1).toEqual("P1  3J : Q\nP2* 9T : A\nP3  8T : 3 3\nP4  9Q : 7 7\nP5  7K : 5 5");
      const rng1 = randomNumberGenerator("129");
      const x1 = valuateMonteCarlo(state1, rng1, 1600, 4);
      expect(x1!.value).toBe(4827 / 1058);
    });

    test("3 players with random 3 cards each, use only 9 cards", () => {
      const seed = "129";
      const rng = randomNumberGenerator(seed);
      const deck = new Deck(indexArray(9));
      const ps = [...Array(3)].map(() => new Player(sortCards(deck.nextCards(rng, 3))));
      const state0 = new GameState(deck, ps, 0);
      for (let j = 0; j < ps.length; j++) {
        const ms = state0.possibleMoves();
        const idx = randomItem(ms, rng);
        state0.playCard(idx);
      }
      expect(state0.toString(false)).toEqual("P1  58 : 9\nP2* 37 : T\nP3  46 : 2 2");
      const rng0 = randomNumberGenerator(seed);
      const dict: Record<string, number> = {};
      for (let i = 0; i < 100; i++) {
        const x0 = valuateMonteCarlo(state0, rng0, 1, 0);
        if (x0) {
          const hash = x0.latestState!.toString();
          dict[hash] = x0.value;
        }
      }
      expect(Object.entries(dict)).toEqual([
        ["58,*47,36", 0],
        ["58,*46,37", 5],
        ["58,*34,67", 0],
        ["58,*37,46", 0],
        ["58,*36,47", 5],
        ["58,*67,34", 0],
      ]);
      const x1 = valuateMonteCarlo(state0, rng0, 400, 0);
      expect(x1!.value).toBe(1.6625); // exact value is (5+5) / 6 = 1.6666666666666667
    });
  });
});
