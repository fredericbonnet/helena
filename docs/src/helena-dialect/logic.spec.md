---
source: src\helena-dialect\logic.spec.ts
---
# <a id=""></a>Helena logic operations


## <a id="Booleans"></a>Booleans

### Usage

```lna
true ?subcommand?
```
```lna
false ?subcommand?
```

Boolean values (or booleans) are Helena values whose internal type is
`BOOLEAN`.

- ✅ are valid commands

  Boolean `true` and `false` are regular commands.

- ✅ are idempotent

  Argument-less boolean commands return themselves.


### <a id="Booleans_Infix_operators"></a>Infix operators

A boolean followed by an operator can be used for expressions in
infix notation.


#### <a id="Booleans_Infix_operators_Conditional"></a>Conditional


##### <a id="Booleans_Infix_operators_Conditional_"></a>`?`

Conditional operator

```lna
true ? arg ?arg?
```
```lna
false ? arg ?arg?
```

The `?` operator conditionally returns a truthy vs. falsy value.


- `true`

  - ✅ should return first argument
  - ✅ should support a single argument

- `false`

  - ✅ should return nil if no second argument is given
  - ✅ should return second argument

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.


##### <a id="Booleans_Infix_operators_Conditional_"></a>`!?`

Reverse conditional operator

```lna
true !? arg ?arg?
```
```lna
false !? arg ?arg?
```

The `!?` operator conditionally returns a falsy vs. truthy value.
It is the opposite of `?`.


- `true`

  - ✅ should return nil if no second argument is given
  - ✅ should return second argument

- `false`

  - ✅ should return first argument
  - ✅ should support a single argument

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.


### <a id="Booleans_Subcommands"></a>Subcommands

Apart from operators, boolean commands accept the subcommands listed
here.


#### <a id="Booleans_Subcommands_Introspection"></a>Introspection


##### <a id="Booleans_Subcommands_Introspection_subcommands"></a>`subcommands`

```lna
true subcommands
```
```lna
false subcommands
```

This subcommand is useful for introspection and interactive
calls.

- ✅ should return list of subcommands

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.


### <a id="Booleans_Exceptions"></a>Exceptions

- ✅ unknown subcommand
- ✅ invalid subcommand name

## <a id="bool"></a>`bool`

Boolean handling

### Usage

```lna
bool value ?subcommand? ?arg ...?
```

The `bool` command is a type command dedicated to boolean values.

Boolean values are Helena values whose internal type is `BOOLEAN`. The
name `bool` was preferred over `boolean` because it is shorter and is
already used in many other languages like Python and C.


### <a id="bool_Boolean_conversion"></a>Boolean conversion

Like with most type commands, passing a single argument to `bool`
will ensure a boolean value in return. This property means that
`bool` can be used for creation and conversion, but also as a type
guard in argspecs.

- ✅ should return boolean value

- Exceptions

  - ✅ values with no string representation
  - ✅ invalid values

### <a id="bool_Subcommands"></a>Subcommands

The `bool` ensemble comes with a number of predefined subcommands
listed here.


#### <a id="bool_Subcommands_Introspection"></a>Introspection


##### <a id="bool_Subcommands_Introspection_subcommands"></a>`subcommands`

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


#### <a id="bool_Subcommands_Exceptions"></a>Exceptions

- ✅ unknown subcommand
- ✅ invalid subcommand name

### <a id="bool_Ensemble_command"></a>Ensemble command

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


#### <a id="bool_Ensemble_command_Examples"></a>Examples

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


## <a id="Prefix_operators"></a>Prefix operators


### <a id="Prefix_operators_"></a>`!`

Logical NOT operator

```lna
! arg
```


#### <a id="Prefix_operators__Specifications"></a>Specifications

- ✅ usage
- ✅ should invert boolean values
- ✅ should accept script expressions

#### <a id="Prefix_operators__Exceptions"></a>Exceptions

- ✅ wrong arity

  Operators will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid value

  Only booleans and scripts are acceptable values.


#### <a id="Prefix_operators__Control_flow"></a>Control flow

If a script expression returns a result code other than `OK` then
it should be propagated properly to the caller.


- `return`

  - ✅ should interrupt expression with `RETURN` code

- `tailcall`

  - ✅ should interrupt expression with `RETURN` code

- `yield`

  - ✅ should interrupt expression with `YIELD` code
  - ✅ should provide a resumable state

- `error`

  - ✅ should interrupt expression with `ERROR` code

- `break`

  - ✅ should interrupt expression with `BREAK` code

- `continue`

  - ✅ should interrupt expression with `CONTINUE` code

### <a id="Prefix_operators_"></a>`&&`

Logical AND operator

```lna
&& arg ?arg ...?
```


#### <a id="Prefix_operators__Specifications"></a>Specifications

- ✅ usage
- ✅ should accept one boolean
- ✅ should accept two booleans
- ✅ should accept several booleans
- ✅ should accept script expressions
- ✅ should short-circuit on `false`

#### <a id="Prefix_operators__Exceptions"></a>Exceptions

- ✅ wrong arity

  Operators will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid value

  Only booleans and scripts are acceptable values.


#### <a id="Prefix_operators__Control_flow"></a>Control flow

If a script expression returns a result code other than `OK` then
it should be propagated properly to the caller.


- `return`

  - ✅ should interrupt expression with `RETURN` code

- `tailcall`

  - ✅ should interrupt expression with `RETURN` code

- `yield`

  - ✅ should interrupt expression with `YIELD` code
  - ✅ should provide a resumable state

- `error`

  - ✅ should interrupt expression with `ERROR` code

- `break`

  - ✅ should interrupt expression with `BREAK` code

- `continue`

  - ✅ should interrupt expression with `CONTINUE` code

### <a id="Prefix_operators_"></a>`||`

Logical OR operator

#### Usage

```lna
|| arg ?arg ...?
```


#### <a id="Prefix_operators__Specifications"></a>Specifications

- ✅ usage
- ✅ should accept one boolean
- ✅ should accept two booleans
- ✅ should accept several booleans
- ✅ should accept script expressions
- ✅ should short-circuit on `true`

#### <a id="Prefix_operators__Exceptions"></a>Exceptions

- ✅ wrong arity

  Operators will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid value

  Only booleans and scripts are acceptable values.


#### <a id="Prefix_operators__Control_flow"></a>Control flow

If a script expression returns a result code other than `OK` then
it should be propagated properly to the caller.


- `return`

  - ✅ should interrupt expression with `RETURN` code

- `tailcall`

  - ✅ should interrupt expression with `RETURN` code

- `yield`

  - ✅ should interrupt expression with `YIELD` code
  - ✅ should provide a resumable state

- `error`

  - ✅ should interrupt expression with `ERROR` code

- `break`

  - ✅ should interrupt expression with `BREAK` code

- `continue`

  - ✅ should interrupt expression with `CONTINUE` code

