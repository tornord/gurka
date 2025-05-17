// https://en.wikipedia.org/wiki/Cucumber_(card_game)

import { GamePhase } from "./game-phase";
import { randomNumberGenerator } from "./RandomNumberGenerator";

const { floor, max } = Math;

export const cardValue = (c: number): number => c % 13;

export function cardToString(cardId: number): string {
  const v = cardValue(cardId);
  if (v < 8) return String(v + 2);
  return ["T", "J", "Q", "K", "A"][v - 8];
}

const HIGH_CARDS = Object.fromEntries(["T", "J", "Q", "K", "A"].map((d, i) => [d, i + 8]));

export function cardFromString(s: string): number {
  if (s >= "0" && s <= "9") return s.charCodeAt(0) - "2".charCodeAt(0);
  const v = HIGH_CARDS[s];
  if (v === undefined) {
    throw new Error(`Invalid card: ${s}`);
  }
  return v;
}

export function sortCards(cs: number[]): number[] {
  return cs.sort((a, b) => {
    const c = cardValue(a) - cardValue(b);
    if (c !== 0) return c;
    return a - b;
  });
}

// console.log([...Array(13)].map((_, i) => cardToString(i)));

export function indexArray(length: number): number[] {
  return Array.from({ length }, (_, i) => i);
}

export class Deck {
  cards: number[];
  index: number;

  constructor(cs: number[] | null = null) {
    this.cards = cs ?? indexArray(52);
    this.index = 0;
  }

  nextCard(rng: () => number): number {
    if (this.index >= this.cards.length) throw new Error("no more cards");
    const i = this.index + floor(rng() * (this.cards.length - this.index));
    const card = this.cards[i];
    this.cards[i] = this.cards[this.index];
    this.cards[this.index] = card;
    this.index++;
    return card;
  }

  nextCards(rng: () => number, n: number): number[] {
    return Array.from({ length: n }, () => this.nextCard(rng));
  }

  clone(): Deck {
    const d = new Deck([...this.cards]);
    d.index = this.index;
    return d;
  }

  remainingDeck(drawn: number[]): Deck {
    const s = new Set(drawn);
    const cs = this.cards.filter((c) => !s.has(c));
    sortCards(cs);
    return new Deck(cs);
  }
}

export class Player {
  cards: number[];
  playedCards: number[];
  highestDiscarded: number;

  constructor(cs: number[], playedCards: number[] = [], highestDiscarded: number = -1) {
    this.cards = sortCards(cs);
    this.playedCards = playedCards;
    this.highestDiscarded = highestDiscarded;
  }

  clone(): Player {
    return new Player([...this.cards], [...this.playedCards], this.highestDiscarded);
  }
}

export class GameState {
  deck: Deck;
  players: Player[];
  playerIndex: number;
  highestPlayedValue: number;
  highestPlayedIndex: number;

  constructor(deck: Deck, players: Player[], playerIndex: number) {
    this.deck = deck;
    this.players = players;
    this.playerIndex = playerIndex;
    this.highestPlayedValue = -1;
    this.highestPlayedIndex = -1;
  }

  clone(): GameState {
    const res = new GameState(
      this.deck.clone(),
      this.players.map((d) => d.clone()),
      this.playerIndex
    );
    res.highestPlayedValue = this.highestPlayedValue;
    res.highestPlayedIndex = this.highestPlayedIndex;
    return res;
  }

  toString(simple: boolean = true): string {
    if (simple) {
      const cs = this.players.map((d) => d.cards.map((c) => cardToString(c)).join(""));
      return cs.map((d, i) => `${i === this.playerIndex ? "*" : ""}${d}`).join(",");
    }
    const maxPlayedCards = max(...this.players.map((d) => d.playedCards.length));
    const playerToStr = (p: Player, i: number) => {
      const cs = p.cards.map(cardToString).join("");
      const ps = p.playedCards.map(cardToString).join("");
      return `P${i + 1}${i === this.playerIndex ? "*" : " "} ${cs} : ${ps.padEnd(maxPlayedCards, " ")} ${
        p.highestDiscarded >= 0 ? cardToString(p.highestDiscarded) : " "
      }`.trimEnd();
    };
    return this.players.map(playerToStr).join("\n");
  }

  possibleMoves(): number[] {
    const player = this.players[this.playerIndex];
    if (player.cards.length === 1) {
      return [];
    }
    if (this.highestPlayedValue === 12 || this.highestPlayedValue > cardValue(player.cards.at(-1)!)) return [0];
    const nonLowests = Array(13).fill(-1);
    for (const [i, c] of player.cards.entries()) {
      if (i === 0 || cardValue(c) < this.highestPlayedValue) continue;
      if (nonLowests[cardValue(c)] === -1) {
        nonLowests[cardValue(c)] = i;
      }
    }
    const ids = nonLowests.filter((d) => d !== -1);
    if (player.cards.length === 2) return ids;
    if (player.cards.length === 3) {
      const nextPlayerIndex = (this.playerIndex + 1) % this.players.length;
      const isLast = this.players[nextPlayerIndex].cards.length < player.cards.length;
      if (isLast) {
        return [ids[0]];
      }
      if (this.players.length === 2) {
        if (this.highestPlayedValue === -1) {
          return [ids.at(-1)!];
        }
        if (this.players[nextPlayerIndex].cards.length < player.cards.length && ids.length >= 1) {
          return [ids[0]];
        }
      }
    }

    return cardValue(player.cards[0]) < this.highestPlayedValue ? [0, ...ids] : ids;
  }

  playCard(playerCardIndex: number): number {
    const playerIndex = this.playerIndex;
    const player = this.players[playerIndex];
    const cardRank = cardValue(player.cards[playerCardIndex]);
    if (this.highestPlayedValue === -1 || (cardRank >= this.highestPlayedValue && this.highestPlayedValue !== 12)) {
      this.highestPlayedValue = cardRank;
      this.highestPlayedIndex = playerIndex;
      this.playerIndex = playerIndex;
    } else {
      player.highestDiscarded = cardRank;
    }
    player.cards.splice(playerCardIndex, 1);
    const nextPlayerIndex = (this.playerIndex + 1) % this.players.length;
    if (this.players[nextPlayerIndex].cards.length > player.cards.length) {
      this.playerIndex = nextPlayerIndex;
    } else {
      this.playerIndex = this.highestPlayedIndex;
      this.highestPlayedValue = -1;
      this.highestPlayedIndex = -1;
    }
    player.playedCards.push(cardRank);
    return cardRank;
  }

  calcPositionIndex(): number {
    if (this.highestPlayedValue === -1) return 0;
    const n = this.players[this.playerIndex].cards.length;
    let res = 0;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.cards.length < n) {
        res++;
      }
    }
    return res;
  }
}

export function valuateStatic(state: GameState, playerIndex: number, includeOtherPlayers: boolean = false): number {
  // Assume each player's cards array contains exactly one card
  const playerCard = state.players[playerIndex].cards[0];
  const playerValue = cardValue(playerCard);
  if (playerValue === 12) return -50;
  let maxValue = playerValue;
  for (let i = 0; i < state.players.length; i++) {
    // if (i === playerIndex) continue;
    const p = state.players[i];
    if (p.cards.length !== 1) throw new Error("can only valuate static for one card");
    const v = cardValue(p.cards[0]);
    if (includeOtherPlayers && i !== playerIndex && v === 12) return 50;
    if (v > maxValue) {
      maxValue = v;
    }
  }
  let otherScore = 0;
  let playerScore = 0;
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    const v = cardValue(p.cards[0]);
    if (i === playerIndex) {
      playerScore = v >= maxValue ? v + 2 : 0;
    } else if (includeOtherPlayers) {
      otherScore += v >= maxValue ? v + 2 : 0;
    }
  }
  const s = includeOtherPlayers ? -1 : 1;
  return s * (playerScore - otherScore / (state.players.length - 1));
}

export function calcRemainingDeck(state: GameState, playerIndex: number | null = null): Deck {
  playerIndex ??= state.playerIndex;
  const usedCards = [];
  for (let i = 0; i < state.players.length; i++) {
    usedCards.push(...state.players[i].playedCards);
    if (i === playerIndex) {
      usedCards.push(...state.players[i].cards);
    }
  }
  return state.deck.remainingDeck(usedCards);
}

export function randomGameState(
  original: GameState,
  rng: () => number,
  remainingDeck: Deck,
  playerIndex: number | null = null
): GameState | null {
  playerIndex ??= original.playerIndex;
  const deck = remainingDeck.clone();
  const newPlayers = original.players.map((p) => p.clone());
  for (let i = 0; i < newPlayers.length; i++) {
    if (i === playerIndex) continue;
    const player = newPlayers[i];
    const newCards = deck.nextCards(rng, player.cards.length);
    sortCards(newCards);
    if (newCards[0] < player.highestDiscarded) return null;
    player.cards = newCards;
  }
  const res = new GameState(deck, newPlayers, original.playerIndex);
  res.highestPlayedValue = original.highestPlayedValue;
  res.highestPlayedIndex = original.highestPlayedIndex;
  return res;
}

export type MonteCarloResult = { value: number; runs: number; totalValuation: number; latestState: GameState | null };

export function valuateMonteCarlo(
  state: GameState,
  rng: () => number,
  numberOfRuns: number,
  playerIndex: number | null = null,
  includeOtherPlayerInValuation: boolean = false,
  evaluationFunction: null | ((_state: GameState, moves: number[]) => number | null) = null
): MonteCarloResult | null {
  // Only monte carlo when there is only one move left (for all players)
  playerIndex ??= state.playerIndex;
  const remainingDeck = calcRemainingDeck(state, playerIndex);
  let totalValuation = 0;
  let totalRuns = 0;
  let latestState: GameState | null = null;
  for (let i = 0; i < numberOfRuns; i++) {
    const randomState = randomGameState(state, rng, remainingDeck, playerIndex);
    if (randomState === null) continue;
    latestState = randomState.clone();
    let ms;
    let mn;
    do {
      ms = randomState.possibleMoves();
      mn = ms.length;
      if (ms.length === 0) break;
      let idx: number | null = null;
      if (ms.length > 1) {
        if (!evaluationFunction) throw new Error("cannot handle multiple moves");
        idx = evaluationFunction(randomState, ms);
        if (idx === null) throw new Error("policy network returned null");
        mn = 1;
      } else {
        idx = ms[0];
      }
      randomState.playCard(idx);
    } while (mn === 1);
    const v = valuateStatic(randomState, playerIndex, includeOtherPlayerInValuation);
    totalValuation += v;
    totalRuns++;
  }
  if (totalRuns === 0) return null;
  return { value: totalValuation / totalRuns, runs: totalRuns, totalValuation: totalValuation, latestState };
}

export function generateRandomGameState(
  seed: string,
  numberOfPlayers: number,
  numberOfCards: number,
  playerIndex: number = 0,
  cards: number[] | null = null
) {
  const rng = randomNumberGenerator(seed);
  const deck = new Deck(cards);
  const players = [...Array(numberOfPlayers)].map(() => new Player(deck.nextCards(rng, numberOfCards)));
  return new GameState(deck, players, playerIndex);
}

export function valuateSpecial(
  seedIndex: number,
  phase: GamePhase,
  numPlayedCards: number,
  // cache: Record<string, string> | null = null
) {
  const seed = seedIndex.toString();
  const s = generateRandomGameState(seed, phase.numberOfPlayers, phase.numberOfCards, 0);
  const rng0 = randomNumberGenerator(seed);
  for (let i = 0; i < numPlayedCards; i++) {
    const ms = s.possibleMoves();
    const m = ms[floor(rng0() * ms.length)];
    s.playCard(m);
  }
  // const p0cs = s.players[0].playedCards.map(cardToString).join("");
  // const p1cs = s.players[1].cards.map(cardToString).join("");
  // const key = `${p1cs}-${p0cs}`;
  // if (cache && cache[key]) {
  //   return { state: null, valuation: cache[key], moves: null, key };
  // }
  // const ms = s.possibleMoves();
  // if (ms.length === 1) {
  //   return { state: s, valuation: 0, moves: null, key };
  // }
  // let bestMove: string | null = null;
  // let bestValuation: number | null = null;
  // const values = [];
  // for (let i = 0; i < ms.length; i++) {
  //   const rng1 = randomNumberGenerator(`${seed}x`);
  //   const m = ms[i];
  //   const c = cardToString(s.players[s.playerIndex].cards[m]);
  //   const ss = s.clone();
  //   ss.playCard(m);
  //   const x = valuateMonteCarlo(ss, rng1, 1000, s.playerIndex, true);
  //   values.push(`${c}: ${x!.value}`);
  //   if (bestValuation === null || x!.value > bestValuation) {
  //     bestValuation = x!.value;
  //     bestMove = c;
  //   }
  // }
  // if (cache) {
  //   cache[key] = bestMove!;
  // }
  // console.log(bestMove, bestValuation, values); // eslint-disable-line no-console
  return s;
}
