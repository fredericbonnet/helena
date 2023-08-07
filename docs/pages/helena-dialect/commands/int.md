---
source: src\helena-dialect\numbers.spec.ts
---
# <a id="int"></a>`int`

Integer number handling

## Usage

```lna
int value ?subcommand? ?arg ...?
```

The `int` command is a type command dedicated to integer values.

Integer values are Helena values whose internal type is `INTEGER`. The
name `int` was preferred over `integer` because it is shorter and is
already used in many other languages like Python and C.


## <a id="int-integer-conversion"></a>Integer conversion

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


## <a id="int-subcommands"></a>Subcommands

The `int` ensemble comes with a number of predefined subcommands
listed here.


### <a id="int-subcommands-introspection"></a>Introspection


#### <a id="int-subcommands-introspection-subcommands"></a>`subcommands`

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


### <a id="int-subcommands-exceptions"></a>Exceptions

- ✅ unknown subcommand
- ✅ invalid subcommand name

## <a id="int-ensemble-command"></a>Ensemble command

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


### <a id="int-ensemble-command-examples"></a>Examples

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


