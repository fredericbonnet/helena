---
source: src\helena-dialect\variables.spec.ts
---
# <a id="set"></a>`set`

Define or set a variable

## Usage

```lna
set varname value
```

The `set` command defines a new variable or redefines an existing one
by associating a variable name to a value.


## <a id="set-specifications"></a>Specifications

- ✅ usage
- ✅ should set the value of a new variable
- ✅ should redefine the value of an existing variable
- ✅ should return the set value

### <a id="set-specifications-tuple-destructuring"></a>Tuple destructuring

You can set several variables at once by passing name and value
tuples. This also works recursively.

- ✅ should set several variables at once
- ✅ should set duplicate values to their last value
- ✅ should work recursively
- ✅ should support setting a variable to a tuple value
- ✅ should not set variables in case of missing value
- ✅ should not set variables in case of missing subvalue
- ✅ should not set variables in case of bad shape

## <a id="set-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `varname`

  Variable names must have a valid string representation.

- ✅ bad `varname` tuple shape

  The shape of the `varname` tuple must be a subset of the shape of the
  `value` tuple, missing values are not allowed.

- ✅ existing constant

  The command cannot redefine an existing constant.


