---
source: src\helena-dialect\controls.spec.ts
---
# Helena control flow commands

## `while`

Conditional loop

### Usage

```lna
while test body
```

The `while` command loops over a body script while a test condition is
true.

### Specifications

- ✅ usage

- ✅ should skip `body` when `test` is false

- ✅ should loop over `body` while `test` is true

- ✅ should return the result of the last command

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ non-script body

### Control flow

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

## `if`

Conditional branching

### Usage

```lna
if test body ?elseif test body ...? ?else? ?body?
```

The `if` command executes a branch conditionally depending on a test
condition.

The syntax is similar to Tcl: test and body pairs are separated by
`elseif` and `else` keywords.

### Specifications

- ✅ usage

- ✅ should return the result of the first true body

- ✅ should return the result of the `else` body when all tests are false

- ✅ should skip leading false bodies

- ✅ should skip trailing tests and bodies

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid keyword

  Only `else` and `elseif` keywords are accepted.

- ✅ invalid test

  Tests must be booleans or script expressions.

- ✅ non-script body

### Control flow

If a test or body returns a result code other than `OK` then it
should be propagated properly by the command.

- `return`

  - ✅ should interrupt tests with `RETURN` code

  - ✅ should interrupt bodies with `RETURN` code

- `tailcall`

  - ✅ should interrupt tests with `RETURN` code

  - ✅ should interrupt bodies with `RETURN` code

- `yield`

  - ✅ should interrupt tests with `YIELD` code

  - ✅ should interrupt bodies with `YIELD` code

  - should provide a resumable state

    - ✅ if

    - ✅ elseif

    - ✅ else

- `error`

  - ✅ should interrupt tests with `ERROR` code

  - ✅ should interrupt bodies with `ERROR` code

- `break`

  - ✅ should interrupt tests with `BREAK` code

  - ✅ should interrupt bodies with `BREAK` code

- `continue`

  - ✅ should interrupt tests with `CONTINUE` code

  - ✅ should interrupt bodies with `CONTINUE` code

## `when`

Multi-way branching

### Usage

```lna
when ?command? {?test body ...? ?default?}
```

The `when` command chooses a branch to execute depending on one or
several conditions.

`when` is similar to `switch` found in other languages, but more
generic and powerful. It is specifically designed to minimize verbosity
in complex cases.

### Specifications

- ✅ usage

- ✅ should return nil with empty test list

- ✅ should accept tuple case list

- ✅ should return the result of the first true body

- ✅ should skip leading false bodies

- ✅ should skip trailing tests and bodies

- no command

  - ✅ should evaluate tests as boolean conditions

- literal command

  - ✅ should apply to tests

  - ✅ should be called on each test

  - ✅ should pass test literal as argument

  - ✅ should pass test tuple values as arguments

- tuple command

  - ✅ should apply to tests

  - ✅ should be called on each test

  - ✅ should pass test literal as argument

  - ✅ should pass test tuple values as arguments

- script command

  - ✅ evaluation result should apply to tests

  - ✅ should be called on each test

  - ✅ should pass test literal as argument

  - ✅ should pass test tuple values as arguments

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid case list

  Case list must be a block or tuple.

### Control flow

If a test or script returns a result code other than `OK` then it
should be propagated properly by the command.

- `return`

  - ✅ should interrupt tests with `RETURN` code

  - ✅ should interrupt script command with `RETURN` code

  - ✅ should interrupt bodies with `RETURN` code

- `tailcall`

  - ✅ should interrupt tests with `RETURN` code

  - ✅ should interrupt script command with `RETURN` code

  - ✅ should interrupt bodies with `RETURN` code

- `yield`

  - ✅ should interrupt tests with `YIELD` code

  - ✅ should interrupt script commands with YIELD code

  - ✅ should interrupt bodies with `YIELD` code

  - should provide a resumable state

    - no command

      - ✅ first

      - ✅ second

      - ✅ default

    - script command

      - ✅ first

      - ✅ second

      - ✅ default

- `error`

  - ✅ should interrupt tests with `ERROR` code

  - ✅ should interrupt script command with `ERROR` code

  - ✅ should interrupt bodies with `ERROR` code

- `break`

  - ✅ should interrupt tests with `BREAK` code

  - ✅ should interrupt script command with `BREAK` code

  - ✅ should interrupt bodies with `BREAK` code

- `continue`

  - ✅ should interrupt tests with `CONTINUE` code

  - ✅ should interrupt script command with `BREAK` code

  - ✅ should interrupt bodies with `CONTINUE` code

## `catch`

Result handling

### Usage

```lna
catch body ?return value handler? ?yield value handler? ?error message handler? ?break handler? ?continue handler? ?finally handler?
```

The `catch` command is used to intercept specific result codes with
handler scripts.

It is inspired by the Tcl command `catch` but with a distinct syntax.

### Specifications

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

## `pass`

`catch` handler pass-through

### Usage

```lna
pass
```

`pass` is used within `catch` handlers to let the original result pass
through to the caller.

### Specifications

- ✅ usage

- ✅ `catch` should return `(pass)` tuple

- ✅ should resume yielded body

- should interrupt `catch` handlers and let original result pass through

  - ✅ `RETURN`

  - ✅ `YIELD`

  - ✅ `ERROR`

  - ✅ `BREAK`

  - ✅ `CATCH`

- should let `catch` `finally` handler execute

  - ✅ `RETURN`

  - ✅ `YIELD`

  - ✅ `ERROR`

  - ✅ `BREAK`

  - ✅ `CONTINUE`

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `pass` handler

  `pass` is not a valid `catch` handler.

