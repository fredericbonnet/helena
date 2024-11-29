---
source: src\helena-dialect\modules.spec.ts
---
# <a id="module"></a>`module`

Create a module command

## Usage

```lna
module ?name? body
```

The `module` command creates a new command that will encapsulate an
isolated root scope.


## <a id="module-specifications"></a>Specifications

- ✅ usage
- ✅ should define a new command
- ✅ should replace existing commands
- ✅ should return a module value

## <a id="module-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `name`

  Command names must have a valid string representation.

- ✅ non-script body

## <a id="module-body"></a>`body`

- ✅ should be executed
- ✅ should not access outer commands
- ✅ should not define outer commands
- ✅ should not access outer variables
- ✅ should not set outer variables

### <a id="module-body-control-flow"></a>Control flow

If the body returns a result code other than `OK` then it should be
propagated properly by the command.


- `return`

  - ✅ should interrupt the body with `ERROR` code
  - ✅ should not define the module command

- `tailcall`

  - ✅ should interrupt the body with `ERROR` code
  - ✅ should not define the module command

- `yield`

  - ✅ should interrupt the body with `ERROR` code
  - ✅ should not define the module command

- `error`

  - ✅ should interrupt the body with `ERROR` code
  - ✅ should not define the module command

- `break`

  - ✅ should interrupt the body with `ERROR` code
  - ✅ should not define the module command

- `continue`

  - ✅ should interrupt the body with `ERROR` code
  - ✅ should not define the module command

- `pass`

  - ✅ should interrupt the body with `ERROR` code
  - ✅ should not define the module command

## <a id="module-module-value"></a>Module value

`module` returns a module value that can be passed around and called
by value instead of by name.

### Usage

```lna
<module> ?subcommand? ?arg ...?
```


### <a id="module-module-value-specifications"></a>Specifications

- ✅ usage
- ✅ calling the module value should return itself

