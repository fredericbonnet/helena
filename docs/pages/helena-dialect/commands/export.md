---
source: src\helena-dialect\modules.spec.ts
---
# <a id="export"></a>`export`

Export a command from the current module

## Usage

```lna
export name
```

The `export` command exports a command from the current module by
making it available for other modules through its `import` subcommand.


## <a id="export-specifications"></a>Specifications

- ✅ usage
- ✅ should not exist in non-module scope
- ✅ should exist in module scope
- ✅ should return nil
- ✅ should add command name to exports
- ✅ should allow non-existing command names

## <a id="export-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `name`

  Command names must have a valid string representation.


