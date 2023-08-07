---
source: src\helena-dialect\numbers.spec.ts
---
# <a id="real"></a>`real`

Real number handling

## Usage

```lna
real value ?subcommand? ?arg ...?
```

The `real` command is a type command dedicated to real values.

Real values are Helena values whose internal type is `REAL`.


## <a id="real-real-conversion"></a>Real conversion

Like with most type commands, passing a single argument to `real`
will ensure a real value in return. This property means that `real`
can be used for creation and conversion, but also as a type guard in
argspecs.

- ✅ should return real value

- Exceptions

  - ✅ values with no string representation
  - ✅ invalid values

## <a id="real-subcommands"></a>Subcommands

The `real` ensemble comes with a number of predefined subcommands
listed here.


### <a id="real-subcommands-introspection"></a>Introspection


#### <a id="real-subcommands-introspection-subcommands"></a>`subcommands`

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


### <a id="real-subcommands-exceptions"></a>Exceptions

- ✅ unknown subcommand
- ✅ invalid subcommand name

## <a id="real-ensemble-command"></a>Ensemble command

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


### <a id="real-ensemble-command-examples"></a>Examples

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


