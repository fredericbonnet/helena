---
source: src\helena-dialect\basic-commands.spec.ts
---
# <a id="idem"></a>`idem`

Return the value that is passed to it

## Usage

```lna
idem value
```

The `idem` command returns the value that is passed to it. _Idem_ is a
latin term meaning "the same".


## <a id="idem-specifications"></a>Specifications

- ✅ usage
- ✅ should return its `value` argument

## <a id="idem-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.


