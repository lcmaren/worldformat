import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "../src/index.ts";

// Round-trip each valid fixture: parse → stringify → parse.
for (const name of ["minimal.world", "composition.world"]) {
  const world = parse(readFixture(name));
  const text = stringify(world);
  assertDeepEqual(parse(text), world, `round-trip ${name}`);
  assertEqual(stringify(parse(text)), text, `stable output for ${name}`);
}

// Exact text for the composition fixture.
assertEqual(
  stringify(parse(readFixture("composition.world"))),
  `[task]
name = "A"
priority = 1

[task]
name = "B"
priority = 2

[project]
name = "Demo"

[project/subtask]
name = "Subtask 1"
done = true
progress = 0.5
`,
  "composition output",
);

assertEqual(stringify({}), "", "empty world");

// A one-item array is written as a single node and reads back as that object.
roundTrip(
  { rules: [{ from: "a@example.com" }] },
  `[rules]\nfrom = "a@example.com"\n`,
  { rules: { from: "a@example.com" } },
  "one-item array",
);

// A one-item array may have child nodes: its path isn't an array.
roundTrip(
  { task: [{ name: "A", sub: { name: "S" } }] },
  `[task]\nname = "A"\n\n[task/sub]\nname = "S"\n`,
  { task: { name: "A", sub: { name: "S" } } },
  "one-item array with a child",
);

// An empty array is left out.
roundTrip(
  { rules: [], project: { name: "P" } },
  `[project]\nname = "P"\n`,
  { project: { name: "P" } },
  "empty array",
);

// A parent whose only child was an empty array still gets its header.
roundTrip({ a: { rules: [] } }, `[a]\n`, { a: {} }, "parent left empty");

// A parent without attributes gets no header of its own.
roundTrip(
  { project: { subtask: { name: "S" } } },
  `[project/subtask]\nname = "S"\n`,
  { project: { subtask: { name: "S" } } },
  "attribute-less parent",
);

// '#' inside a string survives comment stripping.
roundTrip(
  { rules: { subject_contains: "Order #123" } },
  `[rules]\nsubject_contains = "Order #123"\n`,
  { rules: { subject_contains: "Order #123" } },
  "'#' in a string",
);

// Refusals.
const refusals: [string, unknown][] = [
  ["root primitive", { x: 1 }],
  ["null", { a: { x: null } }],
  ["undefined", { a: { x: undefined } }],
  ["date", { a: { x: new Date(0) } }],
  ["nested array", { a: [[{ x: 1 }], [{ x: 2 }]] }],
  ["array of primitives", { a: { tags: ["x", "y"] } }],
  ["repeated node with a child", { a: [{ b: { x: 1 } }, { x: 2 }] }],
  ["NaN", { a: { x: NaN } }],
  ["Infinity", { a: { x: Infinity } }],
  ["-0", { a: { x: -0 } }],
  ["quote in string", { a: { x: 'say "hi"' } }],
  ["line break in string", { a: { x: "one\ntwo" } }],
  ["node key with '/'", { "a/b": { x: 1 } }],
  ["node key with '#'", { "a#b": { x: 1 } }],
  ["empty node key", { "": { x: 1 } }],
  ["attribute key with '='", { a: { "k=v": 1 } }],
  ["attribute key with '#'", { a: { "k#": 1 } }],
  ["attribute key with '\"'", { a: { 'k"': 1 } }],
  ["attribute key starting with '['", { a: { "[k": 1 } }],
  ["attribute key with surrounding spaces", { a: { " k": 1 } }],
  ["empty attribute key", { a: { "": 1 } }],
];

for (const [label, world] of refusals) {
  let threw = false;
  try {
    stringify(world as Record<string, unknown>);
  } catch {
    threw = true;
  }
  if (!threw) {
    throw new Error(`Expected stringify to throw for ${label}`);
  }
}

function roundTrip(
  world: Record<string, unknown>,
  expectedText: string,
  expectedWorld: unknown,
  label: string,
) {
  const text = stringify(world);
  assertEqual(text, expectedText, label);
  assertDeepEqual(parse(text), expectedWorld, label);
  assertEqual(stringify(parse(text)), text, `${label} (stable)`);
}

function readFixture(path: string): string {
  return readFileSync(join(import.meta.dirname, "..", "fixtures", path), "utf8");
}

function assertEqual(actual: string, expected: string, label: string) {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed (${label}):\n\nExpected:\n${expected}\n\nActual:\n${actual}`,
    );
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, label: string) {
  assertEqual(
    JSON.stringify(actual, null, 2),
    JSON.stringify(expected, null, 2),
    label,
  );
}
