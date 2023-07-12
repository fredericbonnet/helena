---
source: src\helena-dialect\macros.spec.ts
---
# Helena macros

## `macro`

Define a macro

### Usage

```lna
macro ?name? argspec body
```

The `macro` command defines a new command that will execute a script in
the calling context.

### Specifications

- ✅ usage

- ✅ should define a new command 

- ✅ should replace existing commands

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid argument list

  The command expects an argument list in `argspec` format.

- ✅ non-script body

- ✅ invalid `name`

  Command names must have a valid string representation.

### Command calls

- ✅ should return nil for empty body

- ✅ should return the result of the last command

- ✅ should access scope variables

- ✅ should set scope variables

- ✅ should access scope commands

- should evaluate in the caller scope

  - ✅ global scope

  - ✅ child scope

  - ✅ scoped macro

#### Arguments

- ✅ should shadow scope variables

- ✅ should be macro-local

- Exceptions

  - ✅ wrong arity

    The macro will return an error message with usage when given the
    wrong number of arguments.

#### Return guards

Return guards are similar to argspec guards, but apply to the
return value of the macro.

- ✅ should apply to the return value

- ✅ should let body errors pass through

- ✅ should not access macro arguments

- ✅ should evaluate in the caller scope

- Exceptions

  - ✅ empty body specifier

  - ✅ invalid body specifier

  - ✅ non-script body

#### Control flow

If the body returns a result code then it should be
propagated properly by the macro.

- `return`

  - ✅ should interrupt a macro with `RETURN` code

- `tailcall`

  - ✅ should interrupt a macro with `RETURN` code

- `yield`

  - ✅ should interrupt a macro with `YIELD` code

  - ✅ should provide a resumable state

  - ✅ should work recursively

- `error`

  - ✅ should interrupt a macro with `ERROR` code

- `break`

  - ✅ should interrupt a macro with `BREAK` code

- `continue`

  - ✅ should interrupt a macro with `CONTINUE` code

### Metacommand

`macro` returns a metacommand value that can be used to introspect
the newly created command.

- ✅ should return a metacommand

- ✅ the metacommand should return the macro

  The typical application of this property is to call the command by
  wrapping its metacommand within brackets, e.g. `[$metacommand]`.

#### Examples

- ✅ Calling macro through its wrapped metacommand

  Here we create a macro and call it through its metacommand:

  ```lna
  set cmd [macro double {val} {* 2 $val}]
  [$cmd] 3
  # => 6
  ```

  This behaves the same as calling the macro directly:

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

  - ✅ should return the macro's argspec

    Each macro has an argspec command associated to it, created
    with the macro's `argspec` argument. This subcommand will
    return it:

    ```lna
    [macro {a b} {}] argspec
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

