/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  BREAK,
  CONTINUE,
  ERROR,
  OK,
  ResultCode,
  RETURN,
  YIELD,
} from "../core/results";
import { Command } from "../core/commands";
import {
  NIL,
  ScriptValue,
  STR,
  StringValue,
  TupleValue,
  ValueType,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { ContinuationValue, Scope } from "./core";
import { LAST_RESULT, SHIFT_LAST_FRAME_RESULT } from "../core/intrinsics";

const IDEM_SIGNATURE = "idem value";
const idemCmd: Command = {
  execute: (args) => {
    if (args.length != 2) return ARITY_ERROR(IDEM_SIGNATURE);
    return OK(args[1]);
  },
  help: (args) => {
    if (args.length > 2) return ARITY_ERROR(IDEM_SIGNATURE);
    return OK(STR(IDEM_SIGNATURE));
  },
};

const RETURN_SIGNATURE = "return ?result?";
const returnCmd: Command = {
  execute: (args) => {
    if (args.length > 2) return ARITY_ERROR(RETURN_SIGNATURE);
    return RETURN(args.length == 2 ? args[1] : NIL);
  },
  help: (args) => {
    if (args.length > 2) return ARITY_ERROR(RETURN_SIGNATURE);
    return OK(STR(RETURN_SIGNATURE));
  },
};

const YIELD_SIGNATURE = "yield ?result?";
const yieldCmd: Command = {
  execute: (args) => {
    if (args.length > 2) return ARITY_ERROR(YIELD_SIGNATURE);
    return YIELD(args.length == 2 ? args[1] : NIL);
  },
  help: (args) => {
    if (args.length > 2) return ARITY_ERROR(YIELD_SIGNATURE);
    return OK(STR(YIELD_SIGNATURE));
  },
};

const TAILCALL_SIGNATURE = "tailcall body";
const tailcallCmd: Command = {
  execute: (args, scope: Scope) => {
    if (args.length != 2) return ARITY_ERROR(TAILCALL_SIGNATURE);
    const body = args[1];
    let program;
    switch (body.type) {
      case ValueType.SCRIPT:
        program = scope.compileScriptValue(body as ScriptValue);
        break;
      case ValueType.TUPLE:
        program = scope.compileTupleValue(body as TupleValue);
        break;
      default:
        return ERROR("body must be a script or tuple");
    }
    return RETURN(
      new ContinuationValue(scope, program, (result) => {
        if (result.code != ResultCode.OK) {
          return result;
        }
        return RETURN(result.value);
      })
    );
  },
  help: (args) => {
    if (args.length > 2) return ARITY_ERROR(TAILCALL_SIGNATURE);
    return OK(STR(TAILCALL_SIGNATURE));
  },
};

const ERROR_SIGNATURE = "error message";
const errorCmd: Command = {
  execute: (args) => {
    if (args.length != 2) return ARITY_ERROR(ERROR_SIGNATURE);
    // TODO accept non-string messages?
    if (StringValue.toString(args[1])[0].code != ResultCode.OK)
      return ERROR("invalid message");
    return {
      code: ResultCode.ERROR,
      value: args[1],
    };
  },
  help: (args) => {
    if (args.length > 2) return ARITY_ERROR(ERROR_SIGNATURE);
    return OK(STR(ERROR_SIGNATURE));
  },
};

const BREAK_SIGNATURE = "break";
const breakCmd: Command = {
  execute: (args) => {
    if (args.length != 1) return ARITY_ERROR(BREAK_SIGNATURE);
    return BREAK();
  },
  help: (args) => {
    if (args.length > 1) return ARITY_ERROR(BREAK_SIGNATURE);
    return OK(STR(BREAK_SIGNATURE));
  },
};

const CONTINUE_SIGNATURE = "continue";
const continueCmd: Command = {
  execute: (args) => {
    if (args.length != 1) return ARITY_ERROR(CONTINUE_SIGNATURE);
    return CONTINUE();
  },
  help: (args) => {
    if (args.length > 1) return ARITY_ERROR(CONTINUE_SIGNATURE);
    return OK(STR(CONTINUE_SIGNATURE));
  },
};

const EVAL_SIGNATURE = "eval body";
const evalCmd: Command = {
  execute: (args, scope: Scope) => {
    if (args.length != 2) return ARITY_ERROR(EVAL_SIGNATURE);
    const body = args[1];
    let program;
    switch (body.type) {
      case ValueType.SCRIPT:
        program = scope.compileScriptValue(body as ScriptValue);
        break;
      case ValueType.TUPLE:
        program = scope.compileTupleValue(body as TupleValue);
        break;
      default:
        return ERROR("body must be a script or tuple");
    }
    return ContinuationValue.create(scope, program);
  },
  help: (args) => {
    if (args.length > 2) return ARITY_ERROR(EVAL_SIGNATURE);
    return OK(STR(EVAL_SIGNATURE));
  },
};

const HELP_SIGNATURE = "help command ?arg ...?";
const helpCmd: Command = {
  execute: (args, scope: Scope) => {
    if (args.length < 2) return ARITY_ERROR(HELP_SIGNATURE);
    const command = scope.resolveCommand(args[1]);
    if (!command) {
      const [result, cmdname] = StringValue.toString(args[1]);
      return ERROR(
        result.code == ResultCode.OK
          ? `unknown command "${cmdname}"`
          : "invalid command name"
      );
    }
    if (!command.help) {
      const [result, cmdname] = StringValue.toString(args[1]);
      return ERROR(
        result.code == ResultCode.OK
          ? `no help for command "${cmdname}"`
          : "no help for command"
      );
    }
    return command.help(args.slice(1), {}, scope);
  },
  help: () => {
    return OK(STR(HELP_SIGNATURE));
  },
};

export function registerBasicCommands(scope: Scope) {
  scope.registerNamedCommand("idem", idemCmd);
  scope.registerNamedCommand("return", returnCmd);
  scope.registerNamedCommand("tailcall", tailcallCmd);
  scope.registerNamedCommand("yield", yieldCmd);
  scope.registerNamedCommand("error", errorCmd);
  scope.registerNamedCommand("break", breakCmd);
  scope.registerNamedCommand("continue", continueCmd);
  scope.registerNamedCommand("eval", evalCmd);
  scope.registerNamedCommand("help", helpCmd);
  scope.registerNamedCommand("^", LAST_RESULT);
  scope.registerNamedCommand("|>", SHIFT_LAST_FRAME_RESULT);
}
