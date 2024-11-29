---
source: src\helena-dialect\macros.spec.ts
---
# <a id="macro"></a>`macro`

Create a macro command

## Usage

```lna
macro ?name? argspec body
```

The `macro` command creates a new macro command.


## <a id="macro-specifications"></a>Specifications

- ✅ usage
- ✅ should define a new command
- ✅ should replace existing commands
- ✅ should return a metacommand

## <a id="macro-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `argspec`

  The command expects an argument list in `argspec` format.

- ✅ invalid `name`

  Command names must have a valid string representation.

- ✅ non-script body

## <a id="macro-metacommand"></a>Metacommand

`macro` returns a metacommand value that can be used to introspect
the newly created command.

### Usage

```lna
<metacommand> ?subcommand? ?arg ...?
```


### <a id="macro-metacommand-specifications"></a>Specifications

- ✅ usage
- ✅ the metacommand should return the macro when called with no argument

  The typical application of this property is to call the macro by
  wrapping its metacommand within brackets, e.g. `[$metacommand]`.


### <a id="macro-metacommand-examples"></a>Examples

- ✅ Calling macro through its wrapped metacommand

  Here we create a macro and call it through its metacommand:

  ```lna
  set cmd [macro double {val} {* 2 $val}]
  [$cmd] 3
  # => 6
  ```

  This behaves the same as calling the macro directly:

  ```lna
  double 3
  # => 6
  ```


### <a id="macro-metacommand-subcommands"></a>Subcommands


#### <a id="macro-metacommand-subcommands-subcommands"></a>`subcommands`

```lna
<metacommand> subcommands
```

- ✅ should return list of subcommands

  This subcommand is useful for introspection and interactive
  calls.


- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.


#### <a id="macro-metacommand-subcommands-argspec"></a>`argspec`

```lna
<metacommand> argspec
```

- ✅ should return the macro's argspec

  Each macro has an argspec command associated to it, created
  with the macro's `argspec` argument. This subcommand will
  return it:

  ```lna
  [macro {a b} {}] argspec
  # => {#{argspec: "a b"}#}
  ```

  This is identical to:

  ```lna
  argspec {a b}
  ```


- Exceptions

  - ✅ wrong arity

    The subcommand will return an error message with usage when
    given the wrong number of arguments.


#### <a id="macro-metacommand-subcommands-exceptions"></a>Exceptions

- ✅ unknown subcommand
- ✅ invalid subcommand name

