---
source: src\helena-dialect\closures.spec.ts
---
# <a id="closure"></a>`closure`

Create a closure command

## Usage

```lna
closure ?name? argspec body
```

The `closure` command creates a new closure command.


## <a id="closure-specifications"></a>Specifications

- ✅ usage
- ✅ should define a new command
- ✅ should replace existing commands
- ✅ should return a metacommand

## <a id="closure-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `argspec`

  The command expects an argument list in `argspec` format.

- ✅ invalid `name`

  Command names must have a valid string representation.

- ✅ non-script body

## <a id="closure-metacommand"></a>Metacommand

`closure` returns a metacommand value that can be used to introspect
the newly created command.

### Usage

```lna
<metacommand> ?subcommand? ?arg ...?
```


### <a id="closure-metacommand-specifications"></a>Specifications

- ✅ usage
- ✅ the metacommand should return the closure when called with no argument

  The typical application of this property is to call the closure
  by wrapping its metacommand within brackets, e.g.
  `[$metacommand]`.


### <a id="closure-metacommand-examples"></a>Examples

- ✅ Calling closure through its wrapped metacommand

  Here we create a closure and call it through its metacommand:

  ```lna
  set cmd [closure double {val} {* 2 $val}]
  [$cmd] 3
  # => 6
  ```

  This behaves the same as calling the closure directly:

  ```lna
  double 3
  # => 6
  ```


### <a id="closure-metacommand-subcommands"></a>Subcommands


#### <a id="closure-metacommand-subcommands-subcommands"></a>`subcommands`

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


#### <a id="closure-metacommand-subcommands-argspec"></a>`argspec`

```lna
<metacommand> argspec
```

- ✅ should return the closure's argspec

  Each closure has an argspec command associated to it, created
  with the closure's `argspec` argument. This subcommand will
  return it:

  ```lna
  [closure {a b} {}] argspec
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


#### <a id="closure-metacommand-subcommands-exceptions"></a>Exceptions

- ✅ unknown subcommand
- ✅ invalid subcommand name

