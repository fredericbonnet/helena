/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, ResultCode, OK, ERROR } from "../core/results";
import { Command } from "../core/commands";
import {
  CommandValue,
  STR,
  ScriptValue,
  StringValue,
  TupleValue,
  Value,
  ValueType,
} from "../core/values";
import { ArgspecValue } from "./argspecs";
import { ARITY_ERROR } from "./arguments";
import { ContinuationValue, Scope } from "./core";
import { Subcommands } from "./subcommands";

class MacroMetacommand implements Command {
  readonly value: Value;
  readonly macro: MacroCommand;
  constructor(macro: MacroCommand) {
    this.value = new CommandValue(this);
    this.macro = macro;
  }

  static readonly subcommands = new Subcommands(["subcommands", "argspec"]);
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.macro.value);
    return MacroMetacommand.subcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length != 2) return ARITY_ERROR("<metacommand> subcommands");
        return OK(MacroMetacommand.subcommands.list);
      },
      argspec: () => {
        if (args.length != 2) return ARITY_ERROR("<metacommand> argspec");
        return OK(this.macro.argspec);
      },
    });
  }
  help(args: Value[]): Result {
    if (args.length == 1)
      return OK(STR("<metacommand> ?subcommand? ?arg ...?"));
    return MacroMetacommand.subcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length > 2) return ARITY_ERROR("<metacommand> subcommands");
        return OK(STR("<metacommand> subcommands"));
      },
      argspec: () => {
        if (args.length > 2) return ARITY_ERROR("<metacommand> argspec");
        return OK(STR("<metacommand> argspec"));
      },
    });
  }
}

const MACRO_COMMAND_SIGNATURE = (name, help) =>
  `${StringValue.toString(name, "<macro>")[1]}${help ? " " + help : ""}`;
class MacroCommand implements Command {
  readonly value: Value;
  readonly metacommand: MacroMetacommand;
  readonly argspec: ArgspecValue;
  readonly body: ScriptValue;
  readonly guard: Value;
  constructor(argspec: ArgspecValue, body: ScriptValue, guard: Value) {
    this.value = new CommandValue(this);
    this.argspec = argspec;
    this.body = body;
    this.guard = guard;
    this.metacommand = new MacroMetacommand(this);
  }

  execute(args: Value[], scope: Scope): Result {
    if (!this.argspec.checkArity(args, 1)) {
      return ARITY_ERROR(
        MACRO_COMMAND_SIGNATURE(args[0], this.argspec.usage())
      );
    }
    const subscope = scope.newLocalScope();
    const setarg = (name, value) => {
      subscope.setNamedLocal(name, value);
      return OK(value);
    };
    const result = this.argspec.applyArguments(scope, args, 1, setarg);
    if (result.code != ResultCode.OK) return result;
    const program = subscope.compileScriptValue(this.body as ScriptValue);
    if (this.guard) {
      return ContinuationValue.create(subscope, program, (result) => {
        if (result.code != ResultCode.OK) return result;
        const program = scope.compileArgs(this.guard, result.value);
        return ContinuationValue.create(scope, program);
      });
    } else {
      return ContinuationValue.create(subscope, program);
    }
  }
  help(args: Value[], { prefix, skip }) {
    const usage = skip
      ? this.argspec.usage(skip - 1)
      : MACRO_COMMAND_SIGNATURE(args[0], this.argspec.usage());
    const signature = [prefix, usage].filter(Boolean).join(" ");
    if (
      !this.argspec.checkArity(args, 1) &&
      args.length > this.argspec.argspec.nbRequired
    ) {
      return ARITY_ERROR(signature);
    }
    return OK(STR(signature));
  }
}

const MACRO_SIGNATURE = "macro ?name? argspec body";
export const macroCmd: Command = {
  execute: (args, scope: Scope) => {
    let name, specs, body;
    switch (args.length) {
      case 3:
        [, specs, body] = args;
        break;
      case 4:
        [, name, specs, body] = args;
        break;
      default:
        return ARITY_ERROR(MACRO_SIGNATURE);
    }
    let guard;
    if (body.type == ValueType.TUPLE) {
      const bodySpec = (body as TupleValue).values;
      switch (bodySpec.length) {
        case 0:
          return ERROR("empty body specifier");
        case 2:
          [guard, body] = bodySpec;
          break;
        default:
          return ERROR(`invalid body specifier`);
      }
    }
    if (body.type != ValueType.SCRIPT) return ERROR("body must be a script");

    const [result, argspec] = ArgspecValue.fromValue(specs);
    if (result.code != ResultCode.OK) return result;
    const macro = new MacroCommand(argspec, body as ScriptValue, guard);
    if (name) {
      const result = scope.registerCommand(name, macro);
      if (result.code != ResultCode.OK) return result;
    }
    return OK(macro.metacommand.value);
  },
  help: (args) => {
    if (args.length > 4) return ARITY_ERROR(MACRO_SIGNATURE);
    return OK(STR(MACRO_SIGNATURE));
  },
};
