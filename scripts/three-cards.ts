import fs from "fs";
import path from "path";

function getVals(modelName: string) {
  const filename = `./data/valuations-${modelName}.json`;
  const res = JSON.parse(fs.readFileSync(filename, "utf8"));
  return res.filter((v: any) => v.key.slice(2, 3) === "K" && v.value !== "K");
}
function main() {
  const vals330 = getVals("330");
  const vals331 = getVals("331");


  console.log(vals330);
}

main();
