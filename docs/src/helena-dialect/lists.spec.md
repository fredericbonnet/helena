---
source: src\helena-dialect\lists.spec.ts
---
# Helena lists

## `list`

List handling

### Usage

```lna
list ?value? ?subcommand? ?arg ...?
```

The `list` command is a type command dedicated to list values. It
provides an ensemble of subcommands for list creation, conversion,
access, and operations.

List values are Helena values whose internal type is `LIST`.

### List creation and conversion

Like with most type commands, passing a single argument to `list`
will ensure a list value in return. This property means that `list`
can be used for creation and conversion, but also as a type guard in
argspecs.

- ✅ should return list value

- ✅ should convert tuples to lists

  The most common syntax for list creation is to simply pass a tuple
  of elements.

  ```lna
  list (a b c)
  # => [list (a b c)]
  ```

- ✅ should convert blocks to lists

  Blocks are also accepted; the block is evaluated in an empty scope
  and each resulting word is added to the list in order.

  ```lna
  list {a b c}
  # => [list (a b c)]
  ```

- Exceptions

  - ✅ invalid values

    Only lists, tuples, and blocks are acceptable values.

  - ✅ blocks with side effects

    Providing a block with side effects like substitutions or
    expressions will result in an error.

### Subcommands

The `list` ensemble comes with a number of predefined subcommands
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

  - ✅ should return the list length

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

- `at`

  - ✅ should return the element at the given index

  - ✅ should return the default value for an out-of-range index

  - ✅ `at` <-> indexed selector equivalence

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

    - ✅ invalid index

    - ✅ index out of range

#### List operations

- `range`

  - ✅ should return the list included within [first, last]

  - ✅ should return the remainder of the list when given first only

  - ✅ should truncate out of range boundaries

  - ✅ should return an empty list when last is before first

  - ✅ should return an empty list when first is past the list length

  - ✅ should return an empty list when last is negative

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

  - ✅ should do nothing when first is past the list length

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

    - ✅ invalid index

- `append`

  - ✅ should append two lists

  - ✅ should accept several lists

  - ✅ should accept zero list

  - Exceptions

    - ✅ invalid values

- `insert`

  - ✅ should insert the list at the given index

  - ✅ should prepend the list when index is negative

  - ✅ should append the list when index is past the list length

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

    - ✅ invalid index

    - ✅ invalid values

- `replace`

  - ✅ should replace the range included within [first, last] with the given list

  - ✅ should truncate out of range boundaries

  - ✅ should insert the list at first index when last is before first

  - ✅ should prepend the list when last is negative

  - ✅ should append the list when first is past the list length

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

    - ✅ invalid index

    - ✅ invalid values

#### Iteration

- `foreach`

  - ✅ should iterate over elements

  - ✅ should return the result of the last command

  - Control flow

    - `return`

      - ✅ should interrupt the loop with `RETURN` code

    - `tailcall`

      - ✅ should interrupt the loop with `RETURN` code

    - `yield`

      - ✅ should interrupt the body with `YIELD` code

      - ✅ should provide a resumable state

    - `error`

      - ✅ should interrupt the loop with `ERROR` code

    - `break`

      - ✅ should interrupt the body with nil result

    - `continue`

      - ✅ should interrupt the body iteration

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

    - ✅ non-script body

#### Exceptions

- ✅ unknown subcommand

- ✅ invalid subcommand name

### Examples

- ✅ Currying and encapsulation

  Thanks to leading tuple auto-expansion, it is very simple to
  bundle the `list` command and a value into a tuple to create a
  pseudo-object value. For example:

  ```lna
  set l (list (a b c d e f g))
  ```

  We can then use this variable like a regular command. Calling it
  without argument will return the wrapped value:

  ```lna
  $l
  # => [list (a b c d e f g)]
  ```

  Subcommands then behave like object methods:

  ```lna
  $l length
  # => 7
  ```

  ```lna
  $l at 2
  # => c
  ```

  ```lna
  $l range 3 5
  # => [list (d e f)]
  ```

- ✅ Argument type guard

  Calling `list` with a single argument returns its value as a
  list. This property allows `list` to be used as a type guard for
  argspecs.
  
  Here we create a macro `len` that returns the length of the
  provided list. Using `list` as guard has three effects:
  
  - it validates the argument on the caller side
  - it converts the value at most once
  - it ensures type safety within the body
  
  Note how using `list` as a guard for argument `l` makes it look
  like a static type declaration:

  ```lna
  macro len ( (list l) ) {list $l length}
  ```

  Passing a valid value will give the expected result:

  ```lna
  len (1 2 3 4)
  # => 4
  ```

  Passing an invalid value will produce an error:

  ```lna
  len invalidValue
  # => [error "invalid list"]
  ```

### Ensemble command

`list` is an ensemble command, which means that it is a collection of
subcommands defined in an ensemble scope.

- ✅ should return its ensemble metacommand

  The typical application of this property is to access the ensemble
  metacommand by wrapping the command within brackets, i.e. `[list]`.

- ✅ should be extensible

  Creating a command in the `list` ensemble scope will add it to its
  subcommands.

#### Examples

- ✅ Adding a `last` subcommand

  Here we create a `last` macro within the `list` ensemble scope,
  returning the last element of the provided list value:

  ```lna
  [list] eval {
    macro last {value} {
      list $value at [- [list $value length] 1]
    }
  }
  ```

  We can then use `last` just like the predefined `list`
  subcommands:

  ```lna
  list (a b c) last
  # => c
  ```

- ✅ Using `foreach` to implement a `includes` subcommand

  Faithful to its minimalist philosophy, Helena only provides
  basic subcommands that can serve as building blocks to
  implement other subcommands. Here we add a `includes` predicate
  that tests whether a given value is present in a list,
  leveraging the built-in `foreach` subcommand to iterate over
  the list elements:

  ```lna
  [list] eval {
    proc includes {haystack needle} {
      list $haystack foreach element {
        if [string $needle == $element] {return [true]}
      }
      return [false]
    }
  }
  ```

  (Note how we are free to name subcommand arguments however we
  want)
  
  We can then use `includes` just like the predefined `list`
  subcommands:

  ```lna
  list (a b c) includes b
  # => true
  ```

  ```lna
  list (a b c) includes d
  # => false
  ```

## `displayListValue`

Display function for lists

- ✅ should display lists as `list` command + tuple values

- ✅ should produce an isomorphic string

  Evaluating the string will produce an identical list value.

