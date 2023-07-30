---
source: src\helena-dialect\namespaces.spec.ts
---
# Helena namespaces

## `namespace`

Create a namespace command

### Usage

```lna
namespace ?name? body
```

The `namespace` command creates a new namespace command.

### Specifications

- ✅ usage

- ✅ should define a new command

- ✅ should replace existing commands

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `name`

  Command names must have a valid string representation.

- ✅ non-script body

### `body`

- ✅ should be executed

- ✅ should access global commands

- ✅ should not access global variables

- ✅ should not set global variables

- ✅ should set namespace variables

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

  - ✅ should delay the definition of namespace command until resumed

- `error`

  - ✅ should interrupt the body with `ERROR` code

  - ✅ should not define the namespace command

- `break`

  - ✅ should interrupt the body with `ERROR` code

  - ✅ should not define the namespace command

- `continue`

  - ✅ should interrupt the body with `ERROR` code

  - ✅ should not define the namespace command

### Metacommand

`namespace` returns a metacommand value that can be used to
introspect the newly created command.

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

  - ✅ should evaluate body in namespace scope

  - ✅ should accept tuple bodies

  - ✅ should evaluate macros in namespace scope

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

  - ✅ should call namespace commands

  - ✅ should evaluate macros in namespace

  - ✅ should evaluate namespace closures in namespace

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

- `import`

  - ✅ should declare imported commands in the calling scope

  - ✅ should return nil

  - ✅ should replace existing commands

  - ✅ should evaluate macros in the caller scope

  - ✅ should evaluate closures in their scope

  - ✅ should resolve imported commands at call time

  - ✅ should accept an optional alias name

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

    - ✅ unresolved command

    - ✅ invalid import name

    - ✅ invalid alias name

- Exceptions

  - ✅ unknown subcommand

  - ✅ invalid subcommand name

## Namespace commands

Namespace commands are commands that gather subcommands and variables
defined in their own child scope.

### Specifications

- ✅ should return its namespace metacommand when called with no argument

  The typical application of this property is to access the namespace
  metacommand by wrapping the command within brackets, i.e. `[cmd]`.

### Namespace subcommands

Commands defined in the namespace scope will be exposed as
subcommands.

- ✅ first argument should be namespace subcommand name

- ✅ should pass remaining arguments to namespace subcommand

- ✅ should evaluate subcommand in namespace scope

- ✅ should work recursively

#### Introspection

##### `subcommands`

`subcommands` is a predefined subcommand that is available for
all namespace commands.

- ✅ should return list of subcommands

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.

#### Help

Namespace commands have built-in support for `help` on all
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

### Namespace variables

Variables defined in the namespace scope will be key selectable on
both the namespace command and metacommand.

- ✅ should map to value keys

- ✅ should work recursively

#### Exceptions

- ✅ unknown variables

- ✅ out-of-scope variable

- ✅ invalid variable name

