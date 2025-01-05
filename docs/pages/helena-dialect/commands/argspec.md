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
      - ✅ two

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
      - ✅ unexpected result

        Dynamic defaults should return `OK` codes.


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

    - Exceptions

      - ✅ unexpected result

        Guards should return either `OK` or `ERROR` codes.

      - ✅ wrong arity

        Guards should take a single argument.


### <a id="argspec-argument-specifications-exceptions"></a>Exceptions

- ✅ empty argument name
- ✅ invalid argument name
- ✅ duplicate arguments
- ✅ empty argument specifier
- ✅ too many specifiers
- ✅ non-optional parameter with guard and default

## <a id="argspec-option-specifications"></a>Option specifications

Arguments can be preceded by an option specification. Option names
start with a dash character `-`.


- Required options

  - ✅ value
  - ✅ usage

  - set

    - ✅ one
    - ✅ two
    - ✅ out of order
    - ✅ prefix
    - ✅ suffix
    - ✅ infix
    - ✅ complex case

- Optional options

  - ✅ value
  - ✅ usage

  - set

    - ✅ zero
    - ✅ default
    - ✅ one
    - ✅ two

### <a id="argspec-option-specifications-flags"></a>Flags

Flags are optional boolean options that take no value.

- ✅ value
- ✅ usage

- set

  - ✅ zero
  - ✅ one
  - ✅ two

- Exceptions

  - ✅ non-optional argument

    Flag arguments must be optional


- Exceptions

  - ✅ missing argument

    Options must be followed by an argument.

  - ✅ incompatible aliases
  - ✅ duplicate options
  - ✅ remainder before options
  - ✅ option terminator

## <a id="argspec-evaluation-order"></a>Evaluation order

Argument values are evaluated left-to-right and in order of priority:

- Required arguments
- Optional arguments
- Remainder

If there are neither optional nor remainder arguments then the number
of provided argument values must match the number of required
arguments. Else it must be at least equal to the number of required
arguments.

If there is no remainder argument then the number of extra argument
values must not exceed the number of optional arguments. Else the
the remainder argument is set to the remaining values.

Consecutive arguments are grouped depending on whether they have an
option specification. There can be any number of groups of alternate
kinds.

Opionless arguments are positional and must be provided in the same
order as they are specified.

Options can be provided in any order within the same group of
consecutive options.

In both cases, optional argument values are set in the order they are
provided.

- ✅ required positionals only

  The number of values must match the number of required arguments.
  Values are provided in order.

- ✅ required options only

  The number of values must match the number of required options.
  Values can be provided out-of-order.

- ✅ required and optional options

  The number of values must be at least the number of required options,
  and at most the total number of options. Values can be provided
  out-of-order. All required options must be provided.

- ✅ required positional and option groups

  The number of values must match the number of required options.
  Within the same group, positional values are provided in order
  whereas options can be provided out-of-order. Options cannot be
  provided outside of their group.

- ✅ optional arguments

  Optional argument values are set left-to-right:
  - Positionals are set in the order they are specified
  - Options can be set in any order and can be omitted

- ✅ remainder argument

  Remainder argument values are always set after all required and
  optional arguments have been set. This can bring unexpected results.

- ✅ option terminator

  Option terminators `--` will end option groups as long as all
  required options have been set. They are ignored when checking arity.

- ✅ complex case

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
- ✅ should return list of subcommands

  Note that subcommands are returned in no special order.


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
argspec value set values
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


