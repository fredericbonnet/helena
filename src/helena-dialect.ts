import { Command, Result, ResultCode } from "./command";
import {
  VariableResolver,
  CommandResolver,
  CompilingEvaluator,
  Evaluator,
} from "./evaluator";
import { Script } from "./syntax";
import { Value, NIL, StringValue, ScriptValue, ValueType } from "./values";

export class Variable {
  value: Value;
  constructor(value: Value) {
    this.value = value;
  }
}
type ScopedCommand = (scope: Scope) => Command;
export class CommandValue implements Value {
  type: ValueType = ValueType.CUSTOM;
  command: ScopedCommand;

  constructor(command: ScopedCommand) {
    this.command = command;
  }
  asString(): string {
    throw new Error("Method not implemented.");
  }
  selectIndex(index: Value): Value {
    throw new Error("Method not implemented.");
  }
  selectKey(key: Value): Value {
    throw new Error("Method not implemented.");
  }
  selectRules(rules: Value[]): Value {
    throw new Error("Method not implemented.");
  }
}
export class Scope {
  parent?: Scope;
  constants: Map<string, Value> = new Map();
  variables: Map<string, Variable> = new Map();
  commands: Map<string, ScopedCommand> = new Map();
  evaluator: Evaluator;
  constructor(parent?: Scope) {
    this.parent = parent;
    this.evaluator = new CompilingEvaluator(
      this.variableResolver,
      this.commandResolver,
      null
    );
  }

  evaluate(script: Script): Value {
    return this.evaluator.evaluateScript(script);
  }

  variableResolver: VariableResolver = {
    resolve: (name) => this.resolveVariable(name),
  };
  commandResolver: CommandResolver = {
    resolve: (name) => this.resolveCommand(name),
  };

  resolveVariable(name: string): Value {
    if (this.constants.has(name)) return this.constants.get(name);
    if (this.variables.has(name)) return this.variables.get(name).value;
    throw new Error(`can\'t read "${name}": no such variable`);
  }
  resolveCommand(value: Value): Command {
    if (value instanceof CommandValue) return value.command(this);
    return this.resolveScopedCommand(value.asString())(this);
  }
  resolveScopedCommand(name: string): ScopedCommand {
    if (!this.commands.has(name)) {
      if (!this.parent) throw new Error(`invalid command name "${name}"`);
      return this.parent.resolveScopedCommand(name);
    }
    return this.commands.get(name);
  }
}

const OK = (value: Value): Result => [ResultCode.OK, value];
const RETURN = (value: Value): Result => [ResultCode.RETURN, value];
const BREAK: Result = [ResultCode.BREAK, NIL];
const CONTINUE: Result = [ResultCode.CONTINUE, NIL];
const ERROR = (value: Value): Result => [ResultCode.ERROR, value];

const ARITY_ERROR = (signature: string) =>
  ERROR(new StringValue(`wrong # args: should be "${signature}"`));

const idemCmd = (scope: Scope): Command => ({
  execute: (args) => {
    if (args.length != 2) return ARITY_ERROR("idem value");
    return OK(args[1]);
  },
});

const letCmd = (scope: Scope): Command => ({
  execute: (args) => {
    switch (args.length) {
      case 3: {
        const name = args[1].asString();
        if (scope.constants.has(name)) {
          return ERROR(new StringValue(`cannot redefine constant "${name}"`));
        }
        if (scope.variables.has(name)) {
          return ERROR(
            new StringValue(
              `cannot define constant "${name}": variable already exists`
            )
          );
        }

        scope.constants.set(name, args[2]);
        return OK(args[2]);
      }
      default:
        return ARITY_ERROR("let constName value");
    }
  },
});
const setCmd = (scope: Scope): Command => ({
  execute: (args) => {
    switch (args.length) {
      case 3: {
        const name = args[1].asString();
        if (scope.constants.has(name)) {
          return ERROR(new StringValue(`cannot redefine constant "${name}"`));
        }
        if (scope.variables.has(name)) {
          const box = scope.variables.get(name);
          box.value = args[2];
        } else {
          scope.variables.set(args[1].asString(), new Variable(args[2]));
        }
        return OK(args[2]);
      }
      default:
        return ARITY_ERROR("set varName value");
    }
  },
});
const getCmd = (scope: Scope): Command => ({
  execute: (args) => {
    switch (args.length) {
      case 2:
        return OK(scope.variableResolver.resolve(args[1].asString()));
      default:
        return ARITY_ERROR("get varName");
    }
  },
});

type ArgSpec = {
  name: string;
  default?: Value;
};
class MacroCommand implements Command {
  scope: Scope;
  argspecs: ArgSpec[];
  body: ScriptValue;
  constructor(scope: Scope, argspecs: ArgSpec[], body: ScriptValue) {
    this.scope = scope;
    this.argspecs = argspecs;
    this.body = body;
  }

  execute(args: Value[]): Result {
    return this.scope.evaluator.executeScript(this.body.script);
  }
}

const macroCmd = (scope: Scope): Command => ({
  execute: (args) => {
    let name, argspecs, body;
    switch (args.length) {
      case 3:
        [, argspecs, body] = args;
        break;
      case 4:
        [, name, argspecs, body] = args;
        break;
      default:
        return ARITY_ERROR("macro ?name? args body");
    }

    const command = (scope: Scope) =>
      new MacroCommand(scope, valueToArgspecs(argspecs), body as ScriptValue);
    const value = new CommandValue(command);
    if (name) {
      scope.commands.set(name.asString(), command);
      scope.variables.set(name.asString(), new Variable(value));
    }

    return OK(value);
  },
});

function valueToArgspecs(value: Value): ArgSpec[] {
  // TODO
  return [];
}

export function initCommands(scope: Scope) {
  scope.commands.set("idem", idemCmd);

  scope.commands.set("let", letCmd);
  scope.commands.set("set", setCmd);
  scope.commands.set("get", getCmd);

  scope.commands.set("macro", macroCmd);
}
