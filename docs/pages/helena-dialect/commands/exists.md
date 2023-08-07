---
source: src\helena-dialect\variables.spec.ts
---
# <a id="exists"></a>`exists`

Test for existence of a constant or variable

## Usage

```lna
exists varname
```

The `exists` command tests wether a constant or variable exists.


## <a id="exists-specifications"></a>Specifications

- ✅ usage
- ✅ should return `true` for an existing variable
- ✅ should return `true` for an existing constant
- ✅ should return `false` for a unknown variable

### <a id="exists-specifications-qualified-names"></a>Qualified names

Passing a qualified name will apply its selectors to the variable
value.

- ✅ indexed selector
- ✅ keyed selector
- ✅ recursive selectors
- ✅ should return `false` for a unknown variable
- ✅ should return `false` when a selector fails

## <a id="exists-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ tuple `varname`

  Name tuples are not supported.


