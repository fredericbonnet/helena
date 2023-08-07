---
source: src\helena-dialect\dicts.spec.ts
---
# <a id="dict"></a>`dict`

Dictionary handling

## Usage

```lna
dict value ?subcommand? ?arg ...?
```

The `dict` command is a type command dedicated to dictionary values. It
provides an ensemble of subcommands for dictionary creation,
conversion, access, and operations.

Dictionary values are Helena values whose internal type is
`DICTIONARY`. The name `dict` was preferred over `dictionary` because
it is shorter and is already used in other languages like Tcl and
Python.


## <a id="dict-dictionary-creation-and-conversion"></a>Dictionary creation and conversion

Like with most type commands, passing a single argument to `dict`
will ensure a dictionary value in return. This property means that
`dict` can be used for creation and conversion, but also as a type
guard in argspecs.

- ✅ should return dictionary value
- ✅ should convert key-value tuples to dictionaries

  The most common syntax for dictionary creation is to simply pass a
  tuple of key-value elements.

  ```lna
  dict (a b c d)
  # => [dict (a b c d)]
  ```

- ✅ should convert key-value blocks to dictionaries

  Blocks are also accepted; the block is evaluated in an empty scope
  and the resulting key-value tuple is used for creation.

  ```lna
  dict {a b c d}
  # => [dict (a b c d)]
  ```

- ✅ should convert key-value lists to dictionaries

  Key-value lists are also accepted.

  ```lna
  dict [list (a b c d)]
  # => [dict (a b c d)]
  ```

- ✅ should convert non-string keys to strings

  Dictionaries only support string keys internally; any value having a
  valid string representation can be used as key.

- ✅ should preserve values

  Contrary to keys, values are preserved with no conversion.


- Exceptions

  - ✅ invalid lists

    Only lists, tuples, and blocks are acceptable values.

  - ✅ invalid keys

    Keys must have a string representation.

  - ✅ odd lists

    Key-value lists are expected, hence lists must have an even length.

  - ✅ blocks with side effects

    Providing a block with side effects like substitutions or
    expressions will result in an error.


## <a id="dict-subcommands"></a>Subcommands

The `dict` ensemble comes with a number of predefined subcommands
listed here.


### <a id="dict-subcommands-introspection"></a>Introspection


#### <a id="dict-subcommands-introspection-subcommands"></a>`subcommands`

```lna
dict value subcommands
```

This subcommand is useful for introspection and interactive
calls.

- ✅ usage
- ✅ should return list of subcommands

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.


### <a id="dict-subcommands-accessors"></a>Accessors


#### <a id="dict-subcommands-accessors-size"></a>`size`

Get dictionary size

```lna
dict value size
```

- ✅ usage
- ✅ should return the dictionary size

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.


#### <a id="dict-subcommands-accessors-has"></a>`has`

Test for dictionary key existence

```lna
dict value has key
```

- ✅ usage
- ✅ should test for `key` existence

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.

  - ✅ invalid `key`

#### <a id="dict-subcommands-accessors-get"></a>`get`

Get dictionary value

```lna
dict value get key ?default?
```

- ✅ usage
- ✅ should return the value at `key`
- ✅ should return the default value for a non-existing key
- ✅ should support key tuples
- ✅ `get` <-> keyed selector equivalence

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.

  - ✅ unknow key
  - ✅ invalid key
  - ✅ key tuples with default

#### <a id="dict-subcommands-accessors-keys"></a>`keys`

Get dictionary keys

```lna
dict value keys
```

- ✅ usage
- ✅ should return the list of keys

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.


#### <a id="dict-subcommands-accessors-values"></a>`values`

Get dictionary values

```lna
dict value values
```

- ✅ usage
- ✅ should return the list of values

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.


#### <a id="dict-subcommands-accessors-entries"></a>`entries`

Get dictionary entries

```lna
dict value entries
```

- ✅ usage
- ✅ should return the list of key-value tuples

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.


### <a id="dict-subcommands-operations"></a>Operations

Add entry to dictionary

```lna
dict value add key value
```

- ✅ usage

- `add`

  - ✅ should add `value` for a new `key`
  - ✅ should replace the value for an existing `key`

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.

    - ✅ invalid key

#### <a id="dict-subcommands-operations-remove"></a>`remove`

Remove entry from dictionary

```lna
dict value remove ?key ...?
```

- ✅ usage
- ✅ should remove the provided `key`
- ✅ should accept several keys to remove
- ✅ should ignore unknown keys
- ✅ should accept zero key

- Exceptions

  - ✅ invalid `key`

#### <a id="dict-subcommands-operations-merge"></a>`merge`

Merge dictionaries

```lna
dict value merge ?dict ...?
```

- ✅ usage
- ✅ should merge two dictionaries
- ✅ should accept several dictionaries
- ✅ should accept zero dictionary

- Exceptions

  - ✅ invalid dictionary values

### <a id="dict-subcommands-iteration"></a>Iteration


#### <a id="dict-subcommands-iteration-foreach"></a>`foreach`

Iterate over dictionary elements

```lna
dict value foreach entry body
```

- ✅ usage
- ✅ should iterate over entries
- ✅ should return the result of the last command

- entry parameter tuples

  - ✅ should be supported
  - ✅ should accept empty tuple
  - ✅ should accept `(key)` tuple
  - ✅ should ignore extra elements

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

### <a id="dict-subcommands-exceptions"></a>Exceptions

- ✅ unknown subcommand
- ✅ invalid subcommand name

## <a id="dict-examples"></a>Examples

- ✅ Currying and encapsulation

  Thanks to leading tuple auto-expansion, it is very simple to
  bundle the `dict` command and a value into a tuple to create a
  pseudo-object value. For example:

  ```lna
  set d (dict (a b c d))
  ```

  We can then use this variable like a regular command. Calling it
  without argument will return the wrapped value:

  ```lna
  $d
  # => [dict (a b c d)]
  ```

  Subcommands then behave like object methods:

  ```lna
  $d size
  # => 2
  ```

  ```lna
  $d get a
  # => b
  ```

  ```lna
  $d entries
  # => [list ((a b) (c d))]
  ```

- ✅ Argument type guard

  Calling `dict` with a single argument returns its value as a
  dictionary. This property allows `dict` to be used as a type
  guard for argspecs.
  
  Here we create a macro `len` that returns twice the size of the
  provided dictionary (accounting for key + value pairs). Using
  `dict` as guard has three effects:
  
  - it validates the argument on the caller side
  - it converts the value at most once
  - it ensures type safety within the body
  
  Note how using `dict` as a guard for argument `d` makes it look
  like a static type declaration:

  ```lna
  macro len ( (dict d) ) {[dict $d size] * 2}
  ```

  Passing a valid value will give the expected result:

  ```lna
  len (1 2 3 4)
  # => 4
  ```

  Passing an invalid value will produce an error:

  ```lna
  len invalidValue
  # => [error "invalid dictionary"]
  ```


## <a id="dict-ensemble-command"></a>Ensemble command

`list` is an ensemble command, which means that it is a collection of
subcommands defined in an ensemble scope.

- ✅ should return its ensemble metacommand when called with no argument

  The typical application of this property is to access the ensemble
  metacommand by wrapping the command within brackets, i.e. `[dict]`.

- ✅ should be extensible

  Creating a command in the `dict` ensemble scope will add it to its
  subcommands.

- ✅ should support help for custom subcommands

  Like all ensemble commands, `dict` have built-in support for `help`
  on all subcommands that support it.


### <a id="dict-ensemble-command-examples"></a>Examples

- ✅ Adding a `+` operator

  Here we create a `+` binary macro that merges two dictionaries
  together:

  ```lna
  [dict] eval {
    macro + {d1 d2} {dict $d1 merge $d2}
  }
  ```

  (Note how we are free to name subcommand arguments however we
  want)
  
  We can then use `+` as an infix merge operator:

  ```lna
  dict (a b c d) + (a e f g)
  # => [dict (a e c d f g)]
  ```


