---
source: src\helena-dialect\basic-commands.spec.ts
---
# <a id="tailcall"></a>`tailcall`

Transfer execution to another script

## Usage

```lna
tailcall body
```

The `tailcall` command is a control flow command that stops the script
with a `RETURN` code and the evaluated result of another script passed
as argument.


## <a id="tailcall-specifications"></a>Specifications

- ✅ usage
- ✅ result code should be `RETURN`
- ✅ should accept script values for its `body` argument
- ✅ should accept tuple values for its `body` argument
- ✅ should return the evaluation result of it `body` argument
- ✅ should propagate `ERROR` code from `body`
- ✅ should propagate `BREAK` code from `body`
- ✅ should propagate `CONTINUE` code from `body`
- ✅ should interrupt the script
- ✅ should work recursively

## <a id="tailcall-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `body`

  The `body` argument must be a script or tuple.


