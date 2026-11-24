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
import { parse, stringify, validate } from "worldformat";

const world = parse(`
[task]
name = "Test"
done = false
`);
// → { task: { name: "Test", done: false } }

validate("name = 1"); // → false: an attribute needs a node above it
```

`parse` throws on an invalid document; `validate` returns `false` instead.

`stringify` writes a world back as text:

```ts
stringify({ task: [{ name: "A" }, { name: "B" }] });
// → '[task]\nname = "A"\n\n[task]\nname = "B"\n'
```

`parse(stringify(world))` gives back `world`, except that arrays of 0 or 1
items come back the way `parse` reads them: a one-item array as that object,
an empty array as an absent key. The output is normalized, so comments and
layout from a hand-written document are not kept.

`stringify` throws on anything the format can't hold: values other than
strings, numbers and booleans (such as `null` or arrays of primitives),
strings containing `"` or a line break, `NaN`, `Infinity` and `-0`,
repeated nodes that have child nodes, and keys that `parse` would misread.

`parse` accepts some text that `stringify` won't write back, such as
`x = "say "hi""` or an unquoted `x = foo` (which reads as `NaN`). If a
document must stay writable, check that `stringify(parse(text))` succeeds
before saving it.

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
