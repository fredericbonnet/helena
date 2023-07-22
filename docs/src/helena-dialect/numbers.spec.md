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

