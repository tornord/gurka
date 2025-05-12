import fs from "fs";

import * as tf from "@tensorflow/tfjs";
import { cardFromString } from "../common/card-game";

function base64ToArrayBuffer(base64: string) {
  const binaryString = Buffer.from(base64, "base64").toString("binary");
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function toModelName(
  numberOfPlayers: number,
  numberOfCards: number,
  playerIndex: number,
  highestPlayedIndex: number | null
) {
  return `${numberOfPlayers}${numberOfCards}${playerIndex}${highestPlayedIndex === null ? "" : highestPlayedIndex}`;
}

interface Model {
  modelTopology: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  weightSpecs: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  weightData: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

class ModelLoader {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(modelTopology: any, weightSpecs: any, weightData: any) {
    this.modelTopology = modelTopology;
    this.weightSpecs = weightSpecs;
    this.weightData = weightData;
  }

  modelTopology: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  weightSpecs: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  weightData: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  load() {
    return this;
  }
}

export async function loadModel(modelJson: Model) {
  const ws = base64ToArrayBuffer(modelJson.weightData);
  const ldr = new ModelLoader(modelJson.modelTopology, modelJson.weightSpecs, ws);
  return await tf.loadLayersModel(ldr as unknown as tf.io.IOHandler);
}

export async function toJson(model: tf.LayersModel, name: string) {
  const ws = model.getNamedWeights();
  const { data: weightData, specs: weightSpecs } = await tf.io.encodeWeights(ws);
  const modelTopology = model.toJSON(null, false);
  return { name, modelTopology, weightSpecs, weightData: Buffer.from(weightData).toString("base64") }; // new Buffer(weightData).toString("base64") };
}

export async function writeModel(model: tf.LayersModel, name: string) {
  const json = await toJson(model, name);
  fs.writeFileSync(`data/model-${name}.json`, JSON.stringify(json, null, 2));
}

export function cardsToInput(cards: string, fillValue: number = -1): number[] {
  const cs = cards.replace(/-/g, "").split("");
  const inputs: number[][] = [];
  for (const token of cs) {
    const idx = cardFromString(token);
    const oneHot = Array(13).fill(fillValue);
    oneHot[idx] = 1;
    inputs.push(oneHot);
  }
  return inputs.flat();
}

export function predictModel(model: tf.LayersModel, cards: string): number[] {
  const input = cardsToInput(cards);
  const x = tf.tensor2d([input], [1, input.length]);
  // const predictionTensor = model.predict(tf.randomNormal([1, input.length]));
  const predictionTensor = model.predict(x);
  const prediction = (predictionTensor as tf.Tensor).dataSync();
  return Array.from(prediction);
  // return [...Array(13)].map(() => Math.random());
}

export function findMaxIndex(a: number[]) {
  let m: number | null = null;
  let mv: number | null = null;
  for (let i = 0; i < a.length; i++) {
    if (mv === null || a[i] > mv!) {
      m = i;
      mv = a[i];
    }
  }
  return m!;
}
