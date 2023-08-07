---
source: src\helena-dialect\ensembles.spec.ts
---
# Helena ensembles

- [`ensemble`](../../pages/helena-dialect/commands/ensemble.md) - Create an ensemble command
- [Ensemble commands](#ensemble-commands)


## <a id="ensemble-commands"></a>Ensemble commands

Ensemble commands are commands that gather subcommands defined in their
own child scope.


### <a id="ensemble-commands-specifications"></a>Specifications

- ✅ should return its ensemble metacommand when called with no argument

  The typical application of this property is to access the ensemble
  metacommand by wrapping the command within brackets, i.e. `[cmd]`.

- ✅ should return the provided arguments tuple when called with no subcommand

  This property is useful for encapsulation.

- ✅ should evaluate argument guards

  This property is useful for validation.


### <a id="ensemble-commands-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given an
  insufficient number of arguments.

- ✅ failed guards

  The command will return an error message when an argument guard
  fails.


### <a id="ensemble-commands-ensemble-subcommands"></a>Ensemble subcommands

Commands defined in the ensemble scope will be exposed as
subcommands.

- ✅ first argument after ensemble arguments should be ensemble subcommand name
- ✅ should pass ensemble arguments to ensemble subcommand
- ✅ should apply guards to passed ensemble arguments
- ✅ should pass remaining arguments to ensemble subcommand
- ✅ should evaluate subcommand in the caller scope
- ✅ should work recursively

#### <a id="ensemble-commands-ensemble-subcommands-introspection"></a>Introspection


##### <a id="ensemble-commands-ensemble-subcommands-introspection-subcommands"></a>`subcommands`

`subcommands` is a predefined subcommand that is available for
all ensemble commands.

- ✅ should return list of subcommands

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.


#### <a id="ensemble-commands-ensemble-subcommands-help"></a>Help

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


#### <a id="ensemble-commands-ensemble-subcommands-control-flow"></a>Control flow

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

#### <a id="ensemble-commands-ensemble-subcommands-exceptions"></a>Exceptions

- ✅ unknown subcommand
- ✅ out-of-scope subcommand

  Commands inherited from their parent scope are not available as
  ensemble subcommands.

- ✅ invalid subcommand name

