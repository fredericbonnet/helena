---
source: src\helena-dialect\scripts.spec.ts
---
# Helena scripts

## `parse`

Helena script parsing

### Usage

```lna
parse source
```

The `parse` command is used to parse script source strings into script
values.

Script values are Helena values whose internal type is `SCRIPT`.

### Specifications

- ✅ should return a script value

- ✅ should return parsed script and source

- ✅ should parse blocks as string values

### Exceptions

- ✅ wrong arity

  The subcommand will return an error message with usage when given the
  wrong number of arguments.

- ✅ parsing error

- ✅ values with no string representation

## `script`

Script handling

### Usage

```lna
script value ?subcommand? ?arg ...?
```

The `script` command is a type command dedicated to script values. It
provides an ensemble of subcommands for script creation, conversion,
access, and operations.

Script values are Helena values whose internal type is `SCRIPT`.

- ✅ should be extensible

### Script creation and conversion

Like with most type commands, passing a single argument to `script` will
ensure a script value in return. This property means that `script` can be
used for creation and conversion, but also as a type guard in argspecs.

- ✅ should return script value

- ✅ should accept blocks

- tuples

  - ✅ should be converted to scripts

  - ✅ string value should be undefined

  - ✅ empty tuples should return empty scripts

  - ✅ non-empty tuples should return single-sentence scripts

### Subcommands

The `script` ensemble comes with a number of predefined subcommands
listed here.

#### Introspection

##### `subcommands`

```lna
script value subcommands
```

This subcommand is useful for introspection and interactive
calls.

- ✅ usage

- ✅ should return list of subcommands

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.

#### Accessors

##### `length`

Get script length

```lna
script value length
```

- ✅ should return the number of sentences

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.

#### Operations

##### `append`

Concatenate scripts

```lna
script value append ?script ...?
```

- ✅ usage

- ✅ should append two scripts

- ✅ should accept several scripts

- ✅ should accept both scripts and tuples scripts

- ✅ should accept zero scripts

- Exceptions

  - ✅ invalid values

##### `split`

Split scripts into sentences

```lna
script value split
```

- ✅ usage

- ✅ should split script sentences into list of scripts

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.

#### Exceptions

- ✅ unknown subcommand

- ✅ invalid subcommand name

### Examples

- ✅ Currying and encapsulation

  Thanks to leading tuple auto-expansion, it is very simple to
  bundle the `script` command and a value into a tuple to create a
  pseudo-object value. For example:

  ```lna
  set s (script {a b c; d e; f})
  ```

  We can then use this variable like a regular command. Calling it
  without argument will return the wrapped value:

  ```lna
  $s
  # => {a b c; d e; f}
  ```

  Subcommands then behave like object methods:

  ```lna
  $s length
  # => 3
  ```

- ✅ Argument type guard

  Calling `script` with a single argument returns its value as a
  script. This property allows `script` to be used as a type guard
  for argspecs.
  
  Here we create a macro `len` that returns the length of the
  provided script. Using `script` as guard has three effects:
  
  - it validates the argument on the caller side
  - it converts the value at most once
  - it ensures type safety within the body
  
  Note how using `script` as a guard for argument `s` makes it look
  like a static type declaration:

  ```lna
  macro len ( (script s) ) {script $s length}
  ```

  Passing a valid value will give the expected result:

  ```lna
  len {a b c; d e; f}
  # => 3
  ```

  Passing an invalid value will produce an error:

  ```lna
  len invalidValue
  # => [error "value must be a script or tuple"]
  ```

### Ensemble command

`script` is an ensemble command, which means that it is a collection
of subcommands defined in an ensemble scope.

- ✅ should return its ensemble metacommand when called with no argument

  The typical application of this property is to access the ensemble
  metacommand by wrapping the command within brackets, i.e. `[script]`.

- ✅ should be extensible

  Creating a command in the `script` ensemble scope will add it to its
  subcommands.

- ✅ should support help for custom subcommands

  Like all ensemble commands, `script` have built-in support for `help`
  on all subcommands that support it.

#### Examples

- ✅ Adding a `last` subcommand

  Here we create a `last` macro within the `script` ensemble scope,
  returning the last sentence of the provided script value:

  ```lna
  [script] eval {
    macro last {value} {
      list [script $value split] at [- [script $value length] 1]
    }
  }
  ```

  We can then use `last` just like the predefined `script`
  subcommands:

  ```lna
  script {a b c; d e; f} last
  ```

