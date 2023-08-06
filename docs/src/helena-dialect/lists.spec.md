---
source: src\helena-dialect\lists.spec.ts
---
# <a id=""></a>Helena lists


## <a id="list"></a>`list`

List handling

### Usage

```lna
list value ?subcommand? ?arg ...?
```

The `list` command is a type command dedicated to list values. It
provides an ensemble of subcommands for list creation, conversion,
access, and operations.

List values are Helena values whose internal type is `LIST`.


### <a id="list_List_creation_and_conversion"></a>List creation and conversion

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


### <a id="list_Subcommands"></a>Subcommands

The `list` ensemble comes with a number of predefined subcommands
listed here.


#### <a id="list_Subcommands_Introspection"></a>Introspection


##### <a id="list_Subcommands_Introspection_subcommands"></a>`subcommands`

```lna
list value subcommands
```

This subcommand is useful for introspection and interactive
calls.

- ✅ usage
- ✅ should return list of subcommands

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.


#### <a id="list_Subcommands_Accessors"></a>Accessors


##### <a id="list_Subcommands_Accessors_length"></a>`length`

Get list length

```lna
list value length
```

- ✅ usage
- ✅ should return the list length

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.


##### <a id="list_Subcommands_Accessors_at"></a>`at`

Get list element

```lna
list value at index ?default?
```

- ✅ usage
- ✅ should return the element at `index`
- ✅ should return the default value for an out-of-range `index`
- ✅ `at` <-> indexed selector equivalence

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.

  - ✅ invalid `index`
  - ✅ `index` out of range

#### <a id="list_Subcommands_Operations"></a>Operations


##### <a id="list_Subcommands_Operations_range"></a>`range`

Extract range of elements from a list

```lna
list value range first ?last?
```

- ✅ usage
- ✅ should return the list included within [`first`, `last`]
- ✅ should return the remainder of the list when given `first` only
- ✅ should truncate out of range boundaries
- ✅ should return an empty list when `last` is before `first`
- ✅ should return an empty list when `first` is past the list length
- ✅ should return an empty list when `last` is negative

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.

  - ✅ invalid index

##### <a id="list_Subcommands_Operations_remove"></a>`remove`

Remove range of elements from a list

```lna
list value remove first last
```

- ✅ usage
- ✅ should remove the range included within [`first`, `last`]
- ✅ should truncate out of range boundaries
- ✅ should do nothing when `last` is before `first`
- ✅ should do nothing when `last` is negative
- ✅ should do nothing when `first` is past the list length

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.

  - ✅ invalid index

##### <a id="list_Subcommands_Operations_append"></a>`append`

Concatenate lists

```lna
list value append ?list ...?
```

- ✅ usage
- ✅ should append two lists
- ✅ should accept several lists
- ✅ should accept zero list

- Exceptions

  - ✅ invalid list values

##### <a id="list_Subcommands_Operations_insert"></a>`insert`

Insert list elements into a list

```lna
list value insert index value2
```

- ✅ usage
- ✅ should insert `list` at `index`
- ✅ should prepend `list` when `index` is negative
- ✅ should append `list` when `index` is past the target list length

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.

  - ✅ invalid `index`
  - ✅ invalid `list`

##### <a id="list_Subcommands_Operations_replace"></a>`replace`

Replace range of elements in a list

```lna
list value replace first last value2
```

- ✅ usage
- ✅ should replace the range included within [`first`, `last`] with `list`
- ✅ should truncate out of range boundaries
- ✅ should insert `list` at `first` when `last` is before `first`
- ✅ should prepend `list` when `last` is negative
- ✅ should append `list` when `first` is past the target list length

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.

  - ✅ invalid index
  - ✅ invalid `list`

#### <a id="list_Subcommands_Iteration"></a>Iteration


##### <a id="list_Subcommands_Iteration_foreach"></a>`foreach`

Iterate over list elements

```lna
list value foreach element body
```

- ✅ usage
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

#### <a id="list_Subcommands_Exceptions"></a>Exceptions

- ✅ unknown subcommand
- ✅ invalid subcommand name

### <a id="list_Examples"></a>Examples

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


### <a id="list_Ensemble_command"></a>Ensemble command

`list` is an ensemble command, which means that it is a collection of
subcommands defined in an ensemble scope.

- ✅ should return its ensemble metacommand when called with no argument

  The typical application of this property is to access the ensemble
  metacommand by wrapping the command within brackets, i.e. `[list]`.

- ✅ should be extensible

  Creating a command in the `list` ensemble scope will add it to its
  subcommands.

- ✅ should support help for custom subcommands

  Like all ensemble commands, `list` have built-in support for `help`
  on all subcommands that support it.


#### <a id="list_Ensemble_command_Examples"></a>Examples

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


## <a id="displayListValue"></a>`displayListValue`

Display function for lists

- ✅ should display lists as `list` command + tuple values
- ✅ should produce an isomorphic string

  Evaluating the string will produce an identical list value.


