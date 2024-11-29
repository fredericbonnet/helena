---
source: src\helena-dialect\procs.spec.ts
---
# <a id="proc"></a>`proc`

Create a procedure command

## Usage

```lna
proc ?name? argspec body
```

The `proc` command creates a new procedure command. The name `proc` was
preferred over `procedure` because it is shorter and is already used in
Tcl.


## <a id="proc-specifications"></a>Specifications

- ✅ usage
- ✅ should define a new command
- ✅ should replace existing commands
- ✅ should return a metacommand

## <a id="proc-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `argspec`

  The command expects an argument list in `argspec` format.

- ✅ invalid `name`

  Command names must have a valid string representation.

- ✅ non-script body

## <a id="proc-metacommand"></a>Metacommand

`proc` returns a metacommand value that can be used to introspect
the newly created command.

### Usage

```lna
<metacommand> ?subcommand? ?arg ...?
```


### <a id="proc-metacommand-specifications"></a>Specifications

- ✅ usage
- ✅ the metacommand should return the procedure when called with no argument

  The typical application of this property is to call the procedure
  by wrapping its metacommand within brackets, e.g.
  `[$metacommand]`.


### <a id="proc-metacommand-examples"></a>Examples

- ✅ Calling procedure through its wrapped metacommand

  Here we create a procedure and call it through its metacommand:

  ```lna
  set cmd [proc double {val} {* 2 $val}]
  [$cmd] 3
  # => 6
  ```

  This behaves the same as calling the procedure directly:

  ```lna
  double 3
  # => 6
  ```


### <a id="proc-metacommand-subcommands"></a>Subcommands


#### <a id="proc-metacommand-subcommands-subcommands"></a>`subcommands`

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


#### <a id="proc-metacommand-subcommands-argspec"></a>`argspec`

```lna
<metacommand> argspec
```

- ✅ should return the procedure's argspec

  Each procedure has an argspec command associated to it,
  created with the procedure's `argspec` argument. This
  subcommand will return it:

  ```lna
  [proc {a b} {}] argspec
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


#### <a id="proc-metacommand-subcommands-exceptions"></a>Exceptions

- ✅ unknown subcommand
- ✅ invalid subcommand name

