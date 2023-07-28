---
source: src\helena-dialect\procs.spec.ts
---
# Helena procedures

## `proc`

Create a procedure command

### Usage

```lna
proc ?name? argspec body
```

The `proc` command creates a new procedure command. The name `proc` was
preferred over `procedure` because it is shorter and is already used in
Tcl.

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

- ✅ invalid `name`

  Command names must have a valid string representation.

- ✅ non-script body

### Metacommand

`proc` returns a metacommand value that can be used to introspect
the newly created command.

- ✅ should return a metacommand

- ✅ the metacommand should return the procedure

#### Examples

- ✅ Calling procedure through its wrapped metacommand

  Here we create a procedure and call it through its metacommand:

  ```lna
  set cmd [proc double {val} {* 2 $val}]
  [$cmd] 3
  # => 6
  ```

  This behaves the same as calling the procedure directly:

  ```lna
  double 3
  # => 6
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

- `argspec`

  - ✅ should return the procedure's argspec

    Each procedure has an argspec command associated to it,
    created with the procedure's `argspec` argument. This
    subcommand will return it:

    ```lna
    [proc {a b} {}] argspec
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

## Procedure commands

Procedure commands are commands that execute a body script in their
own child scope.

### Help

Procedures have built-in support for `help` generated from their
argspec.

- ✅ zero

- ✅ one

- ✅ two

- ✅ optional

- ✅ remainder

- ✅ anonymous

### Arguments

- ✅ should be scope variables

- Exceptions

  - ✅ wrong arity

    The procedure will return an error message with usage when given
    the wrong number of arguments.

### Command calls

- ✅ should return nil for empty body

- ✅ should return the result of the last command

- ✅ should evaluate in their own scope

- ✅ should evaluate from their parent scope

- ✅ should access external commands

- ✅ should not access external variables

- ✅ should not set external variables

- ✅ local commands should shadow external commands

### Return guards

Return guards are similar to argspec guards, but apply to the return
value of the procedure.

- ✅ should apply to the return value

- ✅ should let body errors pass through

- ✅ should not access proc arguments

- ✅ should evaluate in the proc parent scope

- exceptions

  - ✅ empty body specifier

  - ✅ invalid body specifier

  - ✅ non-script body

### Control flow

The normal return code of a procedure is `OK`. Some codes are handled
within the procedure whereas others are propagated to the caller.

- `return`

  - ✅ should interrupt a proc with `OK` code

- `tailcall`

  - ✅ should interrupt a proc with `OK` code

- `yield`

  - ✅ should interrupt a proc with `YIELD` code

  - ✅ should provide a resumable state

  - ✅ should work recursively

- `error`

  - ✅ should interrupt a proc with `ERROR` code

- `break`

  - ✅ should interrupt a proc with `ERROR` code

- `continue`

  - ✅ should interrupt a proc with `ERROR` code

