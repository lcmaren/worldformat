type AnyObj = Record<string, any>;

function parseValue(raw: string): string | number | boolean {
  // string
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1);
  }

  // boolean
  if (raw === "true") return true;
  if (raw === "false") return false;

  // number
  return Number(raw);
}

export function parse(text: string) {
  const root: AnyObj = {};

  const lines = text.split(/\r?\n/);

  let currentPath: string[] | null = null;
  let currentNode: AnyObj | null = null;

  for (const rawLine of lines) {
    const line = stripComment(rawLine);
    if (!line) continue;

    // Node declaration
    if (line.startsWith("[") && line.endsWith("]")) {
      const path = line.slice(1, -1).split("/");

      let cursor: AnyObj = root;

      for (let i = 0; i < path.length; i++) {
        const key = path[i];
        const isLeaf = i === path.length - 1;

        if (isLeaf) {
          if (!(key in cursor)) {
            cursor[key] = {};
            currentNode = cursor[key];
          } else if (Array.isArray(cursor[key])) {
            const obj: AnyObj = {};
            cursor[key].push(obj);
            currentNode = obj;
          } else {
            const first = cursor[key];
            const obj: AnyObj = {};
            cursor[key] = [first, obj];
            currentNode = obj;
          }
        } else {
          if (!(key in cursor)) {
            cursor[key] = {};
          } else if (Array.isArray(cursor[key])) {
            throw new Error(
              `Ambiguous parent path: "${path.slice(0, i + 1).join("/")}"`,
            );
          }

          cursor = cursor[key];
        }
      }

      currentPath = path;
      continue;
    }

    // Attribute
    if (currentNode) {
      const idx = line.indexOf("=");
      if (idx === -1) {
        throw new Error(`Invalid line: "${line}"`);
      }

      const key = line.slice(0, idx).trim();
      const rawValue = line.slice(idx + 1).trim();

      currentNode[key] = parseValue(rawValue);
      continue;
    }

    // If we reach here, the line is invalid
    throw new Error(`Invalid line: "${line}"`);
  }

  return root;
}

export function validate(text: string): boolean {
  try {
    parse(text);
    return true;
  } catch {
    return false;
  }
}

function stripComment(line: string): string {
  let inString = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (ch === "#" && !inString) {
      return line.slice(0, i).trim();
    }
  }

  return line.trim();
}

/**
 * Write a World document for `world`, the inverse of `parse`.
 *
 * `parse(stringify(world))` deep-equals `world`, except that arrays of 0 or 1
 * items come back the way `parse` reads them: a one-item array as that object,
 * an empty array as an absent key. Anything else the format can't hold
 * throws. Comments and layout are not kept; the output is normalized.
 */
export function stringify(world: Record<string, unknown>): string {
  if (!isPlainObject(world)) {
    throw new Error("Cannot stringify: the world must be a plain object");
  }

  const blocks: string[] = [];
  writeNode([], world, blocks);
  return blocks.length ? blocks.join("\n\n") + "\n" : "";
}

function writeNode(path: string[], obj: AnyObj, blocks: string[]) {
  const attrs: string[] = [];
  const children: [string, AnyObj | AnyObj[]][] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (isPlainObject(value)) {
      children.push([key, value]);
    } else if (Array.isArray(value)) {
      if (value.length > 0) children.push([key, value]);
    } else {
      if (path.length === 0) {
        throw new Error(
          `Cannot stringify "${key}": an attribute needs a node; the root holds only nodes`,
        );
      }
      checkAttributeKey(path, key);
      attrs.push(`${key} = ${formatValue(path, key, value)}`);
    }
  }

  if (path.length > 0 && (attrs.length > 0 || children.length === 0)) {
    blocks.push([`[${path.join("/")}]`, ...attrs].join("\n"));
  }

  for (const [key, value] of children) {
    const childPath = [...path, key];
    checkNodeKey(childPath);

    if (!Array.isArray(value)) {
      writeNode(childPath, value, blocks);
    } else if (value.length === 1) {
      writeNode(childPath, arrayItem(childPath, value[0]), blocks);
    } else {
      for (const item of value) {
        const node = arrayItem(childPath, item);
        for (const [k, v] of Object.entries(node)) {
          if (isPlainObject(v) || Array.isArray(v)) {
            throw new Error(
              `Cannot stringify "${childPath.join("/")}/${k}": a repeated node can't have child nodes`,
            );
          }
        }
        writeNode(childPath, node, blocks);
      }
    }
  }
}

function arrayItem(path: string[], item: unknown): AnyObj {
  if (!isPlainObject(item)) {
    throw new Error(
      `Cannot stringify "${path.join("/")}": array items must be plain objects`,
    );
  }
  return item;
}

function formatValue(path: string[], key: string, value: unknown): string {
  const where = `"${[...path, key].join("/")}"`;

  if (typeof value === "string") {
    if (value.includes('"')) {
      throw new Error(`Cannot stringify ${where}: strings can't contain '"'`);
    }
    if (/[\r\n]/.test(value)) {
      throw new Error(`Cannot stringify ${where}: strings can't contain line breaks`);
    }
    return `"${value}"`;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      const shown = Object.is(value, -0) ? "-0" : String(value);
      throw new Error(`Cannot stringify ${where}: ${shown} isn't supported`);
    }
    return String(value);
  }

  if (typeof value === "boolean") return String(value);

  const kind = value === null ? "null" : typeof value === "object" ? "a non-plain object" : typeof value;
  throw new Error(
    `Cannot stringify ${where}: ${kind} isn't a string, number or boolean`,
  );
}

function checkNodeKey(path: string[]) {
  const key = path[path.length - 1];
  if (key === "" || /[/#"\r\n]/.test(key)) {
    throw new Error(
      `Cannot stringify "${path.join("/")}": a node key must be non-empty and can't contain '/', '#', '"' or line breaks`,
    );
  }
}

function checkAttributeKey(path: string[], key: string) {
  if (
    key === "" ||
    key !== key.trim() ||
    key.startsWith("[") ||
    /[=#"\r\n]/.test(key)
  ) {
    throw new Error(
      `Cannot stringify "${[...path, key].join("/")}": an attribute key must be non-empty, have no surrounding spaces, not start with '[', and can't contain '=', '#', '"' or line breaks`,
    );
  }
}

function isPlainObject(value: unknown): value is AnyObj {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
