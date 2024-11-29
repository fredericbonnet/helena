---
source: src\helena-dialect\ensembles.spec.ts
---
# <a id="ensemble"></a>`ensemble`

Create an ensemble command

## Usage

```lna
ensemble ?name? argspec body
```

The `ensemble` command creates a new ensemble command.


## <a id="ensemble-specifications"></a>Specifications

- ✅ usage
- ✅ should define a new command
- ✅ should replace existing commands
- ✅ should return a metacommand

## <a id="ensemble-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `argspec`

  The command expects an argument list in `argspec` format.

- ✅ variadic arguments

  Ensemble argument lists are fixed-length; optional or remainder
  arguments are forbidden.

- ✅ invalid `name`

  Command names must have a valid string representation.

- ✅ non-script body

## <a id="ensemble-body"></a>`body`

- ✅ should be executed
- ✅ should access global commands
- ✅ should not access global variables
- ✅ should not set global variables
- ✅ should set ensemble variables

### <a id="ensemble-body-control-flow"></a>Control flow

If the body returns a result code other than `OK` then it should be
propagated properly by the command.


- `return`

  - ✅ should interrupt the body with `OK` code
  - ✅ should still define the named command
  - ✅ should return passed value instead of the command object

- `tailcall`

  - ✅ should interrupt the body with `OK` code
  - ✅ should still define the named command
  - ✅ should return passed value instead of the command object

- `yield`

  - ✅ should interrupt the body with `YIELD` code
  - ✅ should provide a resumable state
  - ✅ should delay the definition of ensemble command until resumed

- `error`

  - ✅ should interrupt the body with `ERROR` code
  - ✅ should not define the ensemble command

- `break`

  - ✅ should interrupt the body with `ERROR` code
  - ✅ should not define the ensemble command

- `continue`

  - ✅ should interrupt the body with `ERROR` code
  - ✅ should not define the ensemble command

## <a id="ensemble-metacommand"></a>Metacommand

`ensemble` returns a metacommand value that can be used to introspect
the newly created command.

### Usage

```lna
<metacommand> ?subcommand? ?arg ...?
```


### <a id="ensemble-metacommand-specifications"></a>Specifications

- ✅ usage
- ✅ the metacommand should return itself

### <a id="ensemble-metacommand-subcommands"></a>Subcommands


#### <a id="ensemble-metacommand-subcommands-subcommands"></a>`subcommands`

```lna
<metacommand> subcommands
```

- ✅ should return list of subcommands

  This subcommand is useful for introspection and interactive
  calls.


- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.


#### <a id="ensemble-metacommand-subcommands-eval"></a>`eval`

```lna
<metacommand> eval body
```

- ✅ should evaluate body in ensemble scope
- ✅ should accept tuple bodies
- ✅ should evaluate macros in ensemble scope
- ✅ should evaluate closures in their scope

- Control flow


  - `return`

    - ✅ should interrupt the body with `RETURN` code

  - `tailcall`

    - ✅ should interrupt the body with `RETURN` code

  - `yield`

    - ✅ should interrupt the body with `YIELD` code
    - ✅ should provide a resumable state

  - `error`

    - ✅ should interrupt the body with `ERROR` code

  - `break`

    - ✅ should interrupt the body with `BREAK` code

  - `continue`

    - ✅ should interrupt the body with `CONTINUE` code

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.

  - ✅ invalid body

#### <a id="ensemble-metacommand-subcommands-call"></a>`call`

```lna
<metacommand> call cmdname ?arg ...?
```

- ✅ should call ensemble commands
- ✅ should evaluate macros in the caller scope
- ✅ should evaluate ensemble closures in ensemble scope

- Control flow


  - `return`

    - ✅ should interrupt the body with `RETURN` code

  - `tailcall`

    - ✅ should interrupt the body with `RETURN` code

  - `yield`

    - ✅ should interrupt the call with `YIELD` code
    - ✅ should provide a resumable state

  - `error`

    - ✅ should interrupt the body with `ERROR` code

  - `break`

    - ✅ should interrupt the body with `BREAK` code

  - `continue`

    - ✅ should interrupt the body with `CONTINUE` code

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.

  - ✅ unknown command
  - ✅ out-of-scope command
  - ✅ invalid command name

#### <a id="ensemble-metacommand-subcommands-argspec"></a>`argspec`

```lna
<metacommand> argspec
```

- ✅ should return the ensemble's argspec

  Each ensemble has an argspec command associated to it,
  created with the ensemble's `argspec` argument. This
  subcommand will return it:

  ```lna
  [ensemble {a b} {}] argspec
  # => {#{argspec: "a b"}#}
  ```

  This is identical to:

  ```lna
  argspec {a b}
  ```


- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.


#### <a id="ensemble-metacommand-subcommands-exceptions"></a>Exceptions

- ✅ unknown subcommand
- ✅ invalid subcommand name

