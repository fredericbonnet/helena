---
source: src\helena-dialect\logic.spec.ts
---
# <a id="bool"></a>`bool`

Boolean handling

## Usage

```lna
bool value ?subcommand? ?arg ...?
```

The `bool` command is a type command dedicated to boolean values.

Boolean values are Helena values whose internal type is `BOOLEAN`. The
name `bool` was preferred over `boolean` because it is shorter and is
already used in many other languages like Python and C.


## <a id="bool-boolean-conversion"></a>Boolean conversion

Like with most type commands, passing a single argument to `bool`
will ensure a boolean value in return. This property means that
`bool` can be used for creation and conversion, but also as a type
guard in argspecs.

- ✅ should return boolean value

- Exceptions

  - ✅ values with no string representation
  - ✅ invalid values

## <a id="bool-subcommands"></a>Subcommands

The `bool` ensemble comes with a number of predefined subcommands
listed here.


### <a id="bool-subcommands-introspection"></a>Introspection


#### <a id="bool-subcommands-introspection-subcommands"></a>`subcommands`

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


### <a id="bool-subcommands-exceptions"></a>Exceptions

- ✅ unknown subcommand
- ✅ invalid subcommand name

## <a id="bool-ensemble-command"></a>Ensemble command

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


### <a id="bool-ensemble-command-examples"></a>Examples

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


