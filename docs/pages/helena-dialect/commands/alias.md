---
source: src\helena-dialect\aliases.spec.ts
---
# <a id="alias"></a>`alias`

Define a command alias

## Usage

```lna
alias name command
```

The `alias` command defines a new command that is the alias of another
command.


## <a id="alias-specifications"></a>Specifications

- ✅ usage
- ✅ should define a new command
- ✅ should replace existing commands

## <a id="alias-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `name`

  Command names must have a valid string representation.


## <a id="alias-command-calls"></a>Command calls

- ✅ should call the aliased command
- ✅ should pass arguments to aliased commands

- Exceptions

  - ✅ wrong arity

    Argument validation is done by the aliased command and
    propagated properly by the alias.


### <a id="alias-command-calls-command-tuples"></a>Command tuples

Aliased commands can be any type of command, including tuple
commands, which are auto-expanded when calling the alias. This can
be used for currying or encapsulation.

- ✅ zero
- ✅ one
- ✅ two
- ✅ three

#### <a id="alias-command-calls-command-tuples-examples"></a>Examples

- ✅ Currying

  Thanks to leading tuple auto-expansion, it is very simple to
  create curried commands by bundling a command name and its
  arguments into a tuple. Here we create a new command `double`
  by currying the prefix multiplication operator `*` with 2:

  ```lna
  alias double (* 2)
  double 3
  # => 6
  ```

- ✅ Encapsulation

  Here we create a new command `mylist` by encapsulating a
  list value passed to the `list` command; we then can call
  `list` subcommands without having to provide the value:

  ```lna
  alias mylist (list (1 2 3))
  mylist length
  # => 3
  ```

  A nice side effect of how `list` works is that calling the
  alias with no argument will return the encapsulated value:

  ```lna
  mylist
  # => [list (1 2 3)]
  ```


### <a id="alias-command-calls-control-flow"></a>Control flow

If the aliased command returns a result code then it should be
propagated properly by the alias.


- `return`

  - ✅ should interrupt a macro alias with `RETURN` code
  - ✅ should interrupt a tuple alias with `RETURN` code

- `tailcall`

  - ✅ should interrupt a macro alias with `RETURN` code
  - ✅ should interrupt a tuple alias with `RETURN` code

- `yield`

  - ✅ should interrupt a macro alias with `YIELD` code
  - ✅ should interrupt a tuple alias with `YIELD` code
  - ✅ should provide a resumable state for macro alias
  - ✅ should provide a resumable state for tuple alias

- `error`

  - ✅ should interrupt a macro alias with `ERROR` code
  - ✅ should interrupt a tuple alias with `ERROR` code

- `break`

  - ✅ should interrupt a macro alias with `BREAK` code
  - ✅ should interrupt a tuple alias with `BREAK` code

- `continue`

  - ✅ should interrupt a macro alias with `CONTINUE` code
  - ✅ should interrupt a tuple alias with `CONTINUE` code

## <a id="alias-metacommand"></a>Metacommand

`alias` returns a metacommand value that can be used to introspect
the newly created command.

- ✅ should return a metacommand
- ✅ the metacommand should return the aliased command

  The typical application of this property is to call the command by
  wrapping its metacommand within brackets, e.g. `[$metacommand]`.


### <a id="alias-metacommand-examples"></a>Examples

- ✅ Calling alias through its wrapped metacommand

  Here we alias the command `list` and call it through the
  alias metacommand:

  ```lna
  set cmd [alias foo list]
  [$cmd] (1 2 3)
  # => [list (1 2 3)]
  ```

  This behaves the same as calling the alias directly:

  ```lna
  foo (1 2 3)
  # => [list (1 2 3)]
  ```


### <a id="alias-metacommand-subcommands"></a>Subcommands


- `subcommands`

  - ✅ should return list of subcommands

    This subcommand is useful for introspection and interactive
    calls.


  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.


- `command`

  - ✅ should return the aliased command

    This will return the value of the `command` argument at alias
    creation time.

    ```lna
    set cmd [alias cmd (idem val)]
    $cmd command
    # => (idem val)
    ```


  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.


- Exceptions

  - ✅ unknown subcommand
  - ✅ invalid subcommand name

