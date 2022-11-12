/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  ERROR,
  OK,
  Result,
  ResultCode,
  RETURN,
  YIELD,
  YIELD_BACK,
} from "../core/results";
import { Command } from "../core/command";
import {
  Compiler,
  Executor,
  OpCode,
  Program,
  ProgramState,
} from "../core/compiler";
import { VariableResolver, CommandResolver } from "../core/evaluator";
import { Script } from "../core/syntax";
import {
  Value,
  ValueType,
  ScriptValue,
  NumberValue,
  TupleValue,
  NIL,
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

export class Process {
  scope: Scope;
  program: Program;
  state: ProgramState;
  constructor(scope: Scope, program: Program) {
    this.scope = scope;
    this.program = program;
    this.state = new ProgramState();
  }
  run(): Result {
    let tailcall = false;
    for (;;) {
      const result = this.scope.execute(this.program, this.state);
      if (tailcall && result.code == ResultCode.OK) return RETURN(result.value);
      if (result.code != ResultCode.TAILCALL) return result;
      tailcall = true;
      const scope = result.data as Scope;
      let process: Process;
      switch (result.value.type) {
        case ValueType.SCRIPT:
          process = scope.prepareScriptValue(result.value as ScriptValue);
          break;
        case ValueType.TUPLE: {
          process = scope.prepareTupleValue(result.value as TupleValue);
          break;
        }
        default:
          return ERROR("body must be a script or tuple");
      }
      this.scope = process.scope;
      this.program = process.program;
      this.state = process.state;
    }
  }
  yieldBack(value: Value) {
    this.state.result = YIELD_BACK(this.state.result, value);
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

  executeScriptValue(script: ScriptValue): Result {
    return this.executeScript(script.script);
  }
  executeScript(script: Script): Result {
    return this.prepareScript(script).run();
  }
  evaluateList(script: ScriptValue): Result {
    const program = this.compiler.compileSentences(script.script.sentences);
    return this.execute(program);
  }

  compile(script: Script): Program {
    return this.compiler.compileScript(script);
  }
  execute(program: Program, state?: ProgramState): Result {
    return this.executor.execute(program, state);
  }

  prepareScriptValue(script: ScriptValue): Process {
    return this.prepareScript(script.script);
  }
  prepareScript(script: Script): Process {
    return this.prepareProcess(this.compile(script));
  }
  prepareTupleValue(tuple: TupleValue): Process {
    const program = new Program();
    program.pushOpCode(OpCode.PUSH_CONSTANT);
    program.pushOpCode(OpCode.EVALUATE_SENTENCE);
    program.pushOpCode(OpCode.PUSH_RESULT);
    program.pushConstant(tuple);
    return this.prepareProcess(program);
  }
  prepareProcess(program: Program): Process {
    return new Process(this, program);
  }

  resolveVariable(name: string): Value {
    if (this.context.locals?.has(name)) return this.context.locals.get(name);
    if (this.context.constants.has(name))
      return this.context.constants.get(name);
    if (this.context.variables.has(name))
      return this.context.variables.get(name).value;
    return null;
  }
  resolveCommand(value: Value): Command {
    if (value.type == ValueType.TUPLE) return expandPrefixCmd;
    if (value instanceof CommandValue) return value.command;
    if (NumberValue.isNumber(value)) return numberCmd;
    return this.resolveNamedCommand(value.asString());
  }
  private resolveNamedCommand(name: string): Command {
    if (!this.hasLocalCommand(name)) {
      if (!this.parent) return;
      return this.parent.resolveNamedCommand(name);
    }
    return this.context.commands.get(name);
  }

  setConstant(name: string, value: Value): Result {
    if (this.context.locals?.has(name)) {
      return ERROR(`cannot redefine local "${name}"`);
    }
    if (this.context.constants.has(name)) {
      return ERROR(`cannot redefine constant "${name}"`);
    }
    if (this.context.variables.has(name)) {
      return ERROR(`cannot define constant "${name}": variable already exists`);
    }

    this.context.constants.set(name, value);
    return OK(value);
  }
  setVariable(name: string, value: Value): Result {
    if (this.context.locals?.has(name)) {
      return ERROR(`cannot redefine local "${name}"`);
    }
    if (this.context.constants.has(name)) {
      return ERROR(`cannot redefine constant "${name}"`);
    }
    if (this.context.variables.has(name)) {
      this.context.variables.get(name).value = value;
    } else {
      this.context.variables.set(name, new Variable(value));
    }
    return OK(value);
  }
  getVariable(name: string): Result {
    const value = this.resolveVariable(name);
    if (value) return OK(value);
    return ERROR(`cannot get "${name}": no such variable`);
  }

  registerCommand(name: string, command: Command) {
    this.context.commands.set(name, command);
  }
  hasLocalCommand(name: string): boolean {
    return this.context.commands.has(name);
  }
}

type ExpandPrefixState = {
  command: Command;
  result: Result;
};
export const expandPrefixCmd: Command = {
  execute(args: Value[], scope: Scope): Result {
    const [command, args2] = resolveLeadingTuple(args, scope);
    if (!command) return OK(NIL);
    const result = command.execute(args2, scope);
    if (result.code == ResultCode.YIELD)
      return YIELD(result.value, { command, result });
    return result;
  },
  resume(result: Result, scope: Scope): Result {
    const { command, result: commandResult } = result.data as ExpandPrefixState;
    if (!command.resume) return commandResult;
    const result2 = command.resume(
      YIELD_BACK(commandResult, result.value),
      scope
    );
    if (result2.code == ResultCode.YIELD)
      return YIELD(result2.value, { command, result: result2 });
    return result2;
  },
};

function resolveLeadingTuple(args: Value[], scope: Scope): [Command, Value[]] {
  if (args.length == 0) return [null, null];
  const [lead, ...rest] = args;
  if (lead.type != ValueType.TUPLE) {
    const command = scope.resolveCommand(lead);
    return [command, args];
  }
  const tuple = lead as TupleValue;
  return resolveLeadingTuple([...tuple.values, ...rest], scope);
}
