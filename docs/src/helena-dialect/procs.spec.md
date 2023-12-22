---
source: src\helena-dialect\procs.spec.ts
---
# Helena procedures

- [`proc`](../../pages/helena-dialect/commands/proc.md) - Create a procedure command
- [Procedure commands](#procedure-commands)


## <a id="procedure-commands"></a>Procedure commands

Procedure commands are commands that execute a body script in their
own child scope.


### <a id="procedure-commands-help"></a>Help

Procedures have built-in support for `help` generated from their
argspec.

- ✅ zero
- ✅ one
- ✅ two
- ✅ optional
- ✅ remainder
- ✅ anonymous

### <a id="procedure-commands-arguments"></a>Arguments

- ✅ should be scope variables

- Exceptions

  - ✅ wrong arity

    The procedure will return an error message with usage when given
    the wrong number of arguments.


### <a id="procedure-commands-command-calls"></a>Command calls

- ✅ should return nil for empty body
- ✅ should return the result of the last command
- ✅ should evaluate in their own scope
- ✅ should evaluate from their parent scope
- ✅ should access external commands
- ✅ should not access external variables
- ✅ should not set external variables
- ✅ local commands should shadow external commands

### <a id="procedure-commands-return-guards"></a>Return guards

Return guards are similar to argspec guards, but apply to the return
value of the procedure.

- ✅ should apply to the return value
- ✅ should let body errors pass through
- ✅ should not access proc arguments
- ✅ should evaluate in the proc parent scope

- Exceptions

  - ✅ empty body specifier
  - ✅ invalid body specifier
  - ✅ non-script body

### <a id="procedure-commands-control-flow"></a>Control flow

The normal return code of a procedure is `OK`. Some codes are handled
within the procedure whereas others are propagated to the caller.


- `return`

  - ✅ should interrupt a proc with `OK` code

- `tailcall`

  - ✅ should interrupt a proc with `OK` code

- `yield`

  - ✅ should interrupt a proc with `YIELD` code
  - ✅ should provide a resumable state
  - ✅ should work recursively

- `error`

  - ✅ should interrupt a proc with `ERROR` code

- `break`

  - ✅ should interrupt a proc with `ERROR` code

- `continue`

  - ✅ should interrupt a proc with `ERROR` code

