---
source: src\helena-dialect\basic-commands.spec.ts
---
# <a id="break"></a>`break`

Stop execution with `BREAK` code

## Usage

```lna
break
```

The `yield` command is a control flow command that stops the script
with a `BREAK` code.


## <a id="break-specifications"></a>Specifications

- ✅ usage
- ✅ result code should be `BREAK`

## <a id="break-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.


