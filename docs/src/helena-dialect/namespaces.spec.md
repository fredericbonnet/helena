---
source: src\helena-dialect\namespaces.spec.ts
---
# Helena namespaces

- [`namespace`](../../pages/helena-dialect/commands/namespace.md) - Create a namespace command
- [Namespace commands](#namespace-commands)


## <a id="namespace-commands"></a>Namespace commands

Namespace commands are commands that gather subcommands and variables
defined in their own child scope.


### <a id="namespace-commands-specifications"></a>Specifications

- ✅ should return its namespace metacommand when called with no argument

  The typical application of this property is to access the namespace
  metacommand by wrapping the command within brackets, i.e. `[cmd]`.


### <a id="namespace-commands-namespace-subcommands"></a>Namespace subcommands

Commands defined in the namespace scope will be exposed as
subcommands.

- ✅ first argument should be namespace subcommand name
- ✅ should pass remaining arguments to namespace subcommand
- ✅ should evaluate subcommand in namespace scope
- ✅ should work recursively

#### <a id="namespace-commands-namespace-subcommands-introspection"></a>Introspection


##### <a id="namespace-commands-namespace-subcommands-introspection-subcommands"></a>`subcommands`

`subcommands` is a predefined subcommand that is available for
all namespace commands.

- ✅ should return list of subcommands

  Note that subcommands are returned in no special order.


- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.


#### <a id="namespace-commands-namespace-subcommands-help"></a>Help

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


#### <a id="namespace-commands-namespace-subcommands-control-flow"></a>Control flow

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

#### <a id="namespace-commands-namespace-subcommands-exceptions"></a>Exceptions

- ✅ unknown subcommand
- ✅ out-of-scope subcommand

  Commands inherited from their parent scope are not available as
  ensemble subcommands.

- ✅ invalid subcommand name

### <a id="namespace-commands-namespace-variables"></a>Namespace variables

Variables defined in the namespace scope will be key selectable on
both the namespace command and metacommand.

- ✅ should map to value keys
- ✅ should work recursively

#### <a id="namespace-commands-namespace-variables-exceptions"></a>Exceptions

- ✅ unknown variables
- ✅ out-of-scope variable
- ✅ invalid variable name

