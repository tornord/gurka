import fs from "fs";

import * as tf from "@tensorflow/tfjs-node-gpu";

import { cardToString, cardValue, GameState, generateRandomGameState, valuateMonteCarlo } from "../common/card-game";
import { findMaxIndex, loadModel, predictModel, toModelName } from "./model-helpers";
import { randomNumberGenerator } from "../common/RandomNumberGenerator";
import { TrainingSample } from "./train-policy-model";

const { floor } = Math;

export function toKey(s: GameState) {
  const hc = s.highestPlayedValue === -1 ? "" : cardToString(s.highestPlayedValue);
  const { cards } = s.players[s.playerIndex];
  const pcs = cards.map(cardToString).join("");
  return `${pcs}-${hc}`;
}

export function policyNetworkCalcFactory(
  numberOfPlayers: number,
  numberOfCards: number,
  playerIndex: number,
  policyLookups: Record<string, Record<string, string>>,
  models: Record<string, tf.LayersModel>
) {
  return (state: GameState, moves: number[]) => {
    const player = state.players[state.playerIndex];
    const idx = state.calcPositionIndex();
    let idxHighestPlayed: number | null = null;
    if (
      state.highestPlayedIndex !== -1 &&
      numberOfPlayers > 2 &&
      idx > 1 &&
      !(numberOfCards === 3 && playerIndex === numberOfPlayers - 1)
    ) {
      const n = numberOfPlayers;
      const idxDiff = (state.playerIndex + n - state.highestPlayedIndex) % n;
      if (idxDiff < 0 || idx - idxDiff < 0) {
        throw new Error(`idxDiff: ${idxDiff} idx: ${idx}`);
      }
      idxHighestPlayed = idx - idxDiff;
    }
    const modelName = toModelName(state.players.length, player.cards.length, idx, idxHighestPlayed);
    const k = toKey(state);
    const policyLookup = policyLookups[modelName];
    if (policyLookup) {
      const p = policyLookup[k];
      if (p) {
        const md: Record<string, number> = {};
        for (let i = 0; i < moves.length; i++) {
          const m = moves[i];
          const c = cardToString(player.cards[m]);
          md[c] = m;
        }
        return md[p];
      }
    }
    const model = models[modelName];
    if (!model) {
      throw new Error(`Model ${modelName} not found`);
    }
    const p = predictModel(model, k);
    const cs = moves.map((d) => cardValue(player.cards[d]));
    const mi = findMaxIndex(cs.map((c) => p[c]));
    return moves[mi];
  };
}

export function calcHighestPlayedIndices(numberOfPlayers: number, numberOfCards: number, playerIndex: number) {
  if (numberOfPlayers === 2 || playerIndex <= 1 || (numberOfCards === 3 && playerIndex === numberOfPlayers - 1)) {
    return [null];
  }
  return [...Array(playerIndex)].map((_, i) => i);
}

export function readValuations(filename: string): TrainingSample[] {
  return JSON.parse(fs.readFileSync(filename, "utf8"));
}

export async function loadModels(numberOfPlayers: number, numberOfCards: number) {
  const models: Record<string, tf.LayersModel> = {};
  const policyLookups: Record<string, Record<string, string>> = {};
  for (let iCard = 3; iCard <= numberOfCards; iCard++) {
    for (let iPlayer = 0; iPlayer < numberOfPlayers; iPlayer++) {
      const highestPlayedIndices = calcHighestPlayedIndices(numberOfPlayers, numberOfCards, iPlayer);
      for (const iHighestPlayed of highestPlayedIndices) {
        const modelName = toModelName(numberOfPlayers, iCard, iPlayer, iHighestPlayed);
        let filename = `./data/model-${modelName}.json`;
        if (!fs.existsSync(filename)) continue;
        const modelJson = JSON.parse(fs.readFileSync(filename, "utf8"));
        const model = await loadModel(modelJson);
        models[modelName] = model;
        filename = `./data/valuations-${modelName}.json`;
        if (!fs.existsSync(filename)) continue;
        const dict = Object.fromEntries(readValuations(filename).map((d: TrainingSample) => [d.key, d.value]));
        policyLookups[modelName] = dict;
      }
    }
  }
  return { models, policyLookups };
}

export function simulateSeed(
  seed: string,
  numberOfPlayers: number,
  numberOfCards: number,
  playerIndex: number,
  highestPlayedIndex: number | null,
  cache: Map<string, { seedIndex: number; value: string }>,
  policyNetworkCalc: (state: GameState, moves: number[]) => number
) {
  const NUM_RUNS = 1000;
  const rng0 = randomNumberGenerator(seed);
  const s0 = generateRandomGameState(seed, numberOfPlayers, numberOfCards, 0);
  for (let j = 0; j < playerIndex; j++) {
    const ms = s0.possibleMoves();
    const m = ms[ms.length === 1 ? 0 : 1 + floor(rng0() * (ms.length - 1))];
    s0.playCard(m);
  }

  if (highestPlayedIndex !== null && s0.highestPlayedIndex !== highestPlayedIndex) {
    return true;
  }

  const k = toKey(s0);
  if (cache.has(k)) return true;
  const moves = s0.possibleMoves();
  if (moves.length === 1) return true;
  const vals = moves.map(() => 0);
  const runs = moves.map(() => 0);
  const cards = moves.map((m) => cardToString(s0.players[playerIndex].cards[m]));
  tf.tidy(() => {
    for (let j = 0; j < NUM_RUNS; j++) {
      for (let m = 0; m < moves.length; m++) {
        const rngr = randomNumberGenerator(`${seed}${j}`);
        const s = s0.clone();
        s.playCard(moves[m]);
        const v = valuateMonteCarlo(s, rngr, 1, playerIndex, true, policyNetworkCalc);
        if (v === null) return true;
        vals[m] += v.value;
        runs[m]++;
      }
    }
  });
  if (runs.some((r) => r === 0)) {
    return true;
  }
  const mi = findMaxIndex(vals.map((v, ii) => v / runs[ii]));
  cache.set(k, { seedIndex: Number(seed), value: cards[mi] });
  const mn = toModelName(numberOfPlayers, numberOfCards, playerIndex, highestPlayedIndex);
  // eslint-disable-next-line no-console
  console.log(
    `${mn.padEnd(4)} ${cache.size.toString().padStart(5)} ${seed.padStart(5)} ${k.padEnd(10)} ${cards
      .join("")
      .padEnd(7)} ${cards[mi]} ${vals.map((d, ii) => (d / runs[ii]).toFixed(2).padStart(6)).join(" ")}`
  );
  return cache.size < 5000;
}