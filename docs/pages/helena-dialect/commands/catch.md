---
source: src\helena-dialect\controls.spec.ts
---
# <a id="catch"></a>`catch`

Result handling

## Usage

```lna
catch body ?return value handler? ?yield value handler? ?error message handler? ?break handler? ?continue handler? ?finally handler?
```

The `catch` command is used to intercept specific result codes with
handler scripts.

It is inspired by the Tcl command `catch` but with a distinct syntax.


## <a id="catch-specifications"></a>Specifications

- ✅ usage

- without handler

  - ✅ `OK` code should return `(ok value)` tuple
  - ✅ `RETURN` code should return `(return value)` tuple
  - ✅ `YIELD` code should return `(yield value)` tuple
  - ✅ `ERROR` code should return `(error message)` tuple
  - ✅ `BREAK` code should return `(break)` tuple
  - ✅ `CONTINUE` code should return `(continue)` tuple
  - ✅ arbitrary errors

- `return` handler

  - ✅ should catch `RETURN` code
  - ✅ should let other codes pass through
  - ✅ should return handler result
  - ✅ handler value should be handler-local

  - Control flow


    - `return`

      - ✅ should interrupt handler with `RETURN` code
      - ✅ should bypass `finally` handler

    - `tailcall`

      - ✅ should interrupt handler with `RETURN` code
      - ✅ should bypass `finally` handler

    - `yield`

      - ✅ should interrupt handler with `YIELD` code
      - ✅ should provide a resumable state
      - ✅ should not bypass `finally` handler

    - `error`

      - ✅ should interrupt handler with `ERROR` code
      - ✅ should bypass `finally` handler

    - `break`

      - ✅ should interrupt handler with `BREAK` code
      - ✅ should bypass `finally` handler

    - `continue`

      - ✅ should interrupt handler with `CONTINUE` code
      - ✅ should bypass `finally` handler

  - Exceptions

    - ✅ wrong arity

      `return` must be followed by a parameter and a body script.

    - ✅ invalid parameter name

- `yield` handler

  - ✅ should catch `YIELD` code
  - ✅ should let other codes pass through
  - ✅ should return handler result
  - ✅ handler value should be handler-local

  - Control flow


    - `return`

      - ✅ should interrupt handler with `RETURN` code
      - ✅ should bypass `finally` handler

    - `tailcall`

      - ✅ should interrupt handler with `RETURN` code
      - ✅ should bypass `finally` handler

    - `yield`

      - ✅ should interrupt handler with `YIELD` code
      - ✅ should provide a resumable state
      - ✅ should not bypass `finally` handler

    - `error`

      - ✅ should interrupt handler with `ERROR` code
      - ✅ should bypass `finally` handler

    - `break`

      - ✅ should interrupt handler with `BREAK` code
      - ✅ should bypass `finally` handler

    - `continue`

      - ✅ should interrupt handler with `CONTINUE` code
      - ✅ should bypass `finally` handler

  - Exceptions

    - ✅ wrong arity

      `yield` must be followed by a parameter and a body script.

    - ✅ invalid parameter name

- `error` handler

  - ✅ should catch `ERROR` code
  - ✅ should let other codes pass through
  - ✅ should return handler result
  - ✅ handler value should be handler-local

  - Control flow


    - `return`

      - ✅ should interrupt handler with `RETURN` code
      - ✅ should bypass `finally` handler

    - `tailcall`

      - ✅ should interrupt handler with `RETURN` code
      - ✅ should bypass `finally` handler

    - `yield`

      - ✅ should interrupt handler with `YIELD` code
      - ✅ should provide a resumable state
      - ✅ should not bypass `finally` handler

    - `error`

      - ✅ should interrupt handler with `ERROR` code
      - ✅ should bypass `finally` handler

    - `break`

      - ✅ should interrupt handler with `BREAK` code
      - ✅ should bypass `finally` handler

    - `continue`

      - ✅ should interrupt handler with `CONTINUE` code
      - ✅ should bypass `finally` handler

  - Exceptions

    - ✅ wrong arity

      `error` must be followed by a parameter and a body script.

    - ✅ invalid parameter name

- `break` handler

  - ✅ should catch `BREAK` code
  - ✅ should let other codes pass through
  - ✅ should return handler result

  - Control flow


    - `return`

      - ✅ should interrupt handler with `RETURN` code
      - ✅ should bypass `finally` handler

    - `tailcall`

      - ✅ should interrupt handler with `RETURN` code
      - ✅ should bypass `finally` handler

    - `yield`

      - ✅ should interrupt handler with `YIELD` code
      - ✅ should provide a resumable state
      - ✅ should not bypass `finally` handler

    - `error`

      - ✅ should interrupt handler with `ERROR` code
      - ✅ should bypass `finally` handler

    - `break`

      - ✅ should interrupt handler with `BREAK` code
      - ✅ should bypass `finally` handler

    - `continue`

      - ✅ should interrupt handler with `CONTINUE` code
      - ✅ should bypass `finally` handler

  - Exceptions

    - ✅ wrong arity

      `break` must be followed by a body script.


- `continue` handler

  - ✅ should catch `CONTINUE` code
  - ✅ should let other codes pass through
  - ✅ should return handler result

  - Control flow


    - `return`

      - ✅ should interrupt handler with `RETURN` code
      - ✅ should bypass `finally` handler

    - `tailcall`

      - ✅ should interrupt handler with `RETURN` code
      - ✅ should bypass `finally` handler

    - `yield`

      - ✅ should interrupt handler with `YIELD` code
      - ✅ should provide a resumable state
      - ✅ should not bypass `finally` handler

    - `error`

      - ✅ should interrupt handler with `ERROR` code
      - ✅ should bypass `finally` handler

    - `break`

      - ✅ should interrupt handler with `BREAK` code
      - ✅ should bypass `finally` handler

    - `continue`

      - ✅ should interrupt handler with `CONTINUE` code
      - ✅ should bypass `finally` handler

  - Exceptions

    - ✅ wrong arity

      `continue` must be followed by a body script.


- `finally` handler

  - ✅ should execute for `OK` code
  - ✅ should execute for `RETURN` code
  - ✅ should execute for `YIELD` code
  - ✅ should execute for `ERROR` code
  - ✅ should execute for `BREAK` code
  - ✅ should execute for `CONTINUE` code
  - ✅ should let all codes pass through

  - Control flow


    - `return`

      - ✅ should interrupt handler with `RETURN` code

    - `tailcall`

      - ✅ should interrupt handler with `RETURN` code

    - `yield`

      - ✅ should interrupt handler with `YIELD` code
      - ✅ should provide a resumable state

    - `error`

      - ✅ should interrupt handler with `ERROR` code

    - `break`

      - ✅ should interrupt handler with `BREAK` code

    - `continue`

      - ✅ should interrupt handler with `CONTINUE` code

  - Exceptions

    - ✅ wrong arity

      `finally` must be followed by a body script.


- Exceptions

  - ✅ wrong arity

    The command will return an error message with usage when given the
    wrong number of arguments.

  - ✅ non-script body
  - ✅ invalid keyword

    Only standard result codes and `finally` are accepted.


