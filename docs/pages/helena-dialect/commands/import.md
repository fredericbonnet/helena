---
source: src\helena-dialect\modules.spec.ts
---
# <a id="import"></a>`import`

Load a module

## Usage

```lna
import path ?name|imports?
```

The `import` command loads a module from the file system. On first
load, the file content is evaluated as a script in a new module scope,
and the module is added to a global registry.

- ✅ named modules

## <a id="import-specifications"></a>Specifications

- ✅ usage
- ✅ should return a module object
- ✅ relative paths should resolve relatively to the working directory
- ✅ in-module relative paths should resolve relatively to the module path
- ✅ multiple imports should resolve to the same object
- ✅ should not support circular imports

- `name`

  - ✅ should define a new command
  - ✅ should replace existing commands
  - ✅ the named command should return its command object

- `imports`

  - ✅ should declare imported commands in the calling scope
  - ✅ should accept tuples
  - ✅ should accept lists
  - ✅ should accept blocks
  - ✅ should accept (name alias) tuples

  - Exceptions

    - ✅ unknown export
    - ✅ unresolved export
    - ✅ invalid import name
    - ✅ invalid alias name
    - ✅ invalid name tuple

## <a id="import-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.


