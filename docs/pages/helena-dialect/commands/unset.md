---
source: src\helena-dialect\variables.spec.ts
---
# <a id="unset"></a>`unset`

Undefine a variable

## Usage

```lna
unset varname
```

The `unset` command undefines an existing variable.


## <a id="unset-specifications"></a>Specifications

- ✅ usage
- ✅ should unset an existing variable
- ✅ should return nil

### <a id="unset-specifications-tuples"></a>Tuples

You can unset several variables at once by passing a name tuple.
This also works recursively.

- ✅ should unset several variables at once
- ✅ should work recursively
- ✅ should not unset variables in case the name tuple contains unknown variables
- ✅ should not unset variables in case the name tuple contains qualified names
- ✅ should not unset variables in case the name tuple contains invalid variables

## <a id="unset-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `varname`

  Variable names must have a valid string representation.

- ✅ qualified `varname`

  The command cannot undefine a value selected from a qualified name.

- ✅ existing constant

  The command cannot undefine a constant.

- ✅ unknown variable

  The command cannot undefine an unknown variable.


