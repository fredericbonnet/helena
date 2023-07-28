---
source: src\helena-dialect\tuples.spec.ts
---
# Helena tuples

## `tuple`

Tuple handling

### Usage

```lna
tuple value ?subcommand? ?arg ...?
```

The `tuple` command is a type command dedicated to tuple values. It
provides an ensemble of subcommands for tuple creation, conversion,
access, and operations.

Tuple values are Helena values whose internal type is `TUPLE`.

### Tuple creation and conversion

Like with most type commands, passing a single argument to `tuple`
will ensure a tuple value in return. This property means that `tuple`
can be used for creation and conversion, but also as a type guard in
argspecs.

- ✅ should return tuple value

- ✅ should convert lists to tuple

- ✅ should convert blocks to tuples

  Blocks are also accepted; the block is evaluated in an empty scope
  and each resulting word is added to the tuple in order.

  ```lna
  tuple {a b c}
  # => (a b c)
  ```

- Exceptions

  - ✅ invalid values

    Only tuples, lists, and blocks are acceptable values.

  - ✅ blocks with side effects

    Providing a block with side effects like substitutions or
    expressions will result in an error.

### Subcommands

The `tuple` ensemble comes with a number of predefined subcommands
listed here.

- ✅ should be extensible

#### Introspection

##### `subcommands`

```lna
tuple value subcommands
```

This subcommand is useful for introspection and interactive
calls.

- ✅ usage

- ✅ should return list of subcommands

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.

#### Accessors

##### `length`

Get tuple length

```lna
tuple value length
```

- ✅ usage

- ✅ should return the tuple length

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.

##### `at`

Get tuple element

```lna
tuple value at index ?default?
```

- ✅ usage

- ✅ should return the element at `index`

- ✅ should return the default value for an out-of-range `index`

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.

  - ✅ invalid `index`

  - ✅ `index` out of range

#### Exceptions

- ✅ unknown subcommand

- ✅ invalid subcommand name

### Examples

- ✅ Currying and encapsulation

  Thanks to leading tuple auto-expansion, it is very simple to
  bundle the `tuple` command and a value into a tuple to create a
  pseudo-object value. For example:

  ```lna
  set t (tuple (a b c d e f g))
  ```

  We can then use this variable like a regular command. Calling it
  without argument will return the wrapped value:

  ```lna
  $t
  # => (a b c d e f g)
  ```

  Subcommands then behave like object methods:

  ```lna
  $t length
  # => 7
  ```

  ```lna
  $t at 2
  # => c
  ```

- ✅ Argument type guard

  Calling `tuple` with a single argument returns its value as a
  tuple. This property allows `tuple` to be used as a type guard
  for argspecs.
  
  Here we create a macro `len` that returns the length of the
  provided tuple. Using `tuple` as guard has three effects:
  
  - it validates the argument on the caller side
  - it converts the value at most once
  - it ensures type safety within the body
  
  Note how using `tuple` as a guard for argument `t` makes it look
  like a static type declaration:

  ```lna
  macro len ( (tuple t) ) {tuple $t length}
  ```

  Passing a valid value will give the expected result:

  ```lna
  len (1 2 3 4)
  # => 4
  ```

  Conversions are implicit:

  ```lna
  len [list {1 2 3}]
  # => 3
  ```

  Passing an invalid value will produce an error:

  ```lna
  len invalidValue
  # => [error "invalid tuple"]
  ```

### Ensemble command

`tuple` is an ensemble command, which means that it is a collection
of subcommands defined in an ensemble scope.

- ✅ should return its ensemble metacommand when called with no argument

  The typical application of this property is to access the ensemble
  metacommand by wrapping the command within brackets, i.e. `[tuple]`.

- ✅ should be extensible

  Creating a command in the `tuple` ensemble scope will add it to its
  subcommands.

- ✅ should support help for custom subcommands

  Like all ensemble commands, `tuple` have built-in support for `help`
  on all subcommands that support it.

#### Examples

- ✅ Adding a `last` subcommand

  Here we create a `last` macro within the `tuple` ensemble
  scope, returning the last element of the provided tuple value:

  ```lna
  [tuple] eval {
    macro last {value} {
      tuple $value at [- [tuple $value length] 1]
    }
  }
  ```

  We can then use `last` just like the predefined `tuple`
  subcommands:

  ```lna
  tuple (a b c) last
  # => c
  ```

