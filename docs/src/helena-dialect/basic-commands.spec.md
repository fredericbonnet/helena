---
source: src\helena-dialect\basic-commands.spec.ts
---
# Helena basic commands

## `idem`

Return the value that is passed to it

### Usage

```lna
idem value
```

The `idem` command returns the value that is passed to it. _Idem_ is a
latin term meaning "the same".

### Specifications

- ✅ usage

- ✅ should return its `value` argument

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

## `return`

Stop execution with `RETURN` code

### Usage

```lna
return ?result?
```

The `return` command is a control flow command that stops the script
with a `RETURN` code and an optional result value.

### Specifications

- ✅ usage

- ✅ result code should be `RETURN`

- ✅ should return nil by default

- ✅ should return its optional `result` argument

- ✅ should interrupt the script

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

## `tailcall`

Transfer execution to another script

### Usage

```lna
tailcall body
```

The `tailcall` command is a control flow command that stops the script
with the evaluated result of another script passed as argument.

### Specifications

- ✅ usage

- ✅ result code should be `RETURN`

- ✅ should accept script values for its `body` argument

- ✅ should accept tuple values for its `body` argument

- ✅ should return the evaluation result of it `body` argument

- ✅ should propagate `ERROR` code from `body`

- ✅ should propagate `BREAK` code from `body`

- ✅ should propagate `CONTINUE` code from `body`

- ✅ should interrupt the script

- ✅ should work recursively

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `body`

  The `body` argument must be a script or tuple.

## `yield`

Pause execution with `YIELD` code

### Usage

```lna
yield ?result?
```

The `yield` command is a control flow command that pauses the script
with a `RETURN` code and an optional result value. The script state is
saved for later resumability.

### Specifications

- ✅ usage

- ✅ result code should be `YIELD`

- ✅ should yield nil by default

- ✅ should yield its optional `result` argument

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

## `error`

Stop execution with `ERROR` code

### Usage

```lna
error message
```

The `yield` command is a control flow command that stops the script
with a `ERROR` code and a message value.

### Specifications

- ✅ usage

- ✅ result code should be `ERROR`

- ✅ result value should be its `message` argument

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ non-string `message`

  Only values with a string representation are accepted as the `message` argument

## `break`

Stop execution with `BREAK` code

### Usage

```lna
break
```

The `yield` command is a control flow command that stops the script
with a `BREAK` code.

### Specifications

- ✅ usage

- ✅ result code should be `BREAK`

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

## `continue`

Stop execution with `CONTINUE` code

### Usage

```lna
continue
```

The `yield` command is a control flow command that stops the script
with a `CONTINUE` code.

### Specifications

- ✅ usage

- ✅ result code should be `CONTINUE`

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

## `eval`

### Usage

```lna
eval body
```

The command `eval` evaluates and returns the result of a Helena script
in the current scope.

### Specifications

- ✅ usage

- ✅ should return nil for empty `body`

- ✅ should return the result of the last command evaluated in `body`

- ✅ should evaluate `body` in the current scope

- ✅ should accept tuple `body` arguments

- ✅ should work recursively

#### Control flow

Control flow commands will interrupt the evaluated script.

##### `return`

- ✅ should interrupt the body with `RETURN` code

- ✅ should return passed value

##### `tailcall`

- ✅ should interrupt the body with `RETURN` code

- ✅ should return tailcall result

##### `yield`

- ✅ should interrupt the body with `YIELD` code

- ✅ should provide a resumable state

  Scripts interrupted with `yield` can be resumed later.

##### `error`

- ✅ should interrupt the body with `ERROR` code

##### `break`

- ✅ should interrupt the body with `BREAK` code

##### `continue`

- ✅ should interrupt the body with `CONTINUE` code

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `body`

  The provided body must be a script or tuple.

## `help`

Give usage of a command

### Usage

```lna
help command ?arg ...?
```

The `help` command returns a help string for the given command.

### Specifications

- ✅ should give usage of itself

- ✅ should accept optional arguments

  Passing extra arguments will validate the command signature.

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ unknown command

- ✅ invalid command name

- ✅ command with no help

