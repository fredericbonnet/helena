/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  Result,
  ResultCode,
  OK,
  ERROR,
  RESULT_CODE_NAME,
} from "../core/results";
import { Command } from "../core/command";
import { Program } from "../core/compiler";
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
import { Scope, ContinuationValue } from "./core";
import { Subcommands } from "./subcommands";

class ProcMetacommand implements Command {
  readonly value: Value;
  readonly proc: ProcCommand;
  constructor(proc: ProcCommand) {
    this.value = new CommandValue(this);
    this.proc = proc;
  }

  static readonly subcommands = new Subcommands(["subcommands", "argspec"]);
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.proc.value);
    return ProcMetacommand.subcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length != 2) return ARITY_ERROR("<proc> subcommands");
        return OK(ProcMetacommand.subcommands.list);
      },
      argspec: () => {
        if (args.length != 2) return ARITY_ERROR("<proc> argspec");
        return OK(this.proc.argspec);
      },
    });
  }
}

const PROC_COMMAND_SIGNATURE = (name, help) =>
  `${StringValue.toString(name, "<proc>")[1]}${help ? " " + help : ""}`;
class ProcCommand implements Command {
  readonly value: Value;
  readonly metacommand: ProcMetacommand;
  readonly scope: Scope;
  readonly argspec: ArgspecValue;
  readonly body: ScriptValue;
  readonly guard: Value;
  readonly program: Program;
  constructor(
    scope: Scope,
    argspec: ArgspecValue,
    body: ScriptValue,
    guard: Value,
    program: Program
  ) {
    this.value = new CommandValue(this);
    this.scope = scope;
    this.argspec = argspec;
    this.body = body;
    this.guard = guard;
    this.program = program;
    this.metacommand = new ProcMetacommand(this);
  }

  execute(args: Value[]): Result {
    if (!this.argspec.checkArity(args, 1)) {
      return ARITY_ERROR(PROC_COMMAND_SIGNATURE(args[0], this.argspec.usage()));
    }
    const subscope = this.scope.newChildScope();
    const setarg = (name, value) => subscope.setNamedVariable(name, value);
    const result = this.argspec.applyArguments(this.scope, args, 1, setarg);
    if (result.code != ResultCode.OK) return result;
    if (this.guard) {
      return ContinuationValue.create(subscope, this.program, (result) => {
        switch (result.code) {
          case ResultCode.OK:
          case ResultCode.RETURN: {
            const program = this.scope.compileArgs(this.guard, result.value);
            return ContinuationValue.create(this.scope, program);
          }
          case ResultCode.ERROR:
            return result;
          default:
            return ERROR("unexpected " + RESULT_CODE_NAME(result));
        }
      });
    } else {
      return ContinuationValue.create(subscope, this.program, (result) => {
        switch (result.code) {
          case ResultCode.OK:
          case ResultCode.RETURN:
            return OK(result.value);
          case ResultCode.ERROR:
            return result;
          default:
            return ERROR("unexpected " + RESULT_CODE_NAME(result));
        }
      });
    }
  }
  help(args: Value[]): Result {
    if (
      !this.argspec.checkArity(args, 1) &&
      args.length > this.argspec.argspec.nbRequired
    ) {
      return ARITY_ERROR(PROC_COMMAND_SIGNATURE(args[0], this.argspec.usage()));
    }
    return OK(STR(PROC_COMMAND_SIGNATURE(args[0], this.argspec.usage())));
  }
}

const PROC_SIGNATURE = "proc ?name? argspec body";
export const procCmd: Command = {
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
        return ARITY_ERROR(PROC_SIGNATURE);
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
    const program = scope.compileScriptValue(body as ScriptValue);
    const proc = new ProcCommand(
      scope.newLocalScope(),
      argspec,
      body as ScriptValue,
      guard,
      program
    );
    if (name) {
      const result = scope.registerCommand(name, proc);
      if (result.code != ResultCode.OK) return result;
    }
    return OK(proc.metacommand.value);
  },
  help: (args) => {
    if (args.length > 4) return ARITY_ERROR(PROC_SIGNATURE);
    return OK(STR(PROC_SIGNATURE));
  },
};
