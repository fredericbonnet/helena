---
source: src\helena-dialect\variables.spec.ts
---
# <a id="get"></a>`get`

Get a constant or variable value

## Usage

```lna
get varname ?default?
```

The `get` command gets the value of an existing constant or variable.


## <a id="get-specifications"></a>Specifications

- ✅ usage
- ✅ should return the value of an existing variable
- ✅ should return the value of an existing constant
- ✅ should return the default value for a unknown variable

### <a id="get-specifications-qualified-names"></a>Qualified names

Passing a qualified name will apply its selectors to the variable
value.

- ✅ indexed selector
- ✅ keyed selector
- ✅ should work recursively
- ✅ should return the default value when a selector fails

### <a id="get-specifications-tuple-destructuring"></a>Tuple destructuring

You can get several variables at once by passing a name tuple. This
also works recursively.

- ✅ should get several variables at once
- ✅ should work recursively
- ✅ should support qualified names

## <a id="get-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ tuple `varname` with default

  Default values are not supported with name tuples.

- ✅ unknown variable

  The command will return an error when getting an unknown variable
  without passing a default value.

- ✅ bad selector

  The command will return an error when a qualified name selector fails
  and no default value is provided.


