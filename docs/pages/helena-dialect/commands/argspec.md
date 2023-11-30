---
source: src\helena-dialect\argspecs.spec.ts
---
# <a id="argspec"></a>`argspec`

Argspec handling

## Usage

```lna
argspec value ?subcommand? ?arg ...?
```

The `argspec` command is a type command dedicated to argspec values
(short for _argument specification_). It provides an ensemble of
subcommands for argspec creation, conversion, access, and operations.

Argspec values are custom Helena values.


## <a id="argspec-argspec-creation-and-conversion"></a>Argspec creation and conversion

Like with most type commands, passing a single argument to `argspec`
will ensure a argspec value in return. This property means that
`argspec` can be used for creation and conversion, but also as a type
guard in argspecs.

- ✅ should return argspec value
- ✅ should convert blocks to argspecs

  The most common syntax for argspec creation is to simply pass a
  block of arguments; the block is evaluated in an empty scope and
  each resulting word is added as an argspec argument in order.

  ```lna
  argspec {a b c}
  # => {#{argspec: "a b c"}#}
  ```

- ✅ should convert tuples to argspecs

  Tuples are also accepted.

  ```lna
  argspec (a b c)
  ```

- ✅ should convert lists to argspecs

  Lists are also accepted.

  ```lna
  argspec [list {a b c}]
  # => {#{argspec: "a b c"}#}
  ```


- Exceptions

  - ✅ invalid values

    Only blocks, tuples, and lists are acceptable values.

  - ✅ blocks with side effects

    Providing a block with side effects like substitutions or
    expressions will result in an error.


## <a id="argspec-argument-specifications"></a>Argument specifications


- empty

  - ✅ value
  - ✅ usage
  - ✅ set

- one parameter

  - ✅ value
  - ✅ usage
  - ✅ set

- two parameters

  - ✅ value
  - ✅ usage
  - ✅ set

- remainder

  - ✅ cannot be used more than once

  - anonymous

    - ✅ value
    - ✅ usage

    - set

      - ✅ zero
      - ✅ one
      - ✅ two

  - named

    - ✅ value
    - ✅ usage

    - set

      - ✅ zero
      - ✅ one
      - ✅ two

  - prefix

    - ✅ one
    - ✅ two
    - ✅ three

  - infix

    - ✅ two
    - ✅ three
    - ✅ four

  - suffix

    - ✅ one
    - ✅ two
    - ✅ three

- optional parameter


  - single

    - ✅ value
    - ✅ usage

    - set

      - ✅ zero
      - ✅ one

  - multiple

    - ✅ value
    - ✅ usage

    - set

      - ✅ zero
      - ✅ one
      - ✅ one two

  - prefix

    - ✅ one
    - ✅ two

  - infix

    - ✅ two
    - ✅ three

  - suffix

    - ✅ one
    - ✅ two

- default parameter

  - ✅ value
  - ✅ usage

  - set


    - static

      - ✅ zero
      - ✅ one

    - dynamic

      - ✅ zero
      - ✅ one

- guard

  - ✅ required parameter
  - ✅ optional parameter
  - ✅ default parameter
  - ✅ usage

  - set


    - simple command

      - ✅ required
      - ✅ optional
      - ✅ default

    - tuple prefix

      - ✅ required
      - ✅ optional
      - ✅ default

### <a id="argspec-argument-specifications-exceptions"></a>Exceptions

- ✅ empty argument name
- ✅ invalid argument name
- ✅ duplicate arguments
- ✅ empty argument specifier
- ✅ too many specifiers
- ✅ non-optional parameter with guard and default

## <a id="argspec-subcommands"></a>Subcommands

The `argspec` ensemble comes with a number of predefined subcommands
listed here.


### <a id="argspec-subcommands-subcommands"></a>`subcommands`

```lna
argspec value subcommands
```

This subcommand is useful for introspection and interactive
calls.

- ✅ usage
- ✅ should return argspec of subcommands

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.


### <a id="argspec-subcommands-usage"></a>`usage`

```lna
argspec value usage
```

Get a help string

- ✅ should return a usage string with argument names

  This subcommand returns a help string for the argspec command.
  


- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when given
    the wrong number of arguments.


### <a id="argspec-subcommands-set"></a>`set`

```lna
argspec value usage
```

Set parameter variables from a list of argument values

- ✅ should return nil
- ✅ should set argument variables in the caller scope
- ✅ should enforce minimum number of arguments
- ✅ should enforce maximum number of arguments
- ✅ should set required attributes first
- ✅ should skip missing optional attributes
- ✅ should set optional attributes in order
- ✅ should set remainder after optional attributes
- ✅ should set all present attributes in order

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when given
    the wrong number of arguments.


### <a id="argspec-subcommands-exceptions"></a>Exceptions

- ✅ unknown subcommand
- ✅ invalid subcommand name

## <a id="argspec-examples"></a>Examples

- ✅ Currying and encapsulation

  Thanks to leading tuple auto-expansion, it is very simple to
  bundle the `argspec` command and a value into a tuple to create a
  pseudo-object value. For example:

  ```lna
  set l (argspec {a b ?c *})
  ```

  We can then use this variable like a regular command. Calling it
  without argument will return the wrapped value:

  ```lna
  $l
  # => {#{argspec: "a b ?c? ?arg ...?"}#}
  ```

  Subcommands then behave like object methods:

  ```lna
  $l usage
  # => "a b ?c? ?arg ...?"
  ```

  ```lna
  $l set (val1 val2 val3); get (a b c)
  # => (val1 val2 val3)
  ```

- ✅ Argument type guard

  Calling `argspec` with a single argument returns its value as a
  argspec. This property allows `argspec` to be used as a type
  guard for argspecs.
  
  Here we create a macro `usage` that returns the usage of the
  provided argspec. Using `argspec` as guard has three effects:
  
  - it validates the argument on the caller side
  - it converts the value at most once
  - it ensures type safety within the body
  
  Note how using `argspec` as a guard for argument `a` makes it
  look like a static type declaration:

  ```lna
  macro usage ( (argspec a) ) {argspec $a usage}
  ```

  Passing a valid value will give the expected result:

  ```lna
  usage {a b ?c *}
  # => "a b ?c? ?arg ...?"
  ```

  Passing an invalid value will produce an error:

  ```lna
  usage invalidValue
  # => [error "invalid argument list"]
  ```


## <a id="argspec-ensemble-command"></a>Ensemble command

`argspec` is an ensemble command, which means that it is a collection
of subcommands defined in an ensemble scope.

- ✅ should return its ensemble metacommand when called with no argument

  The typical application of this property is to access the ensemble
  metacommand by wrapping the command within brackets, i.e.
  `[argspec]`.

- ✅ should be extensible

  Creating a command in the `argspec` ensemble scope will add it to its
  subcommands.

- ✅ should support help for custom subcommands

  Like all ensemble commands, `argspec` have built-in support for
  `help` on all subcommands that support it.


### <a id="argspec-ensemble-command-examples"></a>Examples

- ✅ Adding a `help` subcommand

  Here we create a `help` alias to the existing `usage` within
  the `argspec` ensemble, returning the `usage` with a prefix
  string:

  ```lna
  [argspec] eval {
    macro help {value prefix} {
      idem "$prefix [argspec $value usage]"
    }
  }
  ```

  We can then use `help` just like the predefined `argspec`
  subcommands:

  ```lna
  argspec {a b ?c *} help foo
  # => "foo a b ?c? ?arg ...?"
  ```


