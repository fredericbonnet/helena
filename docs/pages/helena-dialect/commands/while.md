---
source: src\helena-dialect\controls.spec.ts
---
# <a id="while"></a>`while`

Conditional loop

## Usage

```lna
while test body
```

The `while` command loops over a body script while a test condition is
true.


## <a id="while-specifications"></a>Specifications

- ✅ usage
- ✅ should skip `body` when `test` is false
- ✅ should loop over `body` while `test` is true
- ✅ should return the result of the last command

## <a id="while-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ non-script body

## <a id="while-control-flow"></a>Control flow

If the test returns a result code other than `OK` then it should be
propagated properly by the command.

The normal return code of the body is `OK`. `BREAK` and `CONTINUE`
codes are handled by the command and the others are propagated to the
caller.


- `return`

  - ✅ should interrupt the test with `RETURN` code
  - ✅ should interrupt the loop with `RETURN` code

- `tailcall`

  - ✅ should interrupt the test with `RETURN` code
  - ✅ should interrupt the loop with `RETURN` code

- `yield`

  - ✅ should interrupt the test with `YIELD` code
  - ✅ should interrupt the body with `YIELD` code
  - ✅ should provide a resumable state

- `error`

  - ✅ should interrupt the test with `ERROR` code
  - ✅ should interrupt the loop with `ERROR` code

- `break`

  - ✅ should interrupt the test with `BREAK` code
  - ✅ should interrupt the body with `nil` result

- `continue`

  - ✅ should interrupt the test with `CONTINUE` code
  - ✅ should interrupt the body iteration

