import fs from "fs";

import { calcHighestPlayedIndices, loadModels, policyNetworkCalcFactory, simulateSeed } from "./bootstrap-helpers";
import { TrainingSample, trainModel } from "./train-policy-model";
import { toModelName } from "./model-helpers";

// async function valuate(s: GameState, model: tf.LayersModel) {
//   const key = toKey(s);
//   const prediction = await predictModel(model, key);
//   return prediction;
// }

function writeValuations(data: TrainingSample[], filename: string) {
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

async function bootstrapModel(
  numberOfPlayers: number,
  numberOfCards: number,
  playerIndex: number,
  highestPlayedIndex: number | null = null
) {
  const { models, policyLookups } = await loadModels(numberOfPlayers, numberOfCards);
  const mn = toModelName(numberOfPlayers, numberOfCards, playerIndex, highestPlayedIndex);
  const mdl = models[mn];
  if (mdl) {
    // eslint-disable-next-line no-console
    console.log(`Model ${mn} already exists`);
    return null;
  }
  // eslint-disable-next-line no-console
  console.log(`Starting bootstrap for ${mn}`);

  const policyNetworkCalc = policyNetworkCalcFactory(
    numberOfPlayers,
    numberOfCards,
    playerIndex,
    policyLookups,
    models
  );

  const cache: Map<string, { seedIndex: number; value: string }> = new Map();

  for (let i = 0; i < 100_000; i++) {
    const seed = i.toString();
    const cont = simulateSeed(
      seed,
      numberOfPlayers,
      numberOfCards,
      playerIndex,
      highestPlayedIndex,
      cache,
      policyNetworkCalc
    );
    if (!cont) break;
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
        const data = await bootstrapModel(numberOfPlayers, numberOfCards, playerIndex, highestPlayedIndex);
        if (!data || data.length === 0) continue;
        const modelName = toModelName(numberOfPlayers, numberOfCards, playerIndex, highestPlayedIndex);
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
// function getVals(modelName: string) {
//   const filename = `./data/valuations-${modelName}.json`;
//   const res = JSON.parse(fs.readFileSync(filename, "utf8"));
//   return res.filter((v: any) => "Q".split("").includes(v.key.slice(2, 3)) && v.value !== v.key.slice(2, 3));
// }

// async function mainSingle() {
//   const { models, policyLookups } = await loadModels(4, 3);
//   const cache: Map<string, { seedIndex: number; value: string }> = new Map();
//   const policyNetworkCalc = policyNetworkCalcFactory(4, 3, 0, policyLookups, models);
//   const vals330 = getVals("430");
//   for (const v of vals330) {
//     simulateSeed(v.seedIndex.toString(), 4, 3, 0, null, cache, policyNetworkCalc);
//   }
// }

// mainSingle();
