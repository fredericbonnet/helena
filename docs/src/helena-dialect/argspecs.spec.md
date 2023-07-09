---
source: src\helena-dialect\argspecs.spec.ts
---
# Helena argument handling

## `argspec`

Define a argument-parsing command

### Usage

```lna
argspec ?name? specs
```

The `argspec` command defines a new command that will parse a list of
arguments according to a given _argument specification_ (abbreviated
_"argspec"_).

### Specifications

- ✅ usage

- ✅ should define a new command

- ✅ should replace existing commands

- ✅ should return a command object

- ✅ the named command should return its command object

- ✅ the command object should return itself

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `name`

  Command names must have a valid string representation.

### `specs`

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

#### Exceptions

- ✅ empty argument name

- ✅ invalid argument name

- ✅ duplicate arguments

- ✅ empty argument specifier

- ✅ too many specifiers

- ✅ non-optional parameter with guard and default

### Subcommands

- `subcommands`

  - ✅ should return list of subcommands

    This subcommand is useful for introspection and interactive calls.

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when given
      the wrong number of arguments.

- `usage`

  - ✅ should return a usage string with argument names

    This subcommand returns a help string for the argspec command.
    

  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when given
      the wrong number of arguments.

- `set`

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

- Exceptions

  - ✅ unknown subcommand

  - ✅ invalid subcommand name

