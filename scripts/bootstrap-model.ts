import fs from "fs";

import * as tf from "@tensorflow/tfjs-node-gpu";

import { cardToString, cardValue, GameState, generateRandomGameState, valuateMonteCarlo } from "../common/card-game";
import { findMaxIndex, loadModel, predictModel, toModelName } from "./model-helpers";
import { TrainingSample, trainModel } from "./train-policy-model";
import { randomNumberGenerator } from "../common/RandomNumberGenerator";

const { floor } = Math;

function toKey(s: GameState) {
  const hc = s.highestPlayedValue === -1 ? "" : cardToString(s.highestPlayedValue);
  const { cards } = s.players[s.playerIndex];
  const pcs = cards.map(cardToString).join("");
  return `${pcs}-${hc}`;
}

// async function valuate(s: GameState, model: tf.LayersModel) {
//   const key = toKey(s);
//   const prediction = await predictModel(model, key);
//   return prediction;
// }

function writeValuations(data: TrainingSample[], filename: string) {
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

function readValuations(filename: string): TrainingSample[] {
  return JSON.parse(fs.readFileSync(filename, "utf8"));
}

async function bootstrapModel(
  numberOfPlayers: number,
  numberOfCards: number,
  playerIndex: number,
  highestPlayedIndex: number | null = null
) {
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
  const mn = toModelName(numberOfPlayers, numberOfCards, playerIndex, highestPlayedIndex);
  const mdl = models[mn];
  if (mdl) {
    // eslint-disable-next-line no-console
    console.log(`Model ${mn} already exists`);
    return null;
  }
  // eslint-disable-next-line no-console
  console.log(`Starting bootstrap for ${mn}`);

  const policyNetworkCalc = (state: GameState, moves: number[]) => {
    const player = state.players[state.playerIndex];
    // const idx = state.highestPlayedValue === -1 ? 0 : 1;
    // if (idx !== state.calcPositionIndex()) {
    //   console.log(state.toString());
    // }
    const idx = state.calcPositionIndex();
    let idxHighestPlayed: number | null = null;
    if (
      state.highestPlayedIndex !== -1 &&
      numberOfPlayers > 2 &&
      idx > 1 &&
      !(numberOfCards === 3 && playerIndex === 2)
    ) {
      const n = state.players.length;
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

  const NUM_RUNS = 1000;
  const cache: Map<string, { seedIndex: number; value: string }> = new Map();

  for (let i = 0; i < 40000; i++) {
    const seed = i.toString();
    const rng0 = randomNumberGenerator(seed);
    const s0 = generateRandomGameState(seed, numberOfPlayers, numberOfCards, 0);
    for (let j = 0; j < playerIndex; j++) {
      const ms = s0.possibleMoves();
      const m = ms[ms.length === 1 ? 0 : 1 + floor(rng0() * (ms.length - 1))];
      s0.playCard(m);
    }
    // if (playerIndex === 0 && s0.highestPlayedValue !== -1) {
    //   continue;
    // }
    // if (playerIndex === 1 && s0.highestPlayedValue === -1) {
    //   continue;
    // }

    if (highestPlayedIndex !== null && s0.highestPlayedIndex !== highestPlayedIndex) {
      continue;
    }

    const k = toKey(s0);
    if (cache.has(k)) continue;
    const moves = s0.possibleMoves();
    if (moves.length === 1) continue;
    const vals = moves.map(() => 0);
    const runs = moves.map(() => 0);
    const cards = moves.map((m) => cardToString(s0.players[playerIndex].cards[m]));
    for (let j = 0; j < NUM_RUNS; j++) {
      for (let m = 0; m < moves.length; m++) {
        const rngr = randomNumberGenerator(`${seed}${j}`);
        const s = s0.clone();
        s.playCard(moves[m]);
        const v = valuateMonteCarlo(s, rngr, 1, playerIndex, true, policyNetworkCalc);
        if (v === null) continue;
        vals[m] += v.value;
        runs[m]++;
      }
    }
    const mi = findMaxIndex(vals.map((v, ii) => v / runs[ii]));
    cache.set(k, { seedIndex: i, value: cards[mi] });
    // eslint-disable-next-line no-console
    console.log(
      `${cache.size.toString().padStart(5)} ${i.toString().padStart(5)} ${k.padEnd(10)} ${cards.join("").padEnd(7)} ${
        cards[mi]
      } ${vals.map((d, ii) => (d / runs[ii]).toFixed(2).padStart(6)).join(" ")}`
    );
    if (cache.size >= 5000) {
      break;
    }
    // console.log(
    //   `${(t1 - t0).toFixed(0)} ${seed} ${v.toFixed(2)} ${
    //     moveCards[moveValuations.indexOf(min(...moveValuations))]
    //   } ${s0.toString()}`
    // ); // eslint-disable-line no-console
    // const t2 = performance.now();
  }
  const vals = Array.from(cache.entries()); //.sort((a, b) => a[1] - b[1]);
  return vals.map(([k, v]) => ({ key: k, value: v.value, seedIndex: v.seedIndex } as TrainingSample));
}

function calcHighestPlayedIndices(numberOfPlayers: number, numberOfCards: number, playerIndex: number) {
  if (numberOfPlayers === 2 || playerIndex <= 1 || (numberOfCards === 3 && playerIndex === 2)) {
    return [null];
  }
  return [...Array(playerIndex)].map((_, i) => i);
}

async function main() {
  const args = process.argv.slice(2);
  const numberOfPlayers = args[0] ? parseInt(args[0], 10) : 3;
  for (let numberOfCards = 4; numberOfCards <= 7; numberOfCards++) {
    for (let playerIndex = numberOfPlayers - 1; playerIndex >= 0; playerIndex--) {
      const highestPlayedIndices = calcHighestPlayedIndices(numberOfPlayers, numberOfCards, playerIndex);
      for (const highestPlayedIndex of highestPlayedIndices) {
        const data = await bootstrapModel(numberOfPlayers, numberOfCards, playerIndex, highestPlayedIndex);
        if (!data || data.length === 0) continue;
        const modelName = toModelName(numberOfPlayers, numberOfCards, playerIndex, highestPlayedIndex);
        // const filename = `data/valuations-${modelName}.json`;
        // const data = readValuations(filename);
        writeValuations(data, `data/valuations-${modelName}.json`);
        await trainModel(modelName, numberOfCards, data);
      }
    }
  }
}
main();
// bootstrapModel(3, 4, 2);
