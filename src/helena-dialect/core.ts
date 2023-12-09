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
import { VariableResolver, CommandResolver } from "../core/resolvers";
import { Script } from "../core/syntax";
import {
  Value,
  ValueType,
  CustomValueType,
  ScriptValue,
  RealValue,
  TupleValue,
  NIL,
  StringValue,
  isCustomValueType,
} from "../core/values";
import { numberCmd } from "./numbers";

export const commandValueType: CustomValueType = { name: "command" };
export class CommandValue implements Value {
  readonly type = commandValueType;
  readonly command: Command;
  constructor(command: Command) {
    this.command = command;
  }
}
export function isCommandValue(value: Value) {
  return isCustomValueType(value.type) && value.type == commandValueType;
}

const deferredValueType: CustomValueType = { name: "deferred" };
export class DeferredValue implements Value {
  type = deferredValueType;
  value: Value;
  scope: Scope;
  constructor(value: Value, scope: Scope) {
    this.value = value;
    this.scope = scope;
  }
}

type ProcessContext = {
  scope: Scope;
  program: Program;
  state: ProgramState;
};
export class Process {
  private contextStack: ProcessContext[];
  private get currentContext(): ProcessContext {
    return this.contextStack[this.contextStack.length - 1];
  }
  constructor(scope: Scope, program: Program) {
    this.contextStack = [{ scope, program, state: new ProgramState() }];
  }
  run(): Result {
    for (;;) {
      const result = this.currentContext.scope.execute(
        this.currentContext.program,
        this.currentContext.state
      );
      if (result.value instanceof DeferredValue) {
        const deferred = result.value;
        let process: Process;
        switch (deferred.value.type) {
          case ValueType.SCRIPT:
            process = deferred.scope.prepareScriptValue(
              deferred.value as ScriptValue
            );
            break;
          case ValueType.TUPLE:
            process = deferred.scope.prepareTupleValue(
              deferred.value as TupleValue
            );
            break;
          default:
            return ERROR("body must be a script or tuple");
        }
        this.contextStack.push(...process.contextStack);
        continue;
      }
      if (result.code == ResultCode.OK && this.contextStack.length > 1) {
        this.contextStack.pop();
        switch (this.currentContext.state.result.code) {
          case ResultCode.RETURN:
            return RETURN(result.value);
          case ResultCode.YIELD:
            this.yieldBack(result.value);
            continue;
          default:
            return ERROR("unexpected deferred result");
        }
      }
      return result;
    }
  }
  yieldBack(value: Value) {
    this.currentContext.state.result = YIELD_BACK(
      this.currentContext.state.result,
      value
    );
  }
}

class ScopeContext {
  readonly parent?: ScopeContext;
  readonly constants: Map<string, Value> = new Map();
  readonly variables: Map<string, Value> = new Map();
  readonly commands: Map<string, Command> = new Map();
  constructor(parent?: ScopeContext) {
    this.parent = parent;
  }
}
export class Scope {
  readonly context: ScopeContext;
  private readonly locals: Map<string, Value> = new Map();
  private readonly compiler: Compiler;
  private readonly executor: Executor;

  constructor(parent?: Scope, shared = false) {
    this.context = shared ? parent.context : new ScopeContext(parent?.context);
    this.compiler = new Compiler();
    const variableResolver: VariableResolver = {
      resolve: (name) => this.resolveVariable(name),
    };
    const commandResolver: CommandResolver = {
      resolve: (name) => this.resolveCommand(name),
    };
    this.executor = new Executor(variableResolver, commandResolver, null, this);
  }

  evaluateSentences(script: ScriptValue): Result {
    const program = this.compiler.compileSentences(script.script.sentences);
    return this.execute(program);
  }

  executeScriptValue(script: ScriptValue): Result {
    return this.executeScript(script.script);
  }
  executeScript(script: Script): Result {
    return this.prepareScript(script).run();
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
    if (this.locals.has(name)) return this.locals.get(name);
    if (this.context.constants.has(name))
      return this.context.constants.get(name);
    if (this.context.variables.has(name))
      return this.context.variables.get(name);
    return null;
  }
  resolveCommand(value: Value): Command {
    if (value.type == ValueType.TUPLE) return expandPrefixCmd;
    if (isCommandValue(value)) return (value as CommandValue).command;
    if (RealValue.isNumber(value)) return numberCmd;
    const { data: cmdname, code } = StringValue.toString(value);
    if (code != ResultCode.OK) return null;
    return this.resolveNamedCommand(cmdname);
  }
  resolveNamedCommand(name: string): Command {
    let context = this.context;
    while (context) {
      const command = context.commands.get(name);
      if (command) return command;
      context = context.parent;
    }
  }

  setNamedLocal(name: string, value: Value) {
    this.locals.set(name, value);
  }
  destructureLocal(constant: Value, value: Value, check: boolean): Result {
    const { data: name, code } = StringValue.toString(constant);
    if (code != ResultCode.OK) return ERROR("invalid local name");
    if (check) return OK(NIL);
    this.setNamedLocal(name, value);
    return OK(NIL);
  }
  setNamedConstant(name: string, value: Value): Result {
    const result = this.checkNamedConstant(name);
    if (result.code != ResultCode.OK) return result;
    this.context.constants.set(name, value);
    return OK(value);
  }
  destructureConstant(constant: Value, value: Value, check: boolean): Result {
    const { data: name, code } = StringValue.toString(constant);
    if (code != ResultCode.OK) return ERROR("invalid constant name");
    if (check) return this.checkNamedConstant(name);
    this.context.constants.set(name, value);
    return OK(NIL);
  }
  private checkNamedConstant(name: string): Result {
    if (this.locals.has(name)) {
      return ERROR(`cannot define constant "${name}": local already exists`);
    }
    if (this.context.constants.has(name)) {
      return ERROR(`cannot redefine constant "${name}"`);
    }
    if (this.context.variables.has(name)) {
      return ERROR(`cannot define constant "${name}": variable already exists`);
    }
    return OK(NIL);
  }
  setNamedVariable(name: string, value: Value): Result {
    const result = this.checkNamedVariable(name);
    if (result.code != ResultCode.OK) return result;
    this.context.variables.set(name, value);
    return OK(value);
  }
  destructureVariable(variable: Value, value: Value, check: boolean): Result {
    const { data: name, code } = StringValue.toString(variable);
    if (code != ResultCode.OK) return ERROR("invalid variable name");
    if (check) return this.checkNamedVariable(name);
    this.context.variables.set(name, value);
    return OK(NIL);
  }
  private checkNamedVariable(name: string): Result {
    if (this.locals.has(name)) {
      return ERROR(`cannot redefine local "${name}"`);
    }
    if (this.context.constants.has(name)) {
      return ERROR(`cannot redefine constant "${name}"`);
    }
    return OK(NIL);
  }
  unsetVariable(variable: Value, check = false): Result {
    const { data: name, code } = StringValue.toString(variable);
    if (code != ResultCode.OK) return ERROR("invalid variable name");
    if (this.locals.has(name)) {
      return ERROR(`cannot unset local "${name}"`);
    }
    if (this.context.constants.has(name)) {
      return ERROR(`cannot unset constant "${name}"`);
    }
    if (!this.context.variables.has(name)) {
      return ERROR(`cannot unset "${name}": no such variable`);
    }
    if (check) return OK(NIL);
    this.context.variables.delete(name);
    return OK(NIL);
  }
  getVariable(variable: Value, def?: Value): Result {
    const { data: name, code } = StringValue.toString(variable);
    if (code != ResultCode.OK) return ERROR("invalid variable name");
    const value = this.resolveVariable(name);
    if (value) return OK(value);
    if (def) return OK(def);
    return ERROR(`cannot get "${name}": no such variable`);
  }
  resolveValue(value: Value): Result {
    const program = new Program();
    program.pushOpCode(OpCode.PUSH_CONSTANT);
    program.pushOpCode(OpCode.RESOLVE_VALUE);
    program.pushConstant(value);
    return this.execute(program);
  }

  registerCommand(name: Value, command: Command): Result {
    const { data: cmdname, code } = StringValue.toString(name);
    if (code != ResultCode.OK) return ERROR("invalid command name");
    this.registerNamedCommand(cmdname, command);
    return OK(NIL);
  }
  registerNamedCommand(name: string, command: Command) {
    this.context.commands.set(name, command);
  }
  hasLocalCommand(name: string): boolean {
    return this.context.commands.has(name);
  }
  getLocalCommands(): string[] {
    return [...this.context.commands.keys()];
  }
}

type ExpandPrefixState = {
  command: Command;
  result: Result;
};
export const expandPrefixCmd: Command = {
  execute(args: Value[], scope: Scope): Result {
    const [command, args2] = resolveLeadingTuple(args, scope);
    if (!command) {
      if (!args2 || args2.length == 0) return OK(NIL);
      const { data: cmdname, code } = StringValue.toString(args2[0]);
      return ERROR(
        code != ResultCode.OK
          ? `invalid command name`
          : `cannot resolve command "${cmdname}"`
      );
    }
    const result = command.execute(args2, scope);
    if (result.code == ResultCode.YIELD)
      return YIELD(result.value, { command, result });
    return result;
  },
  resume(result: Result, scope: Scope): Result {
    const { command, result: commandResult } = result.data as ExpandPrefixState;
    if (!command.resume) return OK(result.value);
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

export function destructureValue(
  apply: (name: Value, value: Value, check: boolean) => Result,
  shape: Value,
  value: Value
): Result {
  const result = checkValues(apply, shape, value);
  if (result.code != ResultCode.OK) return result;
  applyValues(apply, shape, value);
  return OK(value);
}
function checkValues(
  apply: (name: Value, value: Value, check: boolean) => Result,
  shape: Value,
  value: Value
): Result {
  if (shape.type != ValueType.TUPLE) return apply(shape, value, true);
  if (value.type != ValueType.TUPLE) return ERROR("bad value shape");
  const variables = (shape as TupleValue).values;
  const values = (value as TupleValue).values;
  if (values.length < variables.length) return ERROR("bad value shape");
  for (let i = 0; i < variables.length; i++) {
    const result = checkValues(apply, variables[i], values[i]);
    if (result.code != ResultCode.OK) return result;
  }
  return OK(NIL);
}
function applyValues(
  apply: (name: Value, value: Value, check: boolean) => Result,
  shape: Value,
  value: Value
) {
  if (shape.type != ValueType.TUPLE) {
    apply(shape, value, false);
    return;
  }
  const variables = (shape as TupleValue).values;
  const values = (value as TupleValue).values;
  for (let i = 0; i < variables.length; i++) {
    applyValues(apply, variables[i], values[i]);
  }
}
