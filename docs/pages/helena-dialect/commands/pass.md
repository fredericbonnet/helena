---
source: src\helena-dialect\controls.spec.ts
---
# <a id="pass"></a>`pass`

`catch` handler pass-through

## Usage

```lna
pass
```

`pass` is used within `catch` handlers to let the original result pass
through to the caller.


## <a id="pass-specifications"></a>Specifications

- ✅ usage
- ✅ `catch` should return `(pass)` tuple
- ✅ should resume yielded body

- should interrupt `catch` handlers and let original result pass through

  - ✅ `RETURN`
  - ✅ `YIELD`
  - ✅ `ERROR`
  - ✅ `BREAK`
  - ✅ `CATCH`

- should let `catch` `finally` handler execute

  - ✅ `RETURN`
  - ✅ `YIELD`
  - ✅ `ERROR`
  - ✅ `BREAK`
  - ✅ `CONTINUE`

## <a id="pass-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `pass` handler

  `pass` is not a valid `catch` handler.


