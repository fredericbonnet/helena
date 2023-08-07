---
source: src\helena-dialect\basic-commands.spec.ts
---
# <a id="continue"></a>`continue`

Stop execution with `CONTINUE` code

## Usage

```lna
continue
```

The `yield` command is a control flow command that stops the script
with a `CONTINUE` code.


## <a id="continue-specifications"></a>Specifications

- ✅ usage
- ✅ result code should be `CONTINUE`

## <a id="continue-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.


