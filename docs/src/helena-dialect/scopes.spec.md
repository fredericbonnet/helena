---
source: src\helena-dialect\scopes.spec.ts
---
# Helena scopes

- [`scope`](../../pages/helena-dialect/commands/scope.md) - Create a scope command
- [Scope commands](#scope-commands)


## <a id="scope-commands"></a>Scope commands

Scope commands are commands that encapsulate a child scope.


### <a id="scope-commands-specifications"></a>Specifications

- ✅ usage
- ✅ should return its scope value when called with no argument

  The typical application of this property is to pass around or call
  the scope command by value.


### <a id="scope-commands-subcommands"></a>Subcommands


#### <a id="scope-commands-subcommands-subcommands"></a>`subcommands`

```lna
<scope> subcommands
```

- ✅ should return list of subcommands

  This subcommand is useful for introspection and interactive
  calls.


- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.


#### <a id="scope-commands-subcommands-eval"></a>`eval`

```lna
<scope> eval body
```

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

#### <a id="scope-commands-subcommands-call"></a>`call`

```lna
<scope> call cmdname ?arg ...?
```

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

#### <a id="scope-commands-subcommands-exceptions"></a>Exceptions

- ✅ unknown subcommand
- ✅ invalid subcommand name

