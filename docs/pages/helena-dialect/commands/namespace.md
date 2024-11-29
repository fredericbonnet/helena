---
source: src\helena-dialect\namespaces.spec.ts
---
# <a id="namespace"></a>`namespace`

Create a namespace command

## Usage

```lna
namespace ?name? body
```

The `namespace` command creates a new namespace command.


## <a id="namespace-specifications"></a>Specifications

- ✅ usage
- ✅ should define a new command
- ✅ should replace existing commands
- ✅ should return a metacommand

## <a id="namespace-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `name`

  Command names must have a valid string representation.

- ✅ non-script body

## <a id="namespace-body"></a>`body`

- ✅ should be executed
- ✅ should access global commands
- ✅ should not access global variables
- ✅ should not set global variables
- ✅ should set namespace variables

### <a id="namespace-body-control-flow"></a>Control flow

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
  - ✅ should delay the definition of namespace command until resumed

- `error`

  - ✅ should interrupt the body with `ERROR` code
  - ✅ should not define the namespace command

- `break`

  - ✅ should interrupt the body with `ERROR` code
  - ✅ should not define the namespace command

- `continue`

  - ✅ should interrupt the body with `ERROR` code
  - ✅ should not define the namespace command

## <a id="namespace-metacommand"></a>Metacommand

`namespace` returns a metacommand value that can be used to
introspect the newly created command.

### Usage

```lna
<metacommand> ?subcommand? ?arg ...?
```


### <a id="namespace-metacommand-specifications"></a>Specifications

- ✅ usage
- ✅ the metacommand should return itself

### <a id="namespace-metacommand-subcommands"></a>Subcommands


#### <a id="namespace-metacommand-subcommands-subcommands"></a>`subcommands`

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


#### <a id="namespace-metacommand-subcommands-eval"></a>`eval`

```lna
<metacommand> eval body
```

- ✅ should evaluate body in namespace scope
- ✅ should accept tuple bodies
- ✅ should evaluate macros in namespace scope
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

#### <a id="namespace-metacommand-subcommands-call"></a>`call`

```lna
<metacommand> call cmdname ?arg ...?
```

- ✅ should call namespace commands
- ✅ should evaluate macros in namespace
- ✅ should evaluate namespace closures in namespace

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

#### <a id="namespace-metacommand-subcommands-import"></a>`import`

```lna
<metacommand> import name ?alias?
```

- ✅ should declare imported commands in the calling scope
- ✅ should return nil
- ✅ should replace existing commands
- ✅ should evaluate macros in the caller scope
- ✅ should evaluate closures in their scope
- ✅ should resolve imported commands at call time
- ✅ should accept an optional alias name

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.

  - ✅ unresolved command
  - ✅ invalid import name
  - ✅ invalid alias name

#### <a id="namespace-metacommand-subcommands-exceptions"></a>Exceptions

- ✅ unknown subcommand
- ✅ invalid subcommand name

