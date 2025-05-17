import fs from "fs";

import {
  calcHighestPlayedIndices,
  loadModels,
  policyNetworkCalcFactory,
  readValuations,
  simulateSeed,
} from "./bootstrap-helpers";
import { TrainingSample, trainModel } from "./train-policy-model";
import { GamePhase } from "../common/game-phase";

// async function valuate(s: GameState, model: tf.LayersModel) {
//   const key = toKey(s);
//   const prediction = await predictModel(model, key);
//   return prediction;
// }

function writeValuations(data: TrainingSample[], filename: string) {
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

async function bootstrapModel(phase: GamePhase) {
  const { models, policyLookups } = await loadModels(phase);
  const mn = phase.getModelName();
  const mdl = models[mn];
  if (mdl) {
    // eslint-disable-next-line no-console
    console.log(`Model ${mn} already exists`);
    return null;
  }
  // eslint-disable-next-line no-console
  console.log(`Starting bootstrap for ${mn}`);

  const policyNetworkCalc = policyNetworkCalcFactory(phase, policyLookups, models);

  const cache: Map<string, { seedIndex: number; value: string }> = new Map();

  const filename = `data/valuations-${mn}.json`;
  if (fs.existsSync(filename)) {
    const data = readValuations(filename);
    for (const v of data) {
      cache.set(v.key, { seedIndex: v.seedIndex, value: v.value });
    }
  }

  let writeTimestamp: number = Date.now() / 1000;

  for (let i = 0; i < 100_000; i++) {
    const seed = i.toString();
    const cont = simulateSeed(seed, phase, cache, policyNetworkCalc);
    if (!cont) break;
    if (Date.now() / 1000 - writeTimestamp > 60) {
      const data = Array.from(cache.entries()).map(
        ([k, v]) => ({ key: k, value: v.value, seedIndex: v.seedIndex } as TrainingSample)
      );
      writeValuations(data, `data/valuations-${mn}.json`);
      writeTimestamp = Date.now() / 1000;
    }
  }

  const vals = Array.from(cache.entries()); //.sort((a, b) => a[1] - b[1]);
  return vals.map(([k, v]) => ({ key: k, value: v.value, seedIndex: v.seedIndex } as TrainingSample));
}

async function main() {
  const args = process.argv.slice(2);
  const numberOfPlayers = args.at(-1) ? parseInt(args.at(-1)!, 10) : 3;
  for (let numberOfCards = 3; numberOfCards <= 7; numberOfCards++) {
    for (let playerIndex = numberOfPlayers - 1; playerIndex >= 0; playerIndex--) {
      if (playerIndex === 0 && numberOfCards === 7) continue;
      const highestPlayedIndices = calcHighestPlayedIndices(numberOfPlayers, numberOfCards, playerIndex);
      for (const highestPlayedIndex of highestPlayedIndices) {
        // if (playerIndex === 2) continue;
        const phase = new GamePhase(numberOfPlayers, numberOfCards, playerIndex, highestPlayedIndex);
        const data = await bootstrapModel(phase);
        if (!data || data.length === 0) continue;
        const modelName = phase.getModelName();
        writeValuations(data, `data/valuations-${modelName}.json`);
        // const filename = `data/valuations-${modelName}.json`;
        // const data = readValuations(filename);
        // await new Promise((resolve) => {
        //   tf.tidy(() => {
        //     trainModel(modelName, numberOfCards, data).then(resolve);
        //   });
        // });
        await trainModel(modelName, numberOfCards, data);
      }
    }
  }
}

main();
// bootstrapModel(3, 4, 2);

// const modelName = "3621";
// const filename = `data/valuations-${modelName}.json`;
// const data = readValuations(filename)
// await trainModel(modelName, 6, data);

// const filename = `data/valuations-${modelName}.json`;
// const data = readValuations(filename);

async function mainSingle() {
  const phase = new GamePhase(5, 3, 0, null);
  const getVals = (modelName: string) => {
    const filename = `./data/valuations-${modelName}.json`;
    const res = JSON.parse(fs.readFileSync(filename, "utf8"));
    return res.filter((v: any) => v.key.slice(2, 3) !== v.value);
  };
  const { models, policyLookups } = await loadModels(phase);
  const cache: Map<string, { seedIndex: number; value: string }> = new Map();
  const policyNetworkCalc = policyNetworkCalcFactory(
    phase,
    policyLookups,
    models
  );
  const vals = getVals(phase.getModelName());
  for (const v of vals) {
    simulateSeed(v.seedIndex.toString(), phase, cache, policyNetworkCalc, 3000);
  }
}

// async function mainSingle() {
//   const phase = new GamePhase(4, 3, 0, null);
//   const { models, policyLookups } = await loadModels(phase);
//   const cache: Map<string, { seedIndex: number; value: string }> = new Map();
//   const policyNetworkCalc = policyNetworkCalcFactory(phase, policyLookups, models);
//   const t1 = performance.now();
//   for (let i = 0; i < 10; i++) {
//     simulateSeed(i.toString(), phase, cache, policyNetworkCalc, 1000);
//   }
//   const t2 = performance.now();
//   console.log(`${(t2 - t1).toFixed(0)}`); // eslint-disable-line no-console
// }

// mainSingle();
