---
source: src\helena-dialect\strings.spec.ts
---
# Helena strings

## `string`

String handling

### Usage

```lna
string ?value? ?subcommand? ?arg ...?
```

The `string` command is a type command dedicated to string values. It
provides an ensemble of subcommands for string creation, conversion,
access, and operations.

String values are Helena values whose internal type is `STRING`.

### String creation and conversion

Like with most type commands, passing a single argument to `string`
will ensure a string value in return. This property means that
`string` can be used for creation and conversion, but also as a type
guard in argspecs.

- ✅ should return string value

- ✅ should convert non-string values to strings

  Any value having a valid string representation can be used.

- Exceptions

  - ✅ values with no string representation

### Subcommands

The `string` ensemble comes with a number of predefined subcommands
listed here.

#### Introspection

- `subcommands`

  - ✅ should return list of subcommands

    This subcommand is useful for introspection and interactive
    calls.

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

#### Accessors

- `length`

  - ✅ should return the string length

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

- `at`

  - ✅ should return the character at the given index

  - ✅ should return the default value for an out-of-range index

  - ✅ at <-> indexed selector equivalence

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

    - ✅ invalid index

    - ✅ index out of range

#### String operations

- `range`

  - ✅ should return the string included within [first, last]

  - ✅ should return the remainder of the string when given first only

  - ✅ should truncate out of range boundaries

  - ✅ should return an empty string when last is before first

  - ✅ should return an empty string when first is past the string length

  - ✅ should return an empty string when last is negative

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

    - ✅ invalid index

- `remove`

  - ✅ should remove the range included within [first, last]

  - ✅ should truncate out of range boundaries

  - ✅ should do nothing when last is before first

  - ✅ should do nothing when last is negative

  - ✅ should do nothing when first is past the string length

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

    - ✅ invalid index

- `append`

  - ✅ should append two strings

  - ✅ should accept several strings

  - ✅ should accept zero string

  - Exceptions

    - ✅ values with no string representation

- `insert`

  - ✅ should insert the string at the given index

  - ✅ should prepend the string when index is negative

  - ✅ should append the string when index is past the string length

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

    - ✅ invalid index

    - ✅ values with no string representation

- `replace`

  - ✅ should replace the range included within [first, last] with the given string

  - ✅ should truncate out of range boundaries

  - ✅ should insert the string at first index when last is before first

  - ✅ should prepend the string when last is negative

  - ✅ should append the string when first is past the string length

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

    - ✅ invalid index

    - ✅ values with no string representation

#### String comparisons

- `==`

  - ✅ should compare two strings

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

    - ✅ values with no string representation

- `!=`

  - ✅ should compare two strings

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

    - ✅ values with no string representation

- `>`

  - ✅ should compare two strings

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

    - ✅ values with no string representation

- `>=`

  - ✅ should compare two strings

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

    - ✅ values with no string representation

- `<`

  - ✅ should compare two strings

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

    - ✅ values with no string representation

- `<=`

  - ✅ should compare two strings

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

    - ✅ values with no string representation

#### Exceptions

- ✅ unknown subcommand

- ✅ invalid subcommand name

### Examples

- ✅ Currying and encapsulation

  Thanks to leading tuple auto-expansion, it is very simple to
  bundle the `string` command and a value into a tuple to create a
  pseudo-object value. For example:

  ```lna
  set s (string example)
  ```

  We can then use this variable like a regular command. Calling it
  without argument will return the wrapped value:

  ```lna
  $s
  # => example
  ```

  Subcommands then behave like object methods:

  ```lna
  $s length
  # => 7
  ```

  ```lna
  $s at 2
  # => a
  ```

  ```lna
  $s range 3 5
  # => mpl
  ```

  ```lna
  $s == example
  # => true
  ```

  ```lna
  $s > exercise
  # => false
  ```

- ✅ Argument type guard

  Calling `string` with a single argument returns its value as a
  list. This property allows `string` to be used as a type guard
  for argspecs.
  
  Here we create a macro `len` that returns the length of the
  provided string. Using `string` as guard has three effects:
  
  - it validates the argument on the caller side
  - it converts the value at most once
  - it ensures type safety within the body
  
  Note how using `string` as a guard for argument `s` makes it look
  like a static type declaration:

  ```lna
  macro len ( (string s) ) {string $s length}
  ```

  Passing a valid value will give the expected result:

  ```lna
  len example
  # => 7
  ```

  Passing an invalid value will produce an error:

  ```lna
  len (invalid value)
  # => [error "value has no string representation"]
  ```

### Ensemble command

`string` is an ensemble command, which means that it is a collection
of subcommands defined in an ensemble scope.

- ✅ should return its ensemble metacommand

  The typical application of this property is to access the ensemble
  metacommand by wrapping the command within brackets, i.e. `[string]`.

- ✅ should be extensible

  Creating a command in the `string` ensemble scope will add it to its
  subcommands.

#### Examples

- ✅ Adding a `last` subcommand

  Here we create a `last` macro within the `string` ensemble
  scope, returning the last character of the provided string
  value:

  ```lna
  [string] eval {
    macro last {value} {
      string $value at [- [string $value length] 1]
    }
  }
  ```

  We can then use `last` just like the predefined `string`
  subcommands:

  ```lna
  string example last
  # => e
  ```

- ✅ Adding a `+` operator

  Here we create a `+` binary macro that concatenates two strings
  together:

  ```lna
  [string] eval {
    macro + {str1 str2} {idem $str1$str2}
  }
  ```

  (Note how we are free to name subcommand arguments however we
  want)
  
  We can then use `+` as an infix concatenate operator:

  ```lna
  string s1 + s2
  # => s1s2
  ```

