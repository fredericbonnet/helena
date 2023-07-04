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

- ✅ non-script body

- ✅ invalid command name

### Command calls

- ✅ should return nil for empty body

- ✅ should return the result of the last command

- ✅ should access scope variables

- ✅ should set scope variables

- ✅ should access scope commands

#### should evaluate in the caller scope

- ✅ global scope

- ✅ child scope

- ✅ scoped macro

#### Arguments

- ✅ should shadow scope variables

- ✅ should be macro-local

#### Return guards

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

##### `return`

- ✅ should interrupt a macro with `RETURN` code

##### `tailcall`

- ✅ should interrupt a macro with `RETURN` code

##### `yield`

- ✅ should interrupt a macro with `YIELD` code

- ✅ should provide a resumable state

- ✅ should work recursively

##### `error`

- ✅ should interrupt a macro with `ERROR` code

##### `break`

- ✅ should interrupt a macro with `BREAK` code

##### `continue`

- ✅ should interrupt a macro with `CONTINUE` code

#### Exceptions

- ✅ wrong arity

  The macro will return an error message with usage when given the
  wrong number of arguments.

### Metacommand

`macro` returns a metacommand value that can be used to introspect
the newly created command.

- ✅ should return a command object

- ✅ the command object should return the macro

  The typical application of this property is to call the command by
  wrapping its metacommand within brackets, i.e. `[$metacommand]`:
  
  ```lna
  set cmd [macro double {val} {* 2 $val}]
  # These sentences yield the same results:
  double 3
  [$cmd] 3
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

  - ✅ should return the macro argspec

    This will return the argspec command created with the `argspec`
    argument.

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

- Exceptions

  - ✅ unknown subcommand

  - ✅ invalid subcommand name

