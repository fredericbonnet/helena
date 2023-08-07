---
source: src\helena-dialect\closures.spec.ts
---
# Helena closures

- [`closure`](../../pages/helena-dialect/commands/closure.md) - Create a closure command
- [Closure commands](#closure-commands)


## <a id="closure-commands"></a>Closure commands

Closure commands are commands that execute a body script in the scope
where they are created.


### <a id="closure-commands-help"></a>Help

Closures have built-in support for `help` generated from their
argspec.

- ✅ zero
- ✅ one
- ✅ two
- ✅ optional
- ✅ remainder
- ✅ anonymous

### <a id="closure-commands-arguments"></a>Arguments

- ✅ should shadow scope variables
- ✅ should be closure-local

- Exceptions

  - ✅ wrong arity

    The closure will return an error message with usage when given the
    wrong number of arguments.


### <a id="closure-commands-command-calls"></a>Command calls

- ✅ should return nil for empty body
- ✅ should return the result of the last command

- should evaluate in the closure parent scope

  - ✅ global scope
  - ✅ child scope
  - ✅ scoped closure

### <a id="closure-commands-return-guards"></a>Return guards

Return guards are similar to argspec guards, but apply to the return
value of the closure.

- ✅ should apply to the return value
- ✅ should let body errors pass through
- ✅ should not access closure arguments
- ✅ should evaluate in the closure parent scope

- Exceptions

  - ✅ empty body specifier
  - ✅ invalid body specifier
  - ✅ non-script body

### <a id="closure-commands-control-flow"></a>Control flow

If the body returns a result code other than `OK` then it should be
propagated properly by the closure to the caller.


- `return`

  - ✅ should interrupt a closure with `RETURN` code

- `tailcall`

  - ✅ should interrupt a closure with `RETURN` code

- `yield`

  - ✅ should interrupt a closure with `YIELD` code
  - ✅ should provide a resumable state
  - ✅ should work recursively

- `error`

  - ✅ should interrupt a closure with `ERROR` code

- `break`

  - ✅ should interrupt a closure with `BREAK` code

- `continue`

  - ✅ should interrupt a closure with `CONTINUE` code

