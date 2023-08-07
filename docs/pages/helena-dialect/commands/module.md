---
source: src\helena-dialect\modules.spec.ts
---
# <a id="module"></a>`module`

Create a module command

## Usage

```lna
module ?name? body
```

The `module` command creates a new command that will execute a script
in its own isolated root scope.


## <a id="module-specifications"></a>Specifications

- ✅ usage
- ✅ should define a new command
- ✅ should replace existing commands
- ✅ should return a command object
- ✅ the named command should return its command object
- ✅ the command object should return itself

## <a id="module-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `name`

  Command names must have a valid string representation.

- ✅ non-script body

## <a id="module-body"></a>`body`

- ✅ should be executed
- ✅ should not access outer commands
- ✅ should not define outer commands
- ✅ should not access outer variables
- ✅ should not set outer variables

### <a id="module-body-control-flow"></a>Control flow

If the body returns a result code other than `OK` then it should be
propagated properly by the command.


- `return`

  - ✅ should interrupt the body with `ERROR` code
  - ✅ should not define the module command

- `tailcall`

  - ✅ should interrupt the body with `ERROR` code
  - ✅ should not define the module command

- `yield`

  - ✅ should interrupt the body with `ERROR` code
  - ✅ should not define the module command

- `error`

  - ✅ should interrupt the body with `ERROR` code
  - ✅ should not define the module command

- `break`

  - ✅ should interrupt the body with `ERROR` code
  - ✅ should not define the module command

- `continue`

  - ✅ should interrupt the body with `ERROR` code
  - ✅ should not define the module command

- `pass`

  - ✅ should interrupt the body with `ERROR` code
  - ✅ should not define the module command

## <a id="module-subcommands"></a>Subcommands


- `subcommands`

  - ✅ should return list of subcommands

    This subcommand is useful for introspection and interactive
    calls.


  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.


- `exports`

  - ✅ should return a list
  - ✅ should return the list of module exports

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.


- `import`

  - ✅ should declare imported commands in the calling scope
  - ✅ should return nil
  - ✅ should replace existing commands
  - ✅ should evaluate macros in the caller scope
  - ✅ should evaluate closures in their scope
  - ✅ should resolve exported commands at call time
  - ✅ should accept an optional alias name

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

    - ✅ unknown export
    - ✅ unresolved export
    - ✅ invalid import name
    - ✅ invalid alias name

- Exceptions

  - ✅ unknown subcommand
  - ✅ invalid subcommand name

