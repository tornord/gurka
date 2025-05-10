import fs from "fs";

import * as tf from "@tensorflow/tfjs-node-gpu";

import { cardFromString, cardToString } from "../common/card-game";
import { cardsToInput, findMaxIndex, loadModel, predictModel, toJson } from "./model-helpers";

const { floor } = Math;

function buildModel(numInputFeatures: number, numHiddenUnits: number[]) {
  const model = tf.sequential();
  model.add(tf.layers.dense({ inputShape: [numInputFeatures], units: numHiddenUnits[0], activation: "relu" }));
  for (const d of numHiddenUnits) {
    model.add(tf.layers.dense({ units: d, activation: "relu" }));
  }
  model.add(tf.layers.dense({ units: 13, activation: "softmax" }));
  return model;
}

export interface TrainingSample {
  seedIndex: number;
  key: string;
  value: string;
}

function testModel(model: tf.LayersModel, testData: TrainingSample[]) {
  let totalError = 0;
  for (let i = 0; i < testData.length; i++) {
    const { key, value } = testData[i];
    const prediction = predictModel(model, key);
    const maxIndex = findMaxIndex(prediction);
    // let maxValue = -Infinity;
    // let maxIndex = -1;
    // for (let j = 0; j < prediction.length; j++) {
    //   if (prediction[j] > maxValue) {
    //     maxValue = prediction[j];
    //     maxIndex = j;
    //   }
    // }
    if (i < 20) {
      console.log(`Input ${key}: expect ${value}, predict ${cardToString(maxIndex)}`); // eslint-disable-line no-console
    }
    const e = cardFromString(value) === maxIndex ? 0 : 1;
    totalError += e;
    if (e === 1) {
      console.log(`Diff Input ${key}: expect ${value}, predict ${cardToString(maxIndex)}`); // eslint-disable-line no-console
    }
  }
  console.log(`Total error: ${(totalError / testData.length).toFixed(2)}`); // eslint-disable-line no-console
}

function shuffle(data: TrainingSample[]) {
  const res: TrainingSample[] = data.slice();
  for (let i = 0; i < res.length - 1; i++) {
    const j = i + Math.floor(Math.random() * (res.length - i));
    const v = res[j];
    res[j] = res[i];
    res[i] = v;
  }
  return res;
}

export async function trainModel(
  numberOfPlayers: number,
  numberOfCards: number,
  playerIndex: number,
  data: TrainingSample[] | null = null
) {
  const modelName = `${numberOfPlayers}${numberOfCards}${playerIndex}`;
  if (data === null) {
    data = JSON.parse(fs.readFileSync(`data/valuations-${modelName}.json`, "utf8")) as TrainingSample[];
  }
  if (data.length > 13) {
    data = shuffle(data);
  }
  const n = data.length === 13 ? data.length : Math.floor(0.95 * data.length);
  const trainData = data.slice(0, n);
  const testData = n === data.length ? data : data.slice(n);
  const NUM_SAMPLES = trainData.length;
  const k0 = cardsToInput(trainData[0].key);
  const NUM_INPUT_FEATURES = k0.length;
  // Convert training data to tensors
  const xs = tf.tensor2d(
    trainData.map((v) => cardsToInput(v.key)),
    [NUM_SAMPLES, NUM_INPUT_FEATURES]
  );
  const ys = tf.tensor2d(
    trainData.map((v) => cardsToInput(v.value, 0)),
    [NUM_SAMPLES, 13]
  );
  const us = [2 * NUM_INPUT_FEATURES];
  if (modelName !== "1") {
    us.push(2 * NUM_INPUT_FEATURES);
    if (numberOfCards >= 5) {
      us.push(NUM_INPUT_FEATURES);
    }
    us.push(floor(NUM_INPUT_FEATURES / 2));
  }
  const model = buildModel(NUM_INPUT_FEATURES, us);

  model.compile({
    optimizer: tf.train.adam(),
    loss: tf.losses.meanSquaredError,
  });
  const totalWeightCount = model
    .getWeights()
    .map((w) => w.size)
    .reduce((a, b) => a + b, 0);
  console.log(`Total number of scalar weights: ${totalWeightCount}`); // eslint-disable-line no-console

  console.log("Starting training..."); // eslint-disable-line no-console

  const NUM_EPOCHS = modelName !== "1" ? 300 : 600;
  await model.fit(xs, ys, {
    epochs: NUM_EPOCHS,
    batchSize: 32,
    verbose: 1,
    callbacks: [
      {
        onEpochEnd: (epoch: number, logs: tf.Logs | undefined) => {
          const m = floor(NUM_EPOCHS / 20);
          if (epoch % m < m - 1) return;
          console.log(`Epoch ${epoch + 1}: loss = ${logs!.loss}`); // eslint-disable-line no-console
        },
      },
    ],
  });
  console.log("Training complete."); // eslint-disable-line no-console

  // await testModel(model, testData, NUM_FEATURES);

  const json = await toJson(model, "model");
  fs.writeFileSync(`data/model-${modelName}.json`, JSON.stringify(json, null, 2));
  const model2 = await loadModel(json);
  testModel(model2, testData);
}

// trainModel(3, 3, 1);
