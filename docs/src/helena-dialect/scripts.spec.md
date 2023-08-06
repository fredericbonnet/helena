---
source: src\helena-dialect\scripts.spec.ts
---
# <a id=""></a>Helena scripts


## <a id="parse"></a>`parse`

Helena script parsing

### Usage

```lna
parse source
```

The `parse` command is used to parse script source strings into script
values.

Script values are Helena values whose internal type is `SCRIPT`.


### <a id="parse_Specifications"></a>Specifications

- ✅ should return a script value
- ✅ should return parsed script and source
- ✅ should parse blocks as string values

### <a id="parse_Exceptions"></a>Exceptions

- ✅ wrong arity

  The subcommand will return an error message with usage when given the
  wrong number of arguments.

- ✅ parsing error
- ✅ values with no string representation

## <a id="script"></a>`script`

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

### <a id="script_Script_creation_and_conversion"></a>Script creation and conversion

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

### <a id="script_Subcommands"></a>Subcommands

The `script` ensemble comes with a number of predefined subcommands
listed here.


#### <a id="script_Subcommands_Introspection"></a>Introspection


##### <a id="script_Subcommands_Introspection_subcommands"></a>`subcommands`

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


#### <a id="script_Subcommands_Accessors"></a>Accessors


##### <a id="script_Subcommands_Accessors_length"></a>`length`

Get script length

```lna
script value length
```

- ✅ should return the number of sentences

- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.


#### <a id="script_Subcommands_Operations"></a>Operations


##### <a id="script_Subcommands_Operations_append"></a>`append`

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

##### <a id="script_Subcommands_Operations_split"></a>`split`

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


#### <a id="script_Subcommands_Exceptions"></a>Exceptions

- ✅ unknown subcommand
- ✅ invalid subcommand name

### <a id="script_Examples"></a>Examples

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


### <a id="script_Ensemble_command"></a>Ensemble command

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


#### <a id="script_Ensemble_command_Examples"></a>Examples

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


