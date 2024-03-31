/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  RESULT_CODE_NAME,
  ERROR,
  OK,
  Result,
  ResultCode,
} from "../core/results";
import { Command } from "../core/command";
import {
  Value,
  ScriptValue,
  ValueType,
  BOOL,
  STR,
  CommandValue,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { Process, Scope } from "./core";
import { Subcommands } from "./subcommands";

class CoroutineCommand implements Command {
  readonly value: Value;
  readonly scope: Scope;
  readonly body: ScriptValue;
  state: "inactive" | "active" | "done";
  process: Process;
  constructor(scope: Scope, body: ScriptValue) {
    this.value = new CommandValue(this);
    this.scope = scope;
    this.body = body;
    this.state = "inactive";
  }

  static readonly subcommands = new Subcommands([
    "subcommands",
    "wait",
    "active",
    "done",
    "yield",
  ]);
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.value);
    return CoroutineCommand.subcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length != 2) return ARITY_ERROR("<coroutine> subcommands");
        return OK(CoroutineCommand.subcommands.list);
      },
      wait: () => {
        if (args.length != 2) return ARITY_ERROR("<coroutine> wait");
        if (this.state == "inactive") {
          this.state = "active";
          this.process = this.scope.prepareScriptValue(this.body);
        }
        return this.run();
      },
      active: () => {
        if (args.length != 2) return ARITY_ERROR("<coroutine> active");
        return OK(BOOL(this.state == "active"));
      },
      done: () => {
        if (args.length != 2) return ARITY_ERROR("<coroutine> done");
        return OK(BOOL(this.state == "done"));
      },
      yield: () => {
        if (args.length != 2 && args.length != 3)
          return ARITY_ERROR("<coroutine> yield ?value?");
        if (this.state == "inactive") return ERROR("coroutine is inactive");
        if (this.state == "done") return ERROR("coroutine is done");
        if (args.length == 3) {
          this.process.yieldBack(args[2]);
        }
        return this.run();
      },
    });
  }

  private run() {
    const result = this.process.run();
    switch (result.code) {
      case ResultCode.OK:
      case ResultCode.RETURN:
        this.state = "done";
        return OK(result.value);
      case ResultCode.YIELD:
        return OK(result.value);
      case ResultCode.ERROR:
        return result;
      default:
        return ERROR("unexpected " + RESULT_CODE_NAME(result));
    }
  }
}

const COROUTINE_SIGNATURE = "coroutine body";
export const coroutineCmd: Command = {
  execute: (args, scope: Scope) => {
    let body;
    switch (args.length) {
      case 2:
        [, body] = args;
        break;
      default:
        return ARITY_ERROR(COROUTINE_SIGNATURE);
    }
    if (body.type != ValueType.SCRIPT) return ERROR("body must be a script");

    const value = new CoroutineCommand(
      new Scope(scope, true),
      body as ScriptValue
    );
    return OK(value.value);
  },
  help(args) {
    if (args.length > 2) return ARITY_ERROR(COROUTINE_SIGNATURE);
    return OK(STR(COROUTINE_SIGNATURE));
  },
};
