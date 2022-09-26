/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command, ERROR, OK, Result } from "../core/command";
import {
  Compiler,
  Executor,
  Program,
  ExecutionContext,
} from "../core/compiler";
import { VariableResolver, CommandResolver } from "../core/evaluator";
import { Script } from "../core/syntax";
import { Value, ValueType, ScriptValue, StringValue } from "../core/values";

export class Variable {
  value: Value;
  constructor(value: Value) {
    this.value = value;
  }
}
type ScopedCommand = (scope: Scope) => Command;
export class CommandValue implements Value {
  readonly type: ValueType = ValueType.CUSTOM;
  readonly command: ScopedCommand;

  constructor(command: ScopedCommand) {
    this.command = command;
  }
  asString(): string {
    throw new Error("Method not implemented.");
  }
  selectIndex(_index: Value): Value {
    throw new Error("Method not implemented.");
  }
  selectKey(_key: Value): Value {
    throw new Error("Method not implemented.");
  }
  selectRules(_rules: Value[]): Value {
    throw new Error("Method not implemented.");
  }
}

export class Scope {
  readonly parent?: Scope;
  readonly constants: Map<string, Value> = new Map();
  readonly variables: Map<string, Variable> = new Map();
  readonly commands: Map<string, ScopedCommand> = new Map();
  readonly compiler: Compiler;
  readonly executor: Executor;

  constructor(parent?: Scope) {
    this.parent = parent;
    this.compiler = new Compiler();
    this.executor = new Executor(
      this.variableResolver,
      this.commandResolver,
      null
    );
  }

  executeScript(script: ScriptValue): Result {
    return this.execute(this.compile(script.script));
  }
  compile(script: Script): Program {
    return this.compiler.compileScript(script);
  }
  execute(program: Program, context?: ExecutionContext): Result {
    return this.executor.execute(program, context);
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
    throw new Error(`can't read "${name}": no such variable`);
  }
  resolveCommand(value: Value, recurse = true): Command {
    if (value instanceof CommandValue) return value.command(this);
    return this.resolveScopedCommand(value.asString(), recurse)(this);
  }
  resolveScopedCommand(name: string, recurse: boolean): ScopedCommand {
    if (!this.commands.has(name)) {
      if (!recurse || !this.parent)
        throw new Error(`invalid command name "${name}"`);
      return this.parent.resolveScopedCommand(name, recurse);
    }
    return this.commands.get(name);
  }

  setConstant(name: string, value: Value): Result {
    if (this.constants.has(name)) {
      return ERROR(new StringValue(`cannot redefine constant "${name}"`));
    }
    if (this.variables.has(name)) {
      return ERROR(
        new StringValue(
          `cannot define constant "${name}": variable already exists`
        )
      );
    }

    this.constants.set(name, value);
    return OK(value);
  }
  setVariable(name: string, value: Value): Result {
    if (this.constants.has(name)) {
      return ERROR(new StringValue(`cannot redefine constant "${name}"`));
    }
    if (this.variables.has(name)) {
      this.variables.get(name).value = value;
    } else {
      this.variables.set(name, new Variable(value));
    }
    return OK(value);
  }
  getVariable(name: string): Result {
    return OK(this.resolveVariable(name));
  }

  registerCommand(name: string, command: ScopedCommand) {
    this.commands.set(name, command);
  }
  setNamedCommand(name: Value, command: CommandValue): Result {
    this.commands.set(name.asString(), command.command);
    return this.setVariable(name.asString(), command);
  }
}
