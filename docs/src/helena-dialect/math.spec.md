---
source: src\helena-dialect\math.spec.ts
---
# Helena math operations

## Prefix operators

### Arithmetic

Helena supports the standard arithmetic operators in prefix notation.

#### `+`

```lna
+ number ?number ...?
```

- ✅ usage

- ✅ should accept one number

- ✅ should add two numbers

- ✅ should add several numbers

- Exceptions

  - ✅ wrong arity

    The command will return an error message with usage when given
    the wrong number of arguments.

  - ✅ invalid value

#### `-`

```lna
- number ?number ...?
```

- ✅ usage

- ✅ should negate one number

- ✅ should subtract two numbers

- ✅ should subtract several numbers

- Exceptions

  - ✅ wrong arity

    The command will return an error message with usage when given
    the wrong number of arguments.

  - ✅ invalid value

#### `*`

```lna
* number ?number ...?
```

- ✅ usage

- ✅ should accept one number

- ✅ should multiply two numbers

- ✅ should add several numbers

- Exceptions

  - ✅ wrong arity

    The command will return an error message with usage when given
    the wrong number of arguments.

  - ✅ invalid value

#### `/`

```lna
/ number number ?number ...?
```

- ✅ usage

- ✅ should divide two numbers

- ✅ should divide several numbers

- Exceptions

  - ✅ wrong arity

    The command will return an error message with usage when given
    the wrong number of arguments.

  - ✅ invalid value

