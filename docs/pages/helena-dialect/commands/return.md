---
source: src\helena-dialect\basic-commands.spec.ts
---
# <a id="return"></a>`return`

Stop execution with `RETURN` code

## Usage

```lna
return ?result?
```

The `return` command is a control flow command that stops the script
with a `RETURN` code and an optional result value.


## <a id="return-specifications"></a>Specifications

- ✅ usage
- ✅ result code should be `RETURN`
- ✅ should return nil by default
- ✅ should return its optional `result` argument
- ✅ should interrupt the script

## <a id="return-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.


