---
source: src\helena-dialect\numbers.spec.ts
---
# <a id=""></a>Helena numbers


## <a id="Number_commands"></a>Number commands


### <a id="Number_commands_Integer_numbers"></a>Integer numbers

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

### <a id="Number_commands_Real_numbers"></a>Real numbers

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

### <a id="Number_commands_Infix_operators"></a>Infix operators

A number followed by an operator can be used for expressions in infix
notation.


#### <a id="Number_commands_Infix_operators_Arithmetic"></a>Arithmetic

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

#### <a id="Number_commands_Infix_operators_Comparisons"></a>Comparisons

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

### <a id="Number_commands_Subcommands"></a>Subcommands

Apart from operators, number commands accept the subcommands listed
here.


#### <a id="Number_commands_Subcommands_Introspection"></a>Introspection


- `subcommands`

  - ✅ should return list of subcommands

    This subcommand is useful for introspection and interactive
    calls.


  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.


## <a id="int"></a>`int`

Integer number handling

### Usage

```lna
int value ?subcommand? ?arg ...?
```

The `int` command is a type command dedicated to integer values.

Integer values are Helena values whose internal type is `INTEGER`. The
name `int` was preferred over `integer` because it is shorter and is
already used in many other languages like Python and C.


### <a id="int_Integer_conversion"></a>Integer conversion

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


### <a id="int_Subcommands"></a>Subcommands

The `int` ensemble comes with a number of predefined subcommands
listed here.


#### <a id="int_Subcommands_Introspection"></a>Introspection


##### <a id="int_Subcommands_Introspection_subcommands"></a>`subcommands`

```lna
int value subcommands
```

This subcommand is useful for introspection and interactive
calls.

- ✅ usage
- ✅ should return list of subcommands

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.


#### <a id="int_Subcommands_Exceptions"></a>Exceptions

- ✅ unknown subcommand
- ✅ invalid subcommand name

### <a id="int_Ensemble_command"></a>Ensemble command

`int` is an ensemble command, which means that it is a collection
of subcommands defined in an ensemble scope.

- ✅ should return its ensemble metacommand when called with no argument

  The typical application of this property is to access the ensemble
  metacommand by wrapping the command within brackets, i.e. `[int]`.

- ✅ should be extensible

  Creating a command in the `int` ensemble scope will add it to its
  subcommands.

- ✅ should support help for custom subcommands

  Like all ensemble commands, `int` have built-in support for `help`
  on all subcommands that support it.


#### <a id="int_Ensemble_command_Examples"></a>Examples

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


## <a id="real"></a>`real`

Real number handling

### Usage

```lna
real value ?subcommand? ?arg ...?
```

The `real` command is a type command dedicated to real values.

Real values are Helena values whose internal type is `REAL`.


### <a id="real_Real_conversion"></a>Real conversion

Like with most type commands, passing a single argument to `real`
will ensure a real value in return. This property means that `real`
can be used for creation and conversion, but also as a type guard in
argspecs.

- ✅ should return real value

- Exceptions

  - ✅ values with no string representation
  - ✅ invalid values

### <a id="real_Subcommands"></a>Subcommands

The `real` ensemble comes with a number of predefined subcommands
listed here.


#### <a id="real_Subcommands_Introspection"></a>Introspection


##### <a id="real_Subcommands_Introspection_subcommands"></a>`subcommands`

```lna
real value subcommands
```

This subcommand is useful for introspection and interactive
calls.

- ✅ usage
- ✅ should return list of subcommands

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.


#### <a id="real_Subcommands_Exceptions"></a>Exceptions

- ✅ unknown subcommand
- ✅ invalid subcommand name

### <a id="real_Ensemble_command"></a>Ensemble command

`real` is an ensemble command, which means that it is a collection of
subcommands defined in an ensemble scope.

- ✅ should return its ensemble metacommand when called with no argument

  The typical application of this property is to access the ensemble
  metacommand by wrapping the command within brackets, i.e.
  `[real]`.

- ✅ should be extensible

  Creating a command in the `real` ensemble scope will add it to its
  subcommands.

- ✅ should support help for custom subcommands

  Like all ensemble commands, `real` have built-in support for `help`
  on all subcommands that support it.


#### <a id="real_Ensemble_command_Examples"></a>Examples

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


