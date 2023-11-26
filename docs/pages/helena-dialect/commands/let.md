---
source: src\helena-dialect\variables.spec.ts
---
# <a id="let"></a>`let`

Define a constant

## Usage

```lna
let constname value
```

The `let` command defines a new constant by associating a variable name
to a constant value.


## <a id="let-specifications"></a>Specifications

- ✅ usage
- ✅ should define the value of a new constant
- ✅ should return the constant value

### <a id="let-specifications-tuple-destructuring"></a>Tuple destructuring

You can define several constants at once by passing name and value
tuples. This also works recursively.

- ✅ should define several constants at once
- ✅ should set duplicate constants to their last value
- ✅ should work recursively
- ✅ should support setting a constant to a tuple value
- ✅ should not define constants in case of missing value
- ✅ should not define constants in case of missing subvalue
- ✅ should not define constants in case of bad shape

## <a id="let-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `constname`

  Constant names must have a valid string representation.

- ✅ bad `constname` tuple shape

  The shape of the name tuple must be a subset of the shape of the
  value tuple, missing values are not allowed.

- ✅ existing constant

  The command cannot redefine an existing constant.

- ✅ existing variable

  The command cannot redefine an existing variable.


