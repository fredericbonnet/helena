---
source: src\helena-dialect\basic-commands.spec.ts
---
# `|>`

Pipe operator

## Usage

```lna
|> ?arg ...?
```

The pipe operator `|>` passes the result of the previous sentence in
the current script to the provided command.


## <a id="-specifications"></a>Specifications

- ✅ should return nil by default
- ✅ should return the result of the previous sentence when used with no argument
- ✅ should accept a command as first argument to pipe the result into
- ✅ should accept extra arguments to pipe after the result
- ✅ should accept tuple commands
- ✅ should work sequentially
- ✅ should reset between scripts
- ✅ should not propagate within blocks

