# World Format

Reference implementation of the **World** text format.

This repository contains a minimal parser and related utilities
for reading and writing World documents.

The World format is a human-editable snapshot format designed for
small systems and human–AI workflows.

## Status

⚠️ Experimental.

- APIs may change without notice
- No stability or backward-compatibility guarantees
- Test coverage is minimal or nonexistent

## Specification

The format definition lives here:

https://worldformat.org

This repository follows the specification, but may lead or lag it
as the format evolves.

## Usage

```sh
npm install worldformat
```

```ts
import { parse, validate } from "worldformat";

const world = parse(`
[task]
name = "Test"
done = false
`);
// → { task: { name: "Test", done: false } }

validate("name = 1"); // → false: an attribute needs a node above it
```

`parse` throws on an invalid document; `validate` returns `false` instead.

The package is ESM only.

## Scope

This repository may grow to include:

- parsers
- generators
- format utilities

It intentionally does **not** include:

- schema enforcement
- validation rules
- storage layers

Those concerns belong elsewhere.

## License

MIT — see [LICENSE](LICENSE).
