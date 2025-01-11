---
source: src\helena-dialect\controls.spec.ts
---
# <a id="loop"></a>`loop`

Generic loop

## Usage

```lna
loop ?index? ?value source ...? body
```

The `loop` command iterates over values provided by sources.


## <a id="loop-specifications"></a>Specifications

- ✅ usage
- ✅ should loop over `body` indefinitely when no source is provided
- ✅ should return the result of the last command
- ✅ should increment `index` at each iteration

## <a id="loop-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ non-script body
- ✅ invalid `index` name

  Index variable name must have a valid string representation.

- ✅ invalid sources

  Only lists, dictionaries, scripts, and commands are acceptable
  values.


## <a id="loop-sources"></a>Sources


- list sources

  - ✅ should iterate over list elements

  - value tuples

    - ✅ should be supported
    - ✅ should accept empty tuple

- dict sources

  - ✅ should iterate over dictionary entries

  - value tuples

    - ✅ should be supported
    - ✅ should accept empty tuple
    - ✅ should accept `(key)` tuple

- script sources

  - ✅ should iterate over script results

  - value tuples

    - ✅ should be supported
    - ✅ should accept empty tuple

- command name sources

  - ✅ should iterate over command results

  - value tuples

    - ✅ should be supported
    - ✅ should accept empty tuple

- command tuple sources

  - ✅ should iterate over command results

  - value tuples

    - ✅ should be supported
    - ✅ should accept empty tuple

- command value sources

  - ✅ should iterate over command results

  - value tuples

    - ✅ should be supported
    - ✅ should accept empty tuple

## <a id="loop-control-flow"></a>Control flow

The normal return code of a source or body is `OK`. `BREAK` and
`CONTINUE` codes are handled by the command and the others are
propagated to the caller.


- `return`

  - ✅ should interrupt sources with `RETURN` code
  - ✅ should interrupt the loop with `RETURN` code

- `tailcall`

  - ✅ should interrupt sources with `RETURN` code
  - ✅ should interrupt the loop with `RETURN` code

- `yield`

  - ✅ should interrupt sources with `YIELD` code
  - ✅ should interrupt the body with `YIELD` code
  - ✅ should provide a resumable state

- `error`

  - ✅ should interrupt sources with `ERROR` code
  - ✅ should interrupt the loop with `ERROR` code

- `break`

  - ✅ should skip the source for the remaining loop iterations
  - ✅ should interrupt the loop with `nil` result

- `continue`

  - ✅ should skip the source value for the current loop iteration
  - ✅ should interrupt the loop iteration

