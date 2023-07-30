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

The `ensemble` command creates a new ensemble command.

### Specifications

- ✅ usage

- ✅ should define a new command

- ✅ should replace existing commands

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `argspec`

  The command expects an argument list in `argspec` format.

- ✅ variadic arguments

  Ensemble argument lists are fixed-length; optional or remainder
  arguments are forbidden.

- ✅ invalid `name`

  Command names must have a valid string representation.

- ✅ non-script body

### `body`

- ✅ should be executed

- ✅ should access global commands

- ✅ should not access global variables

- ✅ should not set global variables

- ✅ should set ensemble variables

#### Control flow

If the body returns a result code other than `OK` then it should be
propagated properly by the command.

- `return`

  - ✅ should interrupt the body with `OK` code

  - ✅ should still define the named command

  - ✅ should return passed value instead of the command object

- `tailcall`

  - ✅ should interrupt the body with `OK` code

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

### Metacommand

`ensemble` returns a metacommand value that can be used to introspect
the newly created command.

- ✅ should return a metacommand

- ✅ the metacommand should return itself

#### Subcommands

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

  - ✅ should return the ensemble's argspec

    Each ensemble has an argspec command associated to it,
    created with the ensemble's `argspec` argument. This
    subcommand will return it:

    ```lna
    [ensemble {a b} {}] argspec
    # => {#{argspec: "a b"}#}
    ```

    This is identical to:

    ```lna
    argspec {a b}
    ```

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

- Exceptions

  - ✅ unknown subcommand

  - ✅ invalid subcommand name

## Ensemble commands

Ensemble commands are commands that gather subcommands defined in their
own child scope.

### Specifications

- ✅ should return its ensemble metacommand when called with no argument

  The typical application of this property is to access the ensemble
  metacommand by wrapping the command within brackets, i.e. `[cmd]`.

- ✅ should return the provided arguments tuple when called with no subcommand

  This property is useful for encapsulation.

- ✅ should evaluate argument guards

  This property is useful for validation.

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given an
  insufficient number of arguments.

- ✅ failed guards

  The command will return an error message when an argument guard
  fails.

### Ensemble subcommands

Commands defined in the ensemble scope will be exposed as
subcommands.

- ✅ first argument after ensemble arguments should be ensemble subcommand name

- ✅ should pass ensemble arguments to ensemble subcommand

- ✅ should apply guards to passed ensemble arguments

- ✅ should pass remaining arguments to ensemble subcommand

- ✅ should evaluate subcommand in the caller scope

- ✅ should work recursively

#### Introspection

##### `subcommands`

`subcommands` is a predefined subcommand that is available for
all ensemble commands.

- ✅ should return list of subcommands

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.

#### Help

Ensemble commands have built-in support for `help` on all
subcommands that support it.

- ✅ should provide subcommand help

- ✅ should work recursively

- Exceptions

  - ✅ wrong arity

    The command will return an error message with usage when given
    the wrong number of arguments.

  - ✅ invalid `subcommand`

    Only named commands are supported, hence the `subcommand`
    argument must have a valid string representation.

  - ✅ unknown subcommand

    The command cannot get help for a non-existing subcommand.

  - ✅ subcommand with no help

    The command cannot get help for a subcommand that has none.

#### Control flow

If a subcommand returns a result code other than `OK` then it
should be propagated properly to the caller.

- `return`

  - ✅ should interrupt the call with `RETURN` code

- `tailcall`

  - ✅ should interrupt the call with `RETURN` code

- `yield`

  - ✅ should interrupt the call with `YIELD` code

  - ✅ should provide a resumable state

- `error`

  - ✅ should interrupt the call with `ERROR` code

- `break`

  - ✅ should interrupt the call with `BREAK` code

- `continue`

  - ✅ should interrupt the call with `CONTINUE` code

#### Exceptions

- ✅ unknown subcommand

- ✅ out-of-scope subcommand

  Commands inherited from their parent scope are not available as
  ensemble subcommands.

- ✅ invalid subcommand name

