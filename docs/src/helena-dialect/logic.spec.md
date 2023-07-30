---
source: src\helena-dialect\logic.spec.ts
---
# Helena logic operations

## Booleans

### Usage

```lna
true ?subcommand?
```
```lna
false ?subcommand?
```

Boolean values (or booleans) are Helena values whose internal type is
`BOOLEAN`.

- ✅ are valid commands

  Boolean `true` and `false` are regular commands.

- ✅ are idempotent

  Argument-less boolean commands return themselves.

### Infix operators

A boolean followed by an operator can be used for expressions in
infix notation.

#### Conditional

##### `?`

Conditional operator

```lna
true ? arg ?arg?
```
```lna
false ? arg ?arg?
```

The `?` operator conditionally returns a truthy vs. falsy value.

- `true`

  - ✅ should return first argument

  - ✅ should support a single argument

- `false`

  - ✅ should return nil if no second argument is given

  - ✅ should return second argument

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.

##### `!?`

Reverse conditional operator

```lna
true !? arg ?arg?
```
```lna
false !? arg ?arg?
```

The `!?` operator conditionally returns a falsy vs. truthy value.
It is the opposite of `?`.

- `true`

  - ✅ should return nil if no second argument is given

  - ✅ should return second argument

- `false`

  - ✅ should return first argument

  - ✅ should support a single argument

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.

### Subcommands

Apart from operators, boolean commands accept the subcommands listed
here.

#### Introspection

##### `subcommands`

```lna
true subcommands
```
```lna
false subcommands
```

This subcommand is useful for introspection and interactive
calls.

- ✅ should return list of subcommands

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.

### Exceptions

- ✅ unknown subcommand

- ✅ invalid subcommand name

## `bool`

Boolean handling

### Usage

```lna
bool value ?subcommand? ?arg ...?
```

The `bool` command is a type command dedicated to boolean values.

Boolean values are Helena values whose internal type is `BOOLEAN`. The
name `bool` was preferred over `boolean` because it is shorter and is
already used in many other languages like Python and C.

### Boolean conversion

Like with most type commands, passing a single argument to `bool`
will ensure a boolean value in return. This property means that
`bool` can be used for creation and conversion, but also as a type
guard in argspecs.

- ✅ should return boolean value

- Exceptions

  - ✅ values with no string representation

  - ✅ invalid values

### Subcommands

The `bool` ensemble comes with a number of predefined subcommands
listed here.

#### Introspection

##### `subcommands`

```lna
bool value subcommands
```

This subcommand is useful for introspection and interactive
calls.

- ✅ usage

- ✅ should return list of subcommands

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.

#### Exceptions

- ✅ unknown subcommand

- ✅ invalid subcommand name

### Ensemble command

`bool` is an ensemble command, which means that it is a collection
of subcommands defined in an ensemble scope.

- ✅ should return its ensemble metacommand when called with no argument

  The typical application of this property is to access the ensemble
  metacommand by wrapping the command within brackets, i.e. `[bool]`.

- ✅ should be extensible

  Creating a command in the `bool` ensemble scope will add it to its
  subcommands.

- ✅ should support help for custom subcommands

  Like all ensemble commands, `bool` have built-in support for `help`
  on all subcommands that support it.

#### Examples

- ✅ Adding a `xor` subcommand

  Here we create a `xor` macro within the `bool` ensemble
  scope, returning the excusive OR with another value. Notice the
  use of `bool` as a type guard for both arguments:

  ```lna
  [bool] eval {
    macro xor {(bool value1) (bool value2)} {
      $value1 ? [! $value2] $value2
    }
  }
  ```

  We can then use `xor` just like the predefined `bool`
  subcommands:

  ```lna
  bool true xor false
  # => true
  ```

  ```lna
  bool true xor true
  # => false
  ```

  ```lna
  bool false xor false
  # => false
  ```

  ```lna
  bool false xor true
  # => true
  ```

## Prefix operators

### `!`

Logical NOT operator

```lna
! arg
```

#### Specifications

- ✅ usage

- ✅ should invert boolean values

- ✅ should accept script expressions

#### Exceptions

- ✅ wrong arity

  Operators will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid value

  Only booleans and scripts are acceptable values.

#### Control flow

If a script expression returns a result code other than `OK` then
it should be propagated properly to the caller.

- `return`

  - ✅ should interrupt expression with `RETURN` code

- `tailcall`

  - ✅ should interrupt expression with `RETURN` code

- `yield`

  - ✅ should interrupt expression with `YIELD` code

  - ✅ should provide a resumable state

- `error`

  - ✅ should interrupt expression with `ERROR` code

- `break`

  - ✅ should interrupt expression with `BREAK` code

- `continue`

  - ✅ should interrupt expression with `CONTINUE` code

### `&&`

Logical AND operator

```lna
&& arg ?arg ...?
```

#### Specifications

- ✅ usage

- ✅ should accept one boolean

- ✅ should accept two booleans

- ✅ should accept several booleans

- ✅ should accept script expressions

- ✅ should short-circuit on `false`

#### Exceptions

- ✅ wrong arity

  Operators will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid value

  Only booleans and scripts are acceptable values.

#### Control flow

If a script expression returns a result code other than `OK` then
it should be propagated properly to the caller.

- `return`

  - ✅ should interrupt expression with `RETURN` code

- `tailcall`

  - ✅ should interrupt expression with `RETURN` code

- `yield`

  - ✅ should interrupt expression with `YIELD` code

  - ✅ should provide a resumable state

- `error`

  - ✅ should interrupt expression with `ERROR` code

- `break`

  - ✅ should interrupt expression with `BREAK` code

- `continue`

  - ✅ should interrupt expression with `CONTINUE` code

### `||`

Logical OR operator

#### Usage

```lna
|| arg ?arg ...?
```

#### Specifications

- ✅ usage

- ✅ should accept one boolean

- ✅ should accept two booleans

- ✅ should accept several booleans

- ✅ should accept script expressions

- ✅ should short-circuit on `true`

#### Exceptions

- ✅ wrong arity

  Operators will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid value

  Only booleans and scripts are acceptable values.

#### Control flow

If a script expression returns a result code other than `OK` then
it should be propagated properly to the caller.

- `return`

  - ✅ should interrupt expression with `RETURN` code

- `tailcall`

  - ✅ should interrupt expression with `RETURN` code

- `yield`

  - ✅ should interrupt expression with `YIELD` code

  - ✅ should provide a resumable state

- `error`

  - ✅ should interrupt expression with `ERROR` code

- `break`

  - ✅ should interrupt expression with `BREAK` code

- `continue`

  - ✅ should interrupt expression with `CONTINUE` code

