---
source: src\helena-dialect\basic-commands.spec.ts
---
# <a id="eval"></a>`eval`

Evaluate a script

## Usage

```lna
eval body
```

The command `eval` evaluates and returns the result of a Helena script
in the current scope.


## <a id="eval-specifications"></a>Specifications

- ✅ usage
- ✅ should return nil for empty `body`
- ✅ should return the result of the last command evaluated in `body`
- ✅ should evaluate `body` in the current scope
- ✅ should accept tuple `body` arguments
- ✅ should work recursively

## <a id="eval-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `body`

  The `body` argument must be a script or tuple.


## <a id="eval-control-flow"></a>Control flow

Control flow commands will interrupt the evaluated script.


- `return`

  - ✅ should interrupt the body with `RETURN` code
  - ✅ should return passed value

- `tailcall`

  - ✅ should interrupt the body with `RETURN` code
  - ✅ should return tailcall result

- `yield`

  - ✅ should interrupt the body with `YIELD` code
  - ✅ should provide a resumable state

    Scripts interrupted with `yield` can be resumed later.


- `error`

  - ✅ should interrupt the body with `ERROR` code

- `break`

  - ✅ should interrupt the body with `BREAK` code

- `continue`

  - ✅ should interrupt the body with `CONTINUE` code

