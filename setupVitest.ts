import { afterAll, beforeAll, beforeEach } from "vitest";

const setup = () => {
  process.env.NODE_ENV = "test";
  process.env.TZ = "Europe/Stockholm";
};

export { setup };

beforeAll(() => {});

beforeEach(() => {});

globalThis.after = afterAll;
globalThis.before = beforeAll;
