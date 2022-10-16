/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command, ERROR, OK, Result } from "../core/command";
import { Compiler, Executor, Program, Process } from "../core/compiler";
import { VariableResolver, CommandResolver } from "../core/evaluator";
import { Script, Word } from "../core/syntax";
import {
  Value,
  ValueType,
  ScriptValue,
  StringValue,
  NumberValue,
} from "../core/values";
import { numberCmd } from "./math";

export class Variable {
  value: Value;
  constructor(value: Value) {
    this.value = value;
  }
}
export class CommandValue implements Value {
  readonly type: ValueType = ValueType.CUSTOM;
  readonly command: Command;

  constructor(command: Command) {
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

export class ScopeContext {
  readonly constants: Map<string, Value>;
  readonly variables: Map<string, Variable>;
  readonly commands: Map<string, Command>;
  readonly locals: Map<string, Value>;
  constructor(context?: ScopeContext, locals?: Map<string, Value>) {
    this.constants = context?.constants ?? new Map();
    this.variables = context?.variables ?? new Map();
    this.commands = context?.commands ?? new Map();
    this.locals = locals;
  }
}

export class Scope {
  readonly parent?: Scope;
  readonly context: ScopeContext;
  private readonly compiler: Compiler;
  private readonly executor: Executor;

  constructor(parent?: Scope, context = new ScopeContext()) {
    this.parent = parent;
    this.context = context;
    this.compiler = new Compiler();
    const variableResolver: VariableResolver = {
      resolve: (name) => this.resolveVariable(name),
    };
    const commandResolver: CommandResolver = {
      resolve: (name) => this.resolveCommand(name),
    };
    this.executor = new Executor(variableResolver, commandResolver, null, this);
  }

  executeScript(script: ScriptValue): Result {
    return this.execute(this.compile(script.script));
  }
  executeWord(word: Word): Result {
    const program = this.compiler.compileWord(word);
    return this.execute(program);
  }
  compile(script: Script): Program {
    return this.compiler.compileScript(script);
  }
  execute(program: Program, process?: Process): Result {
    return this.executor.execute(program, process);
  }

  resolveVariable(name: string): Value {
    if (this.context.locals?.has(name)) return this.context.locals.get(name);
    if (this.context.constants.has(name))
      return this.context.constants.get(name);
    if (this.context.variables.has(name))
      return this.context.variables.get(name).value;
    throw new Error(`can't read "${name}": no such variable`);
  }
  resolveCommand(value: Value, recurse = true): Command {
    if (value instanceof CommandValue) return value.command;
    if (NumberValue.isNumber(value)) return numberCmd;
    return this.resolveScopedCommand(value.asString(), recurse);
  }
  private resolveScopedCommand(name: string, recurse: boolean): Command {
    if (!this.context.commands.has(name)) {
      if (!recurse || !this.parent)
        throw new Error(`invalid command name "${name}"`);
      return this.parent.resolveScopedCommand(name, recurse);
    }
    return this.context.commands.get(name);
  }

  setConstant(name: string, value: Value): Result {
    if (this.context.locals?.has(name)) {
      return ERROR(new StringValue(`cannot redefine local "${name}"`));
    }
    if (this.context.constants.has(name)) {
      return ERROR(new StringValue(`cannot redefine constant "${name}"`));
    }
    if (this.context.variables.has(name)) {
      return ERROR(
        new StringValue(
          `cannot define constant "${name}": variable already exists`
        )
      );
    }

    this.context.constants.set(name, value);
    return OK(value);
  }
  setVariable(name: string, value: Value): Result {
    if (this.context.locals?.has(name)) {
      return ERROR(new StringValue(`cannot redefine local "${name}"`));
    }
    if (this.context.constants.has(name)) {
      return ERROR(new StringValue(`cannot redefine constant "${name}"`));
    }
    if (this.context.variables.has(name)) {
      this.context.variables.get(name).value = value;
    } else {
      this.context.variables.set(name, new Variable(value));
    }
    return OK(value);
  }
  getVariable(name: string): Result {
    return OK(this.resolveVariable(name));
  }

  registerCommand(name: string, command: Command) {
    this.context.commands.set(name, command);
  }
}
