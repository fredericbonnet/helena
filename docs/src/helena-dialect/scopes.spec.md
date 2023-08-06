---
source: src\helena-dialect\scopes.spec.ts
---
# <a id=""></a>Helena scopes


## <a id="scope"></a>`scope`

Create a scope command

### Usage

```lna
scope ?name? body
```

The `scope` command creates a new command that will execute a script in
its own child scope.


### <a id="scope_Specifications"></a>Specifications

- ✅ usage
- ✅ should define a new command
- ✅ should replace existing commands
- ✅ should return a command object
- ✅ the named command should return its command object
- ✅ the command object should return itself

### <a id="scope_Exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `name`

  Command names must have a valid string representation.

- ✅ non-script body

### <a id="scope_body"></a>`body`

- ✅ should be executed
- ✅ should access global commands
- ✅ should not access global variables
- ✅ should not set global variables
- ✅ should set scope variables

#### <a id="scope_body_Control_flow"></a>Control flow

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
  - ✅ should delay the definition of scope command until resumed

- `error`

  - ✅ should interrupt the body with `ERROR` code
  - ✅ should not define the scope command

- `break`

  - ✅ should interrupt the body with `ERROR` code
  - ✅ should not define the scope command

- `continue`

  - ✅ should interrupt the body with `ERROR` code
  - ✅ should not define the scope command

### <a id="scope_Subcommands"></a>Subcommands


- `subcommands`

  - ✅ should return list of subcommands

    This subcommand is useful for introspection and interactive
    calls.


  - Exceptions

    - ✅ wrong arity

      The subcommand will return an error message with usage when
      given the wrong number of arguments.


- `eval`

  - ✅ should evaluate body
  - ✅ should accept tuple bodies
  - ✅ should evaluate macros in scope
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

- `call`

  - ✅ should call scope commands
  - ✅ should evaluate macros in scope
  - ✅ should evaluate closures in scope

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

    - ✅ unknown command
    - ✅ out-of-scope command
    - ✅ invalid command name

- Exceptions

  - ✅ unknown subcommand
  - ✅ invalid subcommand name

