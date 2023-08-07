---
source: src\helena-dialect\macros.spec.ts
---
# Helena macros

- [`macro`](../../pages/helena-dialect/commands/macro.md) - Create a macro command
- [Macro commands](#macro-commands)


## <a id="macro-commands"></a>Macro commands

Macro commands are commands that execute a body script in the calling
scope.


### <a id="macro-commands-help"></a>Help

Macros have built-in support for `help` generated from their
argspec.

- ✅ zero
- ✅ one
- ✅ two
- ✅ optional
- ✅ remainder
- ✅ anonymous

### <a id="macro-commands-arguments"></a>Arguments

- ✅ should shadow scope variables
- ✅ should be macro-local

- Exceptions

  - ✅ wrong arity

    The macro will return an error message with usage when given the
    wrong number of arguments.


### <a id="macro-commands-command-calls"></a>Command calls

- ✅ should return nil for empty body
- ✅ should return the result of the last command
- ✅ should access scope variables
- ✅ should set scope variables
- ✅ should access scope commands

- should evaluate in the caller scope

  - ✅ global scope
  - ✅ child scope
  - ✅ scoped macro

### <a id="macro-commands-return-guards"></a>Return guards

Return guards are similar to argspec guards, but apply to the
return value of the macro.

- ✅ should apply to the return value
- ✅ should let body errors pass through
- ✅ should not access macro arguments
- ✅ should evaluate in the caller scope

- Exceptions

  - ✅ empty body specifier
  - ✅ invalid body specifier
  - ✅ non-script body

### <a id="macro-commands-control-flow"></a>Control flow

If the body returns a result code other than `OK` then it should be
propagated properly by the macro to the caller.


- `return`

  - ✅ should interrupt a macro with `RETURN` code

- `tailcall`

  - ✅ should interrupt a macro with `RETURN` code

- `yield`

  - ✅ should interrupt a macro with `YIELD` code
  - ✅ should provide a resumable state
  - ✅ should work recursively

- `error`

  - ✅ should interrupt a macro with `ERROR` code

- `break`

  - ✅ should interrupt a macro with `BREAK` code

- `continue`

  - ✅ should interrupt a macro with `CONTINUE` code

