---
source: src\helena-dialect\modules.spec.ts
---
# <a id=""></a>Helena modules


## <a id="module"></a>`module`

Create a module command

### Usage

```lna
module ?name? body
```

The `module` command creates a new command that will execute a script
in its own isolated root scope.


### <a id="module_Specifications"></a>Specifications

- ✅ usage
- ✅ should define a new command
- ✅ should replace existing commands
- ✅ should return a command object
- ✅ the named command should return its command object
- ✅ the command object should return itself

### <a id="module_Exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `name`

  Command names must have a valid string representation.

- ✅ non-script body

### <a id="module_body"></a>`body`

- ✅ should be executed
- ✅ should not access outer commands
- ✅ should not define outer commands
- ✅ should not access outer variables
- ✅ should not set outer variables

#### <a id="module_body_Control_flow"></a>Control flow

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

### <a id="module_Subcommands"></a>Subcommands


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

## <a id="export"></a>export

Export a command from the current module

### Usage

```lna
export name
```

The `export` command exports a command from the current module by
making it available for other modules through its `import` subcommand.


### <a id="export_Specifications"></a>Specifications

- ✅ usage
- ✅ should not exist in non-module scope
- ✅ should exist in module scope
- ✅ should return nil
- ✅ should add command name to exports
- ✅ should allow non-existing command names

### <a id="export_Exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `name`

  Command names must have a valid string representation.


## <a id="import"></a>`import`

Load a module

### Usage

```lna
import path ?name|imports?
```

The `import` command loads a module from the file system. On first
load, the file content is evaluated as a script in a new module scope,
and the module is added to a global registry.


### <a id="import_Specifications"></a>Specifications

- ✅ usage
- ✅ should return a module object
- ✅ relative paths should resolve relatively to the working directory
- ✅ in-module relative paths should resolve relatively to the module path
- ✅ multiple imports should resolve to the same object
- ✅ should not support circular imports

- `name`

  - ✅ should define a new command
  - ✅ should replace existing commands
  - ✅ the named command should return its command object

- `imports`

  - ✅ should declare imported commands in the calling scope
  - ✅ should accept tuples
  - ✅ should accept lists
  - ✅ should accept blocks
  - ✅ should accept (name alias) tuples

  - Exceptions

    - ✅ unknown export
    - ✅ unresolved export
    - ✅ invalid import name
    - ✅ invalid alias name
    - ✅ invalid name tuple

### <a id="import_Exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.


