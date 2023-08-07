---
source: src\helena-dialect\controls.spec.ts
---
# <a id="when"></a>`when`

Multi-way branching

## Usage

```lna
when ?command? {?test body ...? ?default?}
```

The `when` command chooses a branch to execute depending on one or
several conditions.

`when` is similar to `switch` found in other languages, but more
generic and powerful. It is specifically designed to minimize verbosity
in complex cases.


## <a id="when-specifications"></a>Specifications

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

## <a id="when-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid case list

  Case list must be a block or tuple.


## <a id="when-control-flow"></a>Control flow

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

