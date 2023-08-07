---
source: src\helena-dialect\scripts.spec.ts
---
# <a id="parse"></a>`parse`

Helena script parsing

## Usage

```lna
parse source
```

The `parse` command is used to parse script source strings into script
values.

Script values are Helena values whose internal type is `SCRIPT`.


## <a id="parse-specifications"></a>Specifications

- ✅ should return a script value
- ✅ should return parsed script and source
- ✅ should parse blocks as string values

## <a id="parse-exceptions"></a>Exceptions

- ✅ wrong arity

  The subcommand will return an error message with usage when given the
  wrong number of arguments.

- ✅ parsing error
- ✅ values with no string representation

