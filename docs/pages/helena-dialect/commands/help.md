---
source: src\helena-dialect\basic-commands.spec.ts
---
# `help`

Give usage of a command

## Usage

```lna
help command ?arg ...?
```

The `help` command returns a help string for the given command.

## Specifications

- ✅ should give usage of itself

- ✅ should accept optional arguments

  Passing extra arguments will validate the command signature.

- ✅ should return the command help

## Exceptions

- ✅ wrong arity

  The command will return an error message with usage when given the
  wrong number of arguments.

- ✅ invalid `command`

  The `command` argument must either be a command value or have a valid
  string representation.

- ✅ unknown command

  The command cannot get help for a non-existing command.

- ✅ command with no help

  The command cannot get help for a command that has none.

