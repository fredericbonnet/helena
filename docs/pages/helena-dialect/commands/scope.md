---
source: src\helena-dialect\scopes.spec.ts
---
# <a id="scope"></a>`scope`

Create a scope command

## Usage

```lna
scope ?name? body
```

The `scope` command creates a new command that will encapsulate a child
scope.


## <a id="scope-specifications"></a>Specifications

- ✅ usage
- ✅ should define a new command
- ✅ should replace existing commands
- ✅ should return a scope value

## <a id="scope-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `name`

  Command names must have a valid string representation.

- ✅ non-script body

## <a id="scope-body"></a>`body`

- ✅ should be executed
- ✅ should access global commands
- ✅ should not access global variables
- ✅ should not set global variables
- ✅ should set scope variables

### <a id="scope-body-control-flow"></a>Control flow

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

## <a id="scope-scope-value"></a>Scope value

`scope` returns a scope value that can be passed around and called by
value instead of by name.

### Usage

```lna
<scope> ?subcommand? ?arg ...?
```


### <a id="scope-scope-value-specifications"></a>Specifications

- ✅ usage
- ✅ calling the scope value should return itself

