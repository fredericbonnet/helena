---
source: src\helena-dialect\controls.spec.ts
---
# <a id="loop"></a>`loop`

Generic loop

## Usage

```lna
loop ?index? ?value source ...? body
```

The `loop` command is a generic loop that also supports iterating over
several sources of values simultaneously.


## <a id="loop-specifications"></a>Specifications

- ✅ usage
- ✅ should loop over `body` indefinitely when no source is provided

  In its simplest form, `loop` works like an infinite loop.

- ✅ should return the result of the last command

  This property is useful when the loop is used as an expression. It is
  a common pattern in all Helena control flow commands.


### <a id="loop-specifications-index"></a>`index`

The optional `index` argument, when provided, gives the name of the
`body`-local variable whose value is the current iteration index
starting at zero.

- ✅ should be incremented at each iteration
- ✅ should be local to the `body` scope

### <a id="loop-specifications-value"></a>`value`

The `value` argument of each source gives the name of the
`body`-local variable whose value is the value produced by the
source for the current iteration.

- ✅ should be local to the `body` scope
- ✅ should be defined left-to-right

  If several sources use the same variable name, the last active
  source takes precedence.


## <a id="loop-exceptions"></a>Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ non-script body
- ✅ invalid `index` name

  Index variable name must have a valid string representation.

- ✅ invalid sources

  Only lists, dictionaries, scripts, and commands are acceptable
  sources.


## <a id="loop-sources"></a>Sources

`loop` can iterate over multiple sources of values simultaneously. A
source is anything that can produce a result for each loop iteration.


### <a id="loop-sources-list-sources"></a>List sources

A list source produces its element in order.

- ✅ should iterate over list elements
- ✅ should stop after last element

- value tuples

  - ✅ should be supported

    Tuple destructuring is supported for list source values.

  - ✅ should accept empty tuple

### <a id="loop-sources-dictionary-sources"></a>Dictionary sources

A dictionary source produces its entries as key-value tuples in
unspecified order.

- ✅ should iterate over dictionary entries
- ✅ should stop after last element

- value tuples

  - ✅ should be supported

    Tuple destructuring is supported for dictionary source values.

  - ✅ should accept empty tuple
  - ✅ should accept `(key)` tuple

### <a id="loop-sources-script-sources"></a>Script sources

A script source produces the result of its execution on each
iteration.

- ✅ should iterate over script results
- ✅ should access `index` variable
- ✅ should access `value` variables of previous sources
- ✅ should not access `value` variables of next sources

- value tuples

  - ✅ should be supported

    Tuple destructuring is supported for script source values.

  - ✅ should accept empty tuple

### <a id="loop-sources-command-sources"></a>Command sources

A command source produces the result of its execution on each
iteration. Command sources expect one single argument giving the
current iteration index.


- command name sources

  - ✅ should iterate over command results

  - value tuples

    - ✅ should be supported

      Tuple destructuring is supported for command source values.

    - ✅ should accept empty tuple

- command tuple sources

  - ✅ should iterate over command results

  - value tuples

    - ✅ should be supported

      Tuple destructuring is supported for command source values.

    - ✅ should accept empty tuple

- command value sources

  - ✅ should iterate over command results

  - value tuples

    - ✅ should be supported

      Tuple destructuring is supported for command source values.

    - ✅ should accept empty tuple

## <a id="loop-control-flow"></a>Control flow

The normal return code of a source or body is `OK`. `BREAK` and
`CONTINUE` codes are handled by the command and the others are
propagated to the caller.


- `return`

  - ✅ should interrupt sources with `RETURN` code
  - ✅ should interrupt the loop with `RETURN` code

- `tailcall`

  - ✅ should interrupt sources with `RETURN` code
  - ✅ should interrupt the loop with `RETURN` code

- `yield`

  - ✅ should interrupt sources with `YIELD` code
  - ✅ should interrupt the body with `YIELD` code
  - ✅ should provide a resumable state

- `error`

  - ✅ should interrupt sources with `ERROR` code
  - ✅ should interrupt the loop with `ERROR` code

- `break`

  - ✅ should skip the source for the remaining loop iterations

    Issuing a `BREAK` code is the way a source signals that it has no
    more value to produce. The source variable(s) won't be set until
    the end of the loop, which occurs when no more source is active.
    
    List and dictionary sources will break automatically once they
    reach the end of their data. Scripts and commands need to break
    explicitly.

  - ✅ should interrupt the loop with `nil` result

- `continue`

  - ✅ should skip the source value for the current loop iteration
  - ✅ should interrupt the loop iteration

## <a id="loop-examples"></a>Examples

The versatility of the `loop` command makes it very simple to
emulate features from other languages using higher order
functions.

- ✅ List striding

  Like `loop`, the [Tcl `foreach`
  command](https://www.tcl-lang.org/man/tcl/TclCmd/foreach.htm)
  supports traversal of multiple lists simultaneously. It also
  supports striding over several consecutive elements at once by
  accepting more than one variable name per list, whereas `loop`
  chooses to apply tuple destructuring.
  
  We can emulate that feature with a utility macro returning a
  command source:

  ```lna
  macro stride {(list l) (int w)} {
      idem (
        [[macro {l w i} {
          if {[$i * $w] >= [list $l length]} {break}
          tuple [list $l range [$i * $w] [[[$i + 1] * $w] - 1]]
        }]]
        $l $w
      )
  }
  ```

  The core macro produces a tuple of `$w` consecutive elements of
  `$l` for each iteration `$i`. It expects 3 arguments, but thanks
  to leading tuple auto-expansion we can curry it with its first 2
  parameters into a command tuple expecting a single index
  parameter that can be passed to `loop` as a command source:

  ```lna
  set l [list ()]
  loop (v1 v2 v3) [stride (a b c d e f g h i) 3] {
    set l [list $l append (($v1 $v2 $v3))]
  }
  # => [list ((a b c) (d e f) (g h i))]
  ```

- ✅ Range of integer values

  Python is well-known for its powerful generator pattern and
  notably its [`range()`
  function](https://docs.python.org/3.8/library/stdtypes.html#range).
  
  We can replicate `range` using the same technique as the previous
  `stride` example:

  ```lna
  macro range {(int ?start 0) (int stop) (int ?step 1)} {
    idem (
      [[macro {start stop step i} {
        if {[$start + $step * $i] >= $stop} {break}
        $start + $step * $i
      }]]
      $start $stop $step
    )
  }
  ```

  The `range` macro accepts one to three arguments just like its
  Python counterpart. Optional arguments and type guards keep the
  signature readable and intuitive.

  ```lna
  set l [list ()]
  loop i [range 10] {set l [list $l append ($i)]}
  # => [list (0 1 2 3 4 5 6 7 8 9)]
  ```

  ```lna
  set l [list ()]
  loop i [range 1 5] {set l [list $l append ($i)]}
  # => [list (1 2 3 4)]
  ```

  ```lna
  set l [list ()]
  loop i [range -10 20 5] {set l [list $l append ($i)]}
  # => [list (-10 -5 0 5 10 15)]
  ```

  You can also use options instead of positional arguments if you
  prefer a more explicit syntax:

  ```lna
  macro range {-start (int ?start 0) -stop (int stop) -step (int ?step 1)} {
    idem (
      [[macro {start stop step i} {
        if {[$start + $step * $i] >= $stop} {break}
        $start + $step * $i
      }]]
      $start $stop $step
    )
  }
  ```

  ```lna
  set l [list ()]
  loop i [range -stop 10] {set l [list $l append ($i)]}
  # => [list (0 1 2 3 4 5 6 7 8 9)]
  ```

  ```lna
  set l [list ()]
  loop i [range -start 1 -stop 5] {set l [list $l append ($i)]}
  # => [list (1 2 3 4)]
  ```

  ```lna
  set l [list ()]
  loop i [range -start -10 -stop 20 -step 5] {set l [list $l append ($i)]}
  # => [list (-10 -5 0 5 10 15)]
  ```

  ```lna
  set l [list ()]
  loop i [range -stop 20 -step 5] {set l [list $l append ($i)]}
  # => [list (0 5 10 15)]
  ```

- ✅ List mapping

  The [Javascript
  `Array.map()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map)
  method applies a given function to each element of an array,
  returning a list of results.
  
  We can create a similar `map` procedure using the `loop` command:

  ```lna
  proc map {(list l) cmd} {
    set r [list ()]
    loop v $l {set r [list $r append ([$cmd $v])]}
  }
  ```

  ```lna
  macro square {x} {$x * $x}
  map (1 2 3 4 5) square
  # => [list (1 4 9 16 25)]
  ```

  ```lna
  macro double {x} {$x * 2}
  map (1 2 3 4 5) double
  # => [list (2 4 6 8 10)]
  ```

  Just like `loop`, the `map` procedure also accepts command tuples
  and values:

  ```lna
  map (1 2 3 4 5) (* 10)
  # => [list (10 20 30 40 50)]
  ```

  ```lna
  map (1 2 3 4 5) [[macro {v} {idem val$v}]]
  # => [list (val1 val2 val3 val4 val5)]
  ```

  If you prefer the object syntax, you can also choose to create
  the `map` procedure in the `list` ensemble scope:

  ```lna
  [list] eval {
    proc map {(list l) cmd} {
      set r [list ()]
      loop v $l {set r [list $r append ([$cmd $v])]}
    }
  }
  ```

  And then call it like any regular `list` subcommand:

  ```lna
  list (1 2 3 4 5) map (* 2)
  # => [list (2 4 6 8 10)]
  ```


