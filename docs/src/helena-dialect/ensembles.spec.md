---
source: src\helena-dialect\ensembles.spec.ts
---
# Helena ensembles

## `ensemble`

Create an ensemble command

### Usage

```lna
ensemble ?name? argspec body
```

The `ensemble` command creates a new command that can be used to
gather subcommands under itself.

### Specifications

- ✅ usage

- ✅ should define a new command

- ✅ should replace existing commands

- ✅ should return a command object

- ✅ the named command should return its command object

- ✅ the command object should return itself

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid argument list

- ✅ variadic arguments

- ✅ invalid `name`

  Command names must have a valid string representation.

- ✅ non-script body

### `body`

- ✅ should be executed

- ✅ should access global commands

- ✅ should not access global variables

- ✅ should not set global variables

- ✅ should set ensemble variables

### Control flow

If the body returns a result code then it should be propagated
properly by the command.

- `return`

  - ✅ should interrupt the body with OK code

  - ✅ should still define the named command

  - ✅ should return passed value instead of the command object

- `tailcall`

  - ✅ should interrupt the body with OK code

  - ✅ should still define the named command

  - ✅ should return passed value instead of the command object

- `yield`

  - ✅ should interrupt the body with `YIELD` code

  - ✅ should provide a resumable state

  - ✅ should delay the definition of ensemble command until resumed

- `error`

  - ✅ should interrupt the body with `ERROR` code

  - ✅ should not define the ensemble command

- `break`

  - ✅ should interrupt the body with `ERROR` code

  - ✅ should not define the ensemble command

- `continue`

  - ✅ should interrupt the body with `ERROR` code

  - ✅ should not define the ensemble command

### Subcommands

- `subcommands`

  - ✅ should return list of subcommands

    This subcommand is useful for introspection and interactive
    calls.

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

- `eval`

  - ✅ should evaluate body in ensemble scope

  - ✅ should accept tuple bodies

  - ✅ should evaluate macros in ensemble scope

  - ✅ should evaluate closures in their scope

  - Control flow

    - `return`

      - ✅ should interrupt the body with `RETURN` code

    - `tailcall`

      - ✅ should interrupt the body with `RETURN` code

    - `yield`

      - ✅ should interrupt the body with `YIELD` code

      - ✅ should provide a resumable state

    - `error`

      - ✅ should interrupt the body with `ERROR` code

    - `break`

      - ✅ should interrupt the body with `BREAK` code

    - `continue`

      - ✅ should interrupt the body with `CONTINUE` code

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

    - ✅ invalid body

- `call`

  - ✅ should call ensemble commands

  - ✅ should evaluate macros in the caller scope

  - ✅ should evaluate ensemble closures in ensemble scope

  - Control flow

    - `return`

      - ✅ should interrupt the body with `RETURN` code

    - `tailcall`

      - ✅ should interrupt the body with `RETURN` code

    - `yield`

      - ✅ should interrupt the call with `YIELD` code

      - ✅ should provide a resumable state

    - `error`

      - ✅ should interrupt the body with `ERROR` code

    - `break`

      - ✅ should interrupt the body with `BREAK` code

    - `continue`

      - ✅ should interrupt the body with `CONTINUE` code

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

    - ✅ unknown command

    - ✅ out-of-scope command

    - ✅ invalid command name

- `argspec`

  - ✅ should return the ensemble argspec

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

- Exceptions

  - ✅ unknown subcommand

### Ensemble subcommands

Commands defined in the ensemble scope will be exposed as
subcommands.

- ✅ when missing should return ensemble arguments tuple

- ✅ first argument after ensemble arguments should be ensemble command name

- ✅ should pass ensemble arguments to ensemble command

- ✅ should pass remaining arguments to ensemble command

- ✅ should evaluate command in the caller scope

- ✅ should work recursively

- `subcommands`

  - ✅ should return list of subcommands

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

- Control flow

  - `return`

    - ✅ should interrupt the body with `RETURN` code

  - `tailcall`

    - ✅ should interrupt the body with `RETURN` code

  - `yield`

    - ✅ should interrupt the call with `YIELD` code

    - ✅ should provide a resumable state

  - `error`

    - ✅ should interrupt the body with `ERROR` code

  - `break`

    - ✅ should interrupt the body with `BREAK` code

  - `continue`

    - ✅ should interrupt the body with `CONTINUE` code

- Exceptions

  - ✅ wrong arity

  - ✅ unknown subcommand

  - ✅ out-of-scope subcommand

  - ✅ invalid subcommand

