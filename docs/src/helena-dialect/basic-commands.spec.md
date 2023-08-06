---
source: src\helena-dialect\basic-commands.spec.ts
---
# <a id=""></a>Helena basic commands

- [`idem`](#idem) - Return the value that is passed to it
- [`return`](#return) - Stop execution with `RETURN` code
- [`tailcall`](#tailcall) - Transfer execution to another script
- [`yield`](#yield) - Pause execution with `YIELD` code
- [`error`](#error) - Stop execution with `ERROR` code
- [`break`](#break) - Stop execution with `BREAK` code
- [`continue`](#continue) - Stop execution with `CONTINUE` code
- [`eval`](#eval) - Evaluate a script
- [`help`](../../pages/helena-dialect/commands/help.md) - Give usage of a command


## <a id="idem"></a>`idem`

Return the value that is passed to it

### Usage

```lna
idem value
```

The `idem` command returns the value that is passed to it. _Idem_ is a
latin term meaning "the same".


### <a id="idem_Specifications"></a>Specifications

- ✅ usage
- ✅ should return its `value` argument

### <a id="idem_Exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.


## <a id="return"></a>`return`

Stop execution with `RETURN` code

### Usage

```lna
return ?result?
```

The `return` command is a control flow command that stops the script
with a `RETURN` code and an optional result value.


### <a id="return_Specifications"></a>Specifications

- ✅ usage
- ✅ result code should be `RETURN`
- ✅ should return nil by default
- ✅ should return its optional `result` argument
- ✅ should interrupt the script

### <a id="return_Exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.


## <a id="tailcall"></a>`tailcall`

Transfer execution to another script

### Usage

```lna
tailcall body
```

The `tailcall` command is a control flow command that stops the script
with a `RETURN` code and the evaluated result of another script passed
as argument.


### <a id="tailcall_Specifications"></a>Specifications

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

### <a id="tailcall_Exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `body`

  The `body` argument must be a script or tuple.


## <a id="yield"></a>`yield`

Pause execution with `YIELD` code

### Usage

```lna
yield ?result?
```

The `yield` command is a control flow command that pauses the script
with a `YIELD` code and an optional result value. The script state is
saved for later resumability.


### <a id="yield_Specifications"></a>Specifications

- ✅ usage
- ✅ result code should be `YIELD`
- ✅ should yield nil by default
- ✅ should yield its optional `result` argument

### <a id="yield_Exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.


## <a id="error"></a>`error`

Stop execution with `ERROR` code

### Usage

```lna
error message
```

The `yield` command is a control flow command that stops the script
with a `ERROR` code and a message value.


### <a id="error_Specifications"></a>Specifications

- ✅ usage
- ✅ result code should be `ERROR`
- ✅ result value should be its `message` argument

### <a id="error_Exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ non-string `message`

  Only values with a string representation are accepted as the
  `message` argument.


## <a id="break"></a>`break`

Stop execution with `BREAK` code

### Usage

```lna
break
```

The `yield` command is a control flow command that stops the script
with a `BREAK` code.


### <a id="break_Specifications"></a>Specifications

- ✅ usage
- ✅ result code should be `BREAK`

### <a id="break_Exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.


## <a id="continue"></a>`continue`

Stop execution with `CONTINUE` code

### Usage

```lna
continue
```

The `yield` command is a control flow command that stops the script
with a `CONTINUE` code.


### <a id="continue_Specifications"></a>Specifications

- ✅ usage
- ✅ result code should be `CONTINUE`

### <a id="continue_Exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.


## <a id="eval"></a>`eval`

Evaluate a script

### Usage

```lna
eval body
```

The command `eval` evaluates and returns the result of a Helena script
in the current scope.


### <a id="eval_Specifications"></a>Specifications

- ✅ usage
- ✅ should return nil for empty `body`
- ✅ should return the result of the last command evaluated in `body`
- ✅ should evaluate `body` in the current scope
- ✅ should accept tuple `body` arguments
- ✅ should work recursively

### <a id="eval_Exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `body`

  The `body` argument must be a script or tuple.


### <a id="eval_Control_flow"></a>Control flow

Control flow commands will interrupt the evaluated script.


- `return`

  - ✅ should interrupt the body with `RETURN` code
  - ✅ should return passed value

- `tailcall`

  - ✅ should interrupt the body with `RETURN` code
  - ✅ should return tailcall result

- `yield`

  - ✅ should interrupt the body with `YIELD` code
  - ✅ should provide a resumable state

    Scripts interrupted with `yield` can be resumed later.


- `error`

  - ✅ should interrupt the body with `ERROR` code

- `break`

  - ✅ should interrupt the body with `BREAK` code

- `continue`

  - ✅ should interrupt the body with `CONTINUE` code

