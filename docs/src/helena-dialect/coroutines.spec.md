---
source: src\helena-dialect\coroutines.spec.ts
---
# Helena coroutines

## `coroutine`

Create a coroutine

### Usage

```lna
coroutine body
```

The `coroutine` command creates a coroutine that will execute a body
script in its own child scope. Coroutine execution is interruptible and
resumable, and can be used for cooperative multitasking.

### Specifications

- ✅ usage

- ✅ should return a coroutine object

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ non-script body

### `body`

- ✅ should access scope variables

- ✅ should set scope variables

- ✅ should access scope commands

#### Control flow

- `return`

  - ✅ should interrupt the body with `OK` code

  - ✅ should return passed value

- `tailcall`

  - ✅ should interrupt the body with `OK` code

  - ✅ should return passed value

- `yield`

  - ✅ should interrupt the body with `OK` code

  - ✅ should return yielded value

  - ✅ should work recursively

- `error`

  - ✅ should interrupt the body with `ERROR` code

- `break`

  - ✅ should interrupt the body with `ERROR` code

- `continue`

  - ✅ should interrupt the body with `ERROR` code

### Coroutine object

`coroutine` returns a coroutine object value that can be used to
control the execution of the coroutine.

- ✅ the coroutine object should return itself

#### Subcommands

- `subcommands`

  - ✅ should return list of subcommands

    This subcommand is useful for introspection and interactive
    calls.

  - Exceptions

    - ✅ wrong arity

      The command will return an error message with usage when given the
      wrong number of arguments.

- `wait`

  - ✅ should evaluate body

  - ✅ should resume yielded body

  - ✅ should return result of completed coroutines

  - Exceptions

    - ✅ wrong arity

      The command will return an error message with usage when given the
      wrong number of arguments.

- `active`

  - ✅ should return `false` on new coroutines

  - ✅ should return `false` on completed coroutines

  - ✅ should return `true` on yielded coroutines

  - ✅ should return `false` on yielded coroutines ran to completion

  - Exceptions

    - ✅ wrong arity

      The command will return an error message with usage when given the
      wrong number of arguments.

- `done`

  - ✅ should return `false` on new coroutines

  - ✅ should return `true` on completed coroutines

  - ✅ should return `false` on yielded coroutines

  - ✅ should return `true` on yielded coroutines ran to completion

  - Exceptions

    - ✅ wrong arity

      The command will return an error message with usage when given the
      wrong number of arguments.

- `yield`

  - ✅ should resume yielded body

  - ✅ should yield back value to coroutine

  - Exceptions

    - ✅ wrong arity

      The command will return an error message with usage when given the
      wrong number of arguments.

    - ✅ inactive coroutine

    - ✅ completed coroutine

#### Exceptions

- ✅ unknown subcommand

- ✅ invalid subcommand name

