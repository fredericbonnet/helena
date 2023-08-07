---
source: src\helena-dialect\basic-commands.spec.ts
---
# <a id="error"></a>`error`

Stop execution with `ERROR` code

## Usage

```lna
error message
```

The `yield` command is a control flow command that stops the script
with a `ERROR` code and a message value.


## <a id="error-specifications"></a>Specifications

- ✅ usage
- ✅ result code should be `ERROR`
- ✅ result value should be its `message` argument

## <a id="error-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ non-string `message`

  Only values with a string representation are accepted as the
  `message` argument.


