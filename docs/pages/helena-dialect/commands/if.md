---
source: src\helena-dialect\controls.spec.ts
---
# <a id="if"></a>`if`

Conditional branching

## Usage

```lna
if test body ?elseif test body ...? ?else? ?body?
```

The `if` command executes a branch conditionally depending on a test
condition.

The syntax is similar to Tcl: test and body pairs are separated by
`elseif` and `else` keywords.


## <a id="if-specifications"></a>Specifications

- ✅ usage
- ✅ should return the result of the first true body
- ✅ should return the result of the `else` body when all tests are false
- ✅ should skip leading false bodies
- ✅ should skip trailing tests and bodies

## <a id="if-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid keyword

  Only `else` and `elseif` keywords are accepted.

- ✅ invalid test

  Tests must be booleans or script expressions.

- ✅ non-script body

## <a id="if-control-flow"></a>Control flow

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

