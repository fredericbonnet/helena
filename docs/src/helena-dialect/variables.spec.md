---
source: src\helena-dialect\variables.spec.ts
---
# <a id=""></a>Helena constants and variables


## <a id="let"></a>`let`

Define a constant

### Usage

```lna
let constname value
```

The `let` command defines a new constant by associating a variable name
to a constant value.


### <a id="let_Specifications"></a>Specifications

- ✅ usage
- ✅ should define the value of a new constant
- ✅ should return the constant value

#### <a id="let_Specifications_Tuple_destructuring"></a>Tuple destructuring

You can define several constants at once by passing name and value
tuples. This also works recursively.

- ✅ should define several constants at once
- ✅ should work recursively
- ✅ should support setting a constant to a tuple value
- ✅ should not define constants in case of missing value
- ✅ should not define constants in case of missing subvalue
- ✅ should not define constants in case of bad shape

### <a id="let_Exceptions"></a>Exceptions

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


## <a id="set"></a>`set`

Define or set a variable

### Usage

```lna
set varname value
```

The `set` command defines a new variable or redefines an existing one
by associating a variable name to a value.


### <a id="set_Specifications"></a>Specifications

- ✅ usage
- ✅ should set the value of a new variable
- ✅ should redefine the value of an existing variable
- ✅ should return the set value

#### <a id="set_Specifications_Tuple_destructuring"></a>Tuple destructuring

You can set several variables at once by passing name and value
tuples. This also works recursively.

- ✅ should set several variables at once
- ✅ should work recursively
- ✅ should support setting a variable to a tuple value
- ✅ should not set variables in case of missing value
- ✅ should not set variables in case of missing subvalue
- ✅ should not set variables in case of bad shape

### <a id="set_Exceptions"></a>Exceptions

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


## <a id="get"></a>`get`

Get a constant or variable value

### Usage

```lna
get varname ?default?
```

The `get` command gets the value of an existing constant or variable.


### <a id="get_Specifications"></a>Specifications

- ✅ usage
- ✅ should return the value of an existing variable
- ✅ should return the value of an existing constant
- ✅ should return the default value for a unknown variable

#### <a id="get_Specifications_Qualified_names"></a>Qualified names

Passing a qualified name will apply its selectors to the variable
value.

- ✅ indexed selector
- ✅ keyed selector
- ✅ should work recursively
- ✅ should return the default value when a selector fails

#### <a id="get_Specifications_Tuple_destructuring"></a>Tuple destructuring

You can get several variables at once by passing a name tuple. This
also works recursively.

- ✅ should get several variables at once
- ✅ should work recursively
- ✅ should support qualified names

### <a id="get_Exceptions"></a>Exceptions

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


## <a id="exists"></a>`exists`

Test for existence of a variable

### Usage

```lna
exists varname
```

The `exists` command tests wether a variable or constant exists.


### <a id="exists_Specifications"></a>Specifications

- ✅ usage
- ✅ should return `true` for an existing variable
- ✅ should return `true` for an existing constant
- ✅ should return `false` for a unknown variable

#### <a id="exists_Specifications_Qualified_names"></a>Qualified names

Passing a qualified name will apply its selectors to the variable
value.

- ✅ indexed selector
- ✅ keyed selector
- ✅ recursive selectors
- ✅ should return `false` for a unknown variable
- ✅ should return `false` when a selector fails

### <a id="exists_Exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ tuple `varname`

  Name tuples are not supported.


## <a id="unset"></a>`unset`

Undefine a variable

### Usage

```lna
unset varname
```

The `unset` command undefines an existing variable.


### <a id="unset_Specifications"></a>Specifications

- ✅ usage
- ✅ should unset an existing variable
- ✅ should return nil

#### <a id="unset_Specifications_Tuples"></a>Tuples

You can unset several variables at once by passing a name tuple.
This also works recursively.

- ✅ should unset several variables at once
- ✅ should work recursively
- ✅ should not unset variables in case the name tuple contains unknown variables
- ✅ should not unset variables in case the name tuple contains qualified names
- ✅ should not unset variables in case the name tuple contains invalid variables

### <a id="unset_Exceptions"></a>Exceptions

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


