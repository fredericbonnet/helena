---
source: src\helena-dialect\modules.spec.ts
---
# Helena modules

- [`module`](../../pages/helena-dialect/commands/module.md) - Create a module command
- [Module commands](#module-commands)
- [`export`](../../pages/helena-dialect/commands/export.md) - Export a command from the current module
- [`import`](../../pages/helena-dialect/commands/import.md) - Load a module
- [Error stacks](#error-stacks)


## <a id="module-commands"></a>Module commands

Module commands are commands that encapsulate an isolated root scope.


### <a id="module-commands-specifications"></a>Specifications

- ✅ usage
- ✅ should return its module value when called with no argument

  The typical application of this property is to pass around or call
  the module command by value.


### <a id="module-commands-subcommands"></a>Subcommands


#### <a id="module-commands-subcommands-subcommands"></a>`subcommands`

```lna
<module> subcommands
```

- ✅ should return list of subcommands

  This subcommand is useful for introspection and interactive
  calls.


- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.


#### <a id="module-commands-subcommands-exports"></a>`exports`

```lna
<module> exports
```

- ✅ should return a list
- ✅ should return the list of module exports

  Note that exports are returned in no special order.


- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.


#### <a id="module-commands-subcommands-import"></a>`import`

```lna
<module> import name ?alias?
```

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

#### <a id="module-commands-subcommands-exceptions"></a>Exceptions

- ✅ unknown subcommand
- ✅ invalid subcommand name

## <a id="error-stacks"></a>Error stacks

- ✅ module
- ✅ import
- ✅ parsing error

