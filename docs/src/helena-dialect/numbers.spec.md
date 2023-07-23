---
source: src\helena-dialect\numbers.spec.ts
---
# Helena numbers

## Number commands

### Integer numbers

Integer number values (or integers) are Helena values whose internal
type is `INTEGER`.

- ✅ are valid commands

  Integers are implicit commands. Any command name that can be parsed
  as an integer is resolved as such.

- ✅ are idempotent

  Argument-less integer commands return themselves.

- ✅ can be expressed as strings

- Exceptions

  - ✅ unknown subcommand

  - ✅ invalid subcommand name

### Real numbers

Real number values (or reals) are Helena values whose internal type
is `REAL`.

- ✅ are valid commands

  Reals are implicit commands. Any command name that can be parsed as a
  non-integer number is resolved as such.

- ✅ are idempotent

  Argument-less real number commands return themselves.

- ✅ can be expressed as strings

- Exceptions

  - ✅ unknown subcommand

  - ✅ invalid subcommand name

### Infix operators

A number followed by an operator can be used to express an infix
expression.

#### Arithmetic

Numbers support the standard arithmetic operators.

- ✅ `+`

- ✅ `-`

- ✅ `*`

- ✅ `/`

- ✅ Precedence rules

  Operators are evaluated left-to-right with the following precedence
  rules (highest to lowest):
  
  - `*` `/`
  - `+` `-`
  
  Other operators cannot be mixed with the above and need to be
  enclosed in their own expressions. To that effect, brace characters
  are used for grouping.

- ✅ Conversions

  Integers and reals can be mixed in the same expressions, the result
  will be losslessly converted to an integer whenever possible.

- Exceptions

  - ✅ wrong arity

    Operators will return an error message with usage when given the
    wrong number of arguments.

  - ✅ invalid value

  - ✅ unknown operator

  - ✅ invalid operator

#### Comparisons

Numbers support the standard comparison operators.

- `==`

  - ✅ should compare two numbers

  - Exceptions

    - ✅ wrong arity

      The operator will return an error message with usage when given
      the wrong number of arguments.

    - ✅ invalid value

- `!=`

  - ✅ should compare two numbers

  - Exceptions

    - ✅ wrong arity

      The operator will return an error message with usage when given
      the wrong number of arguments.

    - ✅ invalid value

- `>`

  - ✅ should compare two numbers

  - Exceptions

    - ✅ wrong arity

      The operator will return an error message with usage when given
      the wrong number of arguments.

    - ✅ invalid value

- `>=`

  - ✅ should compare two numbers

  - Exceptions

    - ✅ wrong arity

      The operator will return an error message with usage when given
      the wrong number of arguments.

    - ✅ invalid value

- `<`

  - ✅ should compare two numbers

  - Exceptions

    - ✅ wrong arity

      The operator will return an error message with usage when given
      the wrong number of arguments.

    - ✅ invalid value

- `<=`

  - ✅ should compare two numbers

  - Exceptions

    - ✅ wrong arity

      The operator will return an error message with usage when given
      the wrong number of arguments.

    - ✅ invalid value

### Subcommands

Apart from operators, number commands accept the subcommands listed
here.

#### Introspection

- `subcommands`

  - ✅ should return list of subcommands

    This subcommand is useful for introspection and interactive
    calls.

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

## `int`

Integer number handling

### Usage

```lna
integer ?value? ?subcommand? ?arg ...?
```

The `int` command is a type command dedicated to integer values.

Integer values are Helena values whose internal type is `INTEGER`. The
name `int` was preferred over `integer` because it is shorter and is
already used in many other languages like Python and C.

### Integer conversion

Like with most type commands, passing a single argument to `int` will
ensure an integer value in return. This property means that `int` can
be used for creation and conversion, but also as a type guard in
argspecs.

- ✅ should return integer value

- Exceptions

  - ✅ values with no string representation

  - ✅ invalid values

  - ✅ real values

    Non-integer real values are not accepted.

#### Subcommands

The `int` ensemble comes with a number of predefined subcommands
listed here.

##### Introspection

- `subcommands`

  - ✅ should return list of subcommands

    This subcommand is useful for introspection and interactive
    calls.

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

##### Exceptions

- ✅ unknown subcommand

- ✅ invalid subcommand name

### Ensemble command

`int` is an ensemble command, which means that it is a collection
of subcommands defined in an ensemble scope.

- ✅ should return its ensemble metacommand when called with no argument

  The typical application of this property is to access the ensemble
  metacommand by wrapping the command within brackets, i.e. `[int]`.

- ✅ should be extensible

  Creating a command in the `int` ensemble scope will add it to its
  subcommands.

#### Examples

- ✅ Adding a `positive` subcommand

  Here we create a `positive` macro within the `int` ensemble
  scope, returning whether the value is strictly positive:

  ```lna
  [int] eval {
    macro positive {value} {
      $value > 0
    }
  }
  ```

  We can then use `positive` just like the predefined `int`
  subcommands:

  ```lna
  int 1 positive
  # => true
  ```

  ```lna
  int 0 positive
  # => false
  ```

  ```lna
  int -1 positive
  # => false
  ```

## `real`

Real number handling

### Usage

```lna
real ?value? ?subcommand? ?arg ...?
```

The `real` command is a type command dedicated to real values.

Real values are Helena values whose internal type is `REAL`.

### Real conversion

Like with most type commands, passing a single argument to `real`
will ensure a real value in return. This property means that `real`
can be used for creation and conversion, but also as a type guard in
argspecs.

- ✅ should return real value

- Exceptions

  - ✅ values with no string representation

  - ✅ invalid values

#### Subcommands

The `real` ensemble comes with a number of predefined subcommands
listed here.

##### Introspection

- `subcommands`

  - ✅ should return list of subcommands

    This subcommand is useful for introspection and interactive
    calls.

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

##### Exceptions

- ✅ unknown subcommand

- ✅ invalid subcommand name

### Ensemble command

`real` is an ensemble command, which means that it is a collection of
subcommands defined in an ensemble scope.

- ✅ should return its ensemble metacommand when called with no argument

  The typical application of this property is to access the ensemble
  metacommand by wrapping the command within brackets, i.e.
  `[real]`.

- ✅ should be extensible

  Creating a command in the `real` ensemble scope will add it to its
  subcommands.

#### Examples

- ✅ Adding a `positive` subcommand

  Here we create a `positive` macro within the `real` ensemble
  scope, returning whether the value is strictly positive:

  ```lna
  [real] eval {
    macro positive {value} {
      $value > 0
    }
  }
  ```

  We can then use `positive` just like the predefined `real`
  subcommands:

  ```lna
  real 0.1 positive
  # => true
  ```

  ```lna
  real 0 positive
  # => false
  ```

  ```lna
  real -1 positive
  # => false
  ```

