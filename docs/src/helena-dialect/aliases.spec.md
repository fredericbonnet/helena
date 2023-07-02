---
source: src\helena-dialect\aliases.spec.ts
---
# Helena aliases

## `alias`

Define a command alias

### Usage

```lna
alias name command
```

The `alias` command defines a new command that is the alias of another
command.

### Specifications

- ✅ usage

- ✅ should define a new command

- ✅ should replace existing commands

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid command name

  Command names must have a valid string representation.

### Command calls

- ✅ should call the aliased command

- ✅ should pass arguments to aliased commands

#### Command tuples

Aliased commands can be any type of command, including tuple
commands, which are auto-expanded when calling the alias. This can
be used for currying or encapsulation, for example:

```lna
alias double (* 2)
double 3
# => 6

alias mylist (list (1 2 3))
mylist length
# => 3
```

- ✅ zero

- ✅ one

- ✅ two

- ✅ three

#### Control flow

If the aliased command returns a result code then it should be
propagated properly by the alias.

##### `return`

- ✅ should interrupt a macro alias with `RETURN` code

- ✅ should interrupt a tuple alias with `RETURN` code

##### `tailcall`

- ✅ should interrupt a macro alias with `RETURN` code

- ✅ should interrupt a tuple alias with `RETURN` code

##### `yield`

- ✅ should interrupt a macro alias with `YIELD` code

- ✅ should interrupt a tuple alias with `YIELD` code

- ✅ should provide a resumable state for macro alias

- ✅ should provide a resumable state for tuple alias

##### `error`

- ✅ should interrupt a macro alias with `ERROR` code

- ✅ should interrupt a tuple alias with `ERROR` code

##### `break`

- ✅ should interrupt a macro alias with `BREAK` code

- ✅ should interrupt a tuple alias with `BREAK` code

##### `continue`

- ✅ should interrupt a macro alias with `CONTINUE` code

- ✅ should interrupt a tuple alias with `CONTINUE` code

#### Exceptions

- ✅ wrong arity

  Argument validation is done by the aliased command and
  propagated properly by the alias.

### Metacommand

`alias` returns a metacommand value that can be used to introspect
the newly created command.

- ✅ should return a metacommand

- ✅ the metacommand should return the aliased command

  The typical application of this property is to call the command by
  wrapping its metacommand within brackets, i.e. `[$metacommand]`:
  
  ```lna
  set cmd [alias foo list]
  # These commands yield the same results:
  list 1 2 3
  foo 1 2 3
  [$cmd] 1 2 3
  ```

#### Subcommands

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

    This will return the value of the `command` argument.

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

#### Exceptions

- ✅ unknown subcommand

- ✅ invalid subcommand name

