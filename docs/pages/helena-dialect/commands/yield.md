---
source: src\helena-dialect\basic-commands.spec.ts
---
# <a id="yield"></a>`yield`

Pause execution with `YIELD` code

## Usage

```lna
yield ?result?
```

The `yield` command is a control flow command that pauses the script
with a `YIELD` code and an optional result value. The script state is
saved for later resumability.


## <a id="yield-specifications"></a>Specifications

- ✅ usage
- ✅ result code should be `YIELD`
- ✅ should yield nil by default
- ✅ should yield its optional `result` argument

## <a id="yield-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.


