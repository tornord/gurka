import fs from "fs";

import * as tf from "@tensorflow/tfjs-node-gpu";

import { cardToString, cardValue, GameState, generateRandomGameState, valuateMonteCarlo } from "../common/card-game";
import { findMaxIndex, loadModel, predictModel } from "./model-helpers";
import { GamePhase, toModelName } from "../common/game-phase";
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
  phase: GamePhase,
  policyLookups: Record<string, Record<string, string>>,
  models: Record<string, tf.LayersModel>
) {
  return (state: GameState, moves: number[]) => {
    const player = state.players[state.playerIndex];
    const idx = state.calcPositionIndex();
    let idxHighestPlayed: number | null = null;
    if (
      state.highestPlayedIndex !== -1 &&
      phase.numberOfPlayers > 2 &&
      idx > 1 &&
      !(phase.numberOfCards === 3 && phase.playerIndex === phase.numberOfPlayers - 1)
    ) {
      const n = phase.numberOfPlayers;
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

export async function loadModels(phase: GamePhase) {
  const models: Record<string, tf.LayersModel> = {};
  const policyLookups: Record<string, Record<string, string>> = {};
  for (let iCard = 3; iCard <= phase.numberOfCards; iCard++) {
    for (let iPlayer = 0; iPlayer < phase.numberOfPlayers; iPlayer++) {
      const highestPlayedIndices = calcHighestPlayedIndices(phase.numberOfPlayers, phase.numberOfCards, iPlayer);
      for (const iHighestPlayed of highestPlayedIndices) {
        const modelName = toModelName(phase.numberOfPlayers, iCard, iPlayer, iHighestPlayed);
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
  phase: GamePhase,
  cache: Map<string, { seedIndex: number; value: string }>,
  policyNetworkCalc: (state: GameState, moves: number[]) => number,
  numRuns: number = 1000
): undefined {
  const t0 = performance.now();
  const rng0 = randomNumberGenerator(seed);
  const s0 = generateRandomGameState(seed, phase.numberOfPlayers, phase.numberOfCards, 0);
  for (let j = 0; j < phase.playerIndex; j++) {
    const ms = s0.possibleMoves();
    const m = ms[ms.length === 1 ? 0 : 1 + floor(rng0() * (ms.length - 1))];
    s0.playCard(m);
  }

  if (phase.highestPlayedIndex !== null && s0.highestPlayedIndex !== phase.highestPlayedIndex) {
    return;
  }

  const k = toKey(s0);
  if (cache.has(k)) return;
  const moves = s0.possibleMoves();
  if (moves.length === 1) return;
  const vals = moves.map(() => 0);
  const runs = moves.map(() => 0);
  const cards = moves.map((m) => cardToString(s0.players[phase.playerIndex].cards[m]));
  tf.tidy(() => {
    for (let j = 0; j < numRuns; j++) {
      for (let m = 0; m < moves.length; m++) {
        const rngr = randomNumberGenerator(`${seed}${j}`);
        const s = s0.clone();
        s.playCard(moves[m]);
        const v = valuateMonteCarlo(s, rngr, 1, phase.playerIndex, true, policyNetworkCalc);
        if (v === null) return;
        vals[m] += v.value;
        runs[m]++;
      }
    }
  });
  const t1 = performance.now();
  const elapsed = Math.round(t1 - t0);
  if (runs.some((r) => r === 0)) {
    return;
  }
  const mi = findMaxIndex(vals.map((v, ii) => v / runs[ii]));
  cache.set(k, { seedIndex: Number(seed), value: cards[mi] });
  const mn = phase.toString();
  const pad = (s: string, n: number) => (n > 0 ? s.padStart(n) : s.padEnd(-n));
  // eslint-disable-next-line no-console
  console.log(
    `${pad(mn, 4)} ${pad(cache.size.toString(), 4)} ${pad(seed, 5)} ${pad(elapsed.toString(), 5)} ${pad(k, -8)} ${pad(
      cards.join(""),
      -7
    )} ${cards[mi]} ${vals.map((d, ii) => (d / runs[ii]).toFixed(2).padStart(6)).join(" ")}`
  );
}
