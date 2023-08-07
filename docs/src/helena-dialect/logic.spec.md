---
source: src\helena-dialect\logic.spec.ts
---
# Helena logic operations

- [Booleans](#booleans)
- [`bool`](../../pages/helena-dialect/commands/bool.md) - Boolean handling
- [Prefix operators](#prefix-operators)


## <a id="booleans"></a>Booleans

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


### <a id="booleans-infix-operators"></a>Infix operators

A boolean followed by an operator can be used for expressions in
infix notation.


#### <a id="booleans-infix-operators-conditional"></a>Conditional


##### <a id="booleans-infix-operators-conditional-"></a>`?`

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


##### <a id="booleans-infix-operators-conditional-"></a>`!?`

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


### <a id="booleans-subcommands"></a>Subcommands

Apart from operators, boolean commands accept the subcommands listed
here.


#### <a id="booleans-subcommands-introspection"></a>Introspection


##### <a id="booleans-subcommands-introspection-subcommands"></a>`subcommands`

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


### <a id="booleans-exceptions"></a>Exceptions

- ✅ unknown subcommand
- ✅ invalid subcommand name

## <a id="prefix-operators"></a>Prefix operators


### <a id="prefix-operators-"></a>`!`

Logical NOT operator

```lna
! arg
```


#### <a id="prefix-operators--specifications"></a>Specifications

- ✅ usage
- ✅ should invert boolean values
- ✅ should accept script expressions

#### <a id="prefix-operators--exceptions"></a>Exceptions

- ✅ wrong arity

  Operators will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid value

  Only booleans and scripts are acceptable values.


#### <a id="prefix-operators--control-flow"></a>Control flow

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

### <a id="prefix-operators-"></a>`&&`

Logical AND operator

```lna
&& arg ?arg ...?
```


#### <a id="prefix-operators--specifications"></a>Specifications

- ✅ usage
- ✅ should accept one boolean
- ✅ should accept two booleans
- ✅ should accept several booleans
- ✅ should accept script expressions
- ✅ should short-circuit on `false`

#### <a id="prefix-operators--exceptions"></a>Exceptions

- ✅ wrong arity

  Operators will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid value

  Only booleans and scripts are acceptable values.


#### <a id="prefix-operators--control-flow"></a>Control flow

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

### <a id="prefix-operators-"></a>`||`

Logical OR operator

#### Usage

```lna
|| arg ?arg ...?
```


#### <a id="prefix-operators--specifications"></a>Specifications

- ✅ usage
- ✅ should accept one boolean
- ✅ should accept two booleans
- ✅ should accept several booleans
- ✅ should accept script expressions
- ✅ should short-circuit on `true`

#### <a id="prefix-operators--exceptions"></a>Exceptions

- ✅ wrong arity

  Operators will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid value

  Only booleans and scripts are acceptable values.


#### <a id="prefix-operators--control-flow"></a>Control flow

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

