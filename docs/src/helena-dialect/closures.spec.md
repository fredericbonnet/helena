---
source: src\helena-dialect\closures.spec.ts
---
# Helena closures

## `closure`

Create a closure command

### Usage

```lna
closure ?name? argspec body
```

The `closure` command creates a new command that will execute a script
in the scope where it is declared.

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

### Command calls

- ✅ should return nil for empty body

- ✅ should return the result of the last command

- should evaluate in the closure parent scope

  - ✅ global scope

  - ✅ child scope

  - ✅ scoped closure

#### Arguments

- ✅ should shadow scope variables

- ✅ should be closure-local

- Exceptions

  - ✅ wrong arity

    The closure will return an error message with usage when given
    the wrong number of arguments.

#### Return guards

Return guards are similar to argspec guards, but apply to the
return value of the closure.

- ✅ should apply to the return value

- ✅ should let body errors pass through

- ✅ should not access closure arguments

- ✅ should evaluate in the closure parent scope

- Exceptions

  - ✅ empty body specifier

  - ✅ invalid body specifier

  - ✅ non-script body

#### Control flow

If the body returns a result code then it should be propagated
properly by the closure.

- `return`

  - ✅ should interrupt a closure with `RETURN` code

- `tailcall`

  - ✅ should interrupt a closure with `RETURN` code

- `yield`

  - ✅ should interrupt a closure with `YIELD` code

  - ✅ should provide a resumable state

  - ✅ should work recursively

- `error`

  - ✅ should interrupt a closure with `ERROR` code

- `break`

  - ✅ should interrupt a closure with `BREAK` code

- `continue`

  - ✅ should interrupt a closure with `CONTINUE` code

### Metacommand

`closure` returns a metacommand value that can be used to introspect
the newly created command.

- ✅ should return a metacommand

- ✅ the metacommand should return the closure

  The typical application of this property is to call the closure by
  wrapping its metacommand within brackets, e.g. `[$metacommand]`.

#### Examples

- ✅ Calling closure through its wrapped metacommand

  Here we create a closure and call it through its metacommand:

  ```lna
  set cmd [closure double {val} {* 2 $val}]
  [$cmd] 3
  # => 6
  ```

  This behaves the same as calling the closure directly:

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

  - ✅ should return the closure's argspec

    Each closure has an argspec command associated to it, created
    with the closure's `argspec` argument. This subcommand will
    return it:

    ```lna
    [closure {a b} {}] argspec
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

