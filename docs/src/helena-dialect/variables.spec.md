---
source: src\helena-dialect\variables.spec.ts
---
# Helena constants and variables

## `let`

Define a constant

### Usage

```lna
let constname value
```

The `let` command defines a new constant by associating a variable name
to a constant value.

### Specifications

- ✅ usage

- ✅ should define the value of a new constant

- ✅ should return the constant value

#### Tuple destructuring

You can define several constants at once by passing name and value
tuples. This also works recursively.

- ✅ should define several constants at once

- ✅ should work recursively

- ✅ should support setting a constant to a tuple value

- ✅ should not define constants in case of missing value

- ✅ should not define constants in case of missing subvalue

- ✅ should not define constants in case of bad shape

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ existing constant

  The command cannot redefine an existing constant.

- ✅ existing variable

  The command cannot redefine an existing variable.

- ✅ bad tuple shape

  The shape of the name tuple must be a subset of the shape of the
  value tuple, missing values are not allowed.

- ✅ invalid constant name

  Constant names must have a valid string representation.

## `set`

Define or set a variable

### Usage

```lna
set varname value
```

The `set` command defines a new variable or redefines an existing one
by associating a variable name to a value.

### Specifications

- ✅ usage

- ✅ should set the value of a new variable

- ✅ should redefine the value of an existing variable

- ✅ should return the set value

#### Tuple destructuring

You can set several variables at once by passing name and value
tuples. This also works recursively.

- ✅ should set several variables at once

- ✅ should work recursively

- ✅ should support setting a variable to a tuple value

- ✅ should not set variables in case of missing value

- ✅ should not set variables in case of missing subvalue

- ✅ should not set variables in case of bad shape

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ existing constant

  The command cannot redefine an existing constant.

- ✅ bad tuple shape

  The shape of the name tuple must be a subset of the shape of the
  value tuple, missing values are not allowed.

- ✅ invalid variable name

  Variable names must have a valid string representation.

## `get`

Get a constant or variable value

### Usage

```lna
get varname ?default?
```

The `get` command gets the value of an existing constant or variable.

### Specifications

- ✅ usage

- ✅ should return the value of an existing variable

- ✅ should return the value of an existing constant

- ✅ should return the default value for a unknown variable

#### Qualified names

Passing a qualified name will apply its selectors to the variable
value.

- ✅ indexed selector

- ✅ keyed selector

- ✅ should work recursively

- ✅ should return the default value when a selector fails

#### Tuple destructuring

You can get several variables at once by passing a name tuple. This
also works recursively.

- ✅ should get several variables at once

- ✅ should work recursively

- ✅ should support qualified names

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ unknown variable

  The command will return an error when getting an unknown variable
  without passing a default value.

- ✅ bad selector

  The command will return an error when a qualified name selector fails
  and no default value is provided.

- ✅ name tuples with default

  Default values are not supported with name tuples.

## `exists`

Test for existence of a variable

### Usage

```lna
exists varname
```

The `exists` command tests wether a variable or constant exists.

### Specifications

- ✅ usage

- ✅ should return `true` for an existing variable

- ✅ should return `true` for an existing constant

- ✅ should return `false` for a unknown variable

#### Qualified names

Passing a qualified name will apply its selectors to the variable
value.

- ✅ indexed selector

- ✅ keyed selector

- ✅ recursive selectors

- ✅ should return `false` for a unknown variable

- ✅ should return `false` when a selector fails

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ name tuples

  Name tuples are not supported.

## `unset`

Undefine a variable

### Usage

```lna
unset varname
```

The `unset` command undefines an existing variable.

### Specifications

- ✅ usage

- ✅ should unset an existing variable

- ✅ should return nil

#### Tuples

You can unset several variables at once by passing a name tuple.
This also works recursively.

- ✅ should unset several variables at once

- ✅ should work recursively

- ✅ should not unset variables in case the name tuple contains unknown variables

- ✅ should not unset variables in case the name tuple contains qualified names

- ✅ should not unset variables in case the name tuple contains invalid variables

### Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ existing constant

  The command cannot undefine a constant.

- ✅ unknown variable

  The command cannot undefine an unknown variable.

- ✅ qualified name

  The command cannot undefine a value selected from a qualified name.

- ✅ invalid variable name

  Variable names must have a valid string representation.

