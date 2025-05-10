import fs from "fs";

import * as tf from "@tensorflow/tfjs-node-gpu";

import { cardToString, cardValue, GameState, generateRandomGameState, valuateMonteCarlo } from "../common/card-game";
import { findMaxIndex, loadModel, predictModel } from "./model-helpers";
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

async function bootstrapModel(numberOfPlayers: number, numberOfCards: number, playerIndex: number) {
  const models: Record<string, tf.LayersModel> = {};
  const policyLookups: Record<string, Record<string, string>> = {};
  for (let i = 3; i <= numberOfCards; i++) {
    for (let j = 0; j < numberOfPlayers; j++) {
      const modelName = `${numberOfPlayers}${i}${j}`;
      let filename = `./data/model-${modelName}.json`;
      if (!fs.existsSync(filename)) continue;
      const modelJson = JSON.parse(fs.readFileSync(filename, "utf8"));
      const model = await loadModel(modelJson);
      models[modelName] = model;
      filename = `./data/valuations-${modelName}.json`;
      if (!fs.existsSync(filename)) continue;
      const dict = Object.fromEntries(JSON.parse(fs.readFileSync(filename, "utf8")).map((d: TrainingSample) => [d.key, d.value]));
      policyLookups[modelName] = dict;
    }
  }
  const mn = `${numberOfPlayers}${numberOfCards}${playerIndex}`;
  const mdl = models[mn];
  if (mdl) {
    // eslint-disable-next-line no-console
    console.log(`Model ${mn} already exists`);
    return;
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
    const modelName = `${state.players.length}${player.cards.length}${idx}`;
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
    if (playerIndex === 0 && s0.highestPlayedValue !== -1) {
      continue;
    }
    if (playerIndex === 1 && s0.highestPlayedValue === -1) {
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
      `${i} ${k} ${cards.join("")} ${cards[mi]} ${cache.size} ${vals
        .map((d, ii) => (d / runs[ii]).toFixed(2))
        .join(" ")}`
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
  const data: TrainingSample[] = vals.map(([k, v]) => ({ key: k, value: v.value, seedIndex: v.seedIndex }));
  console.log(vals.length); // eslint-disable-line no-console
  if (data.length > 0) {
    writeValuations(data, `data/valuations-${numberOfPlayers}${numberOfCards}${playerIndex}.json`);
    await trainModel(numberOfPlayers, numberOfCards, playerIndex, data);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const numberOfPlayers = args[0] ? parseInt(args[0], 10) : 3;
  for (let numberOfCards = 3; numberOfCards <= 7; numberOfCards++) {
    for (let playerIndex = numberOfPlayers - 1; playerIndex >= 0; playerIndex--) {
      await bootstrapModel(numberOfPlayers, numberOfCards, playerIndex);
    }
  }
}

main();
