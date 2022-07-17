import { Command, ResultCode } from "./command";
import {
  VariableResolver,
  CommandResolver,
  CompilingEvaluator,
  InlineEvaluator,
} from "./evaluator";
import {
  Value,
  ScriptValue,
  NIL,
  StringValue,
  ValueType,
  TupleValue,
} from "./values";

export class TclScope {
  parent?: TclScope;
  variables: Map<string, Value> = new Map();
  commands: Map<string, (scope: TclScope) => Command> = new Map();
  constructor(parent?: TclScope) {
    this.parent = parent;
  }

  variableResolver: VariableResolver = {
    resolve: (name) => this.resolveVariable(name),
  };
  commandResolver: CommandResolver = {
    resolve: (name) => this.resolveCommand(name),
  };

  resolveVariable(name: string): Value {
    if (!this.variables.has(name)) {
      throw new Error(`can\'t read "${name}": no such variable`);
    }
    return this.variables.get(name);
  }
  resolveCommand(name: Value): Command {
    return this.resolveScopedCommand(name.asString())(this);
  }
  resolveScopedCommand(name: string): (scope: TclScope) => Command {
    if (!this.commands.has(name)) {
      if (!this.parent) throw new Error(`invalid command name "${name}"`);
      return this.parent.resolveScopedCommand(name);
    }
    return this.commands.get(name);
  }
}

function valueToInt(value: Value): number {
  let i = parseInt(value.asString());
  if (isNaN(i))
    throw new Error(`expected integer but got "${value.asString()}"`);
  return i;
}

const ifCmd = (scope: TclScope): Command => ({
  evaluate: (args, flowController) => {
    if (args.length != 3 && args.length != 5) {
      throw new Error(
        'wrong # args: should be "if test script1 ?else script2?"'
      );
    }
    const evaluator = new CompilingEvaluator(
      scope.variableResolver,
      scope.commandResolver,
      null
    );
    const expr = valueToInt(args[1]);
    let script: ScriptValue;
    if (expr) {
      script = args[2] as ScriptValue;
    } else if (args.length == 3) {
      return new StringValue("");
    } else {
      script = args[4] as ScriptValue;
    }
    const [code, result] = evaluator.executeScript(script.script);
    if (code != ResultCode.OK) return flowController.interrupt(code, result);
    return result == NIL ? new StringValue("") : result;
  },
});

const setCmd = (scope: TclScope): Command => ({
  evaluate: (args) => {
    switch (args.length) {
      case 2:
        return scope.variableResolver.resolve(args[1].asString());
      case 3:
        scope.variables.set(args[1].asString(), args[2]);
        return args[2];
      default:
        throw new Error('wrong # args: should be "set varName ?newValue?"');
    }
  },
});

type ArgSpec = {
  name: string;
  default?: Value;
};
class ProcCommand implements Command {
  scope: TclScope;
  argspecs: ArgSpec[];
  body: ScriptValue;
  constructor(scope: TclScope, argspecs: ArgSpec[], body: ScriptValue) {
    this.scope = scope;
    this.argspecs = argspecs;
    this.body = body;
  }

  evaluate(args: Value[]): Value {
    const scope = new TclScope(this.scope);
    let p, a;
    for (p = 0, a = 1; p < this.argspecs.length; p++, a++) {
      const argspec = this.argspecs[p];
      let value;
      if (p == this.argspecs.length - 1 && argspec.name == "args") {
        value = new TupleValue(args.slice(a));
        a = args.length - 1;
      } else if (p < args.length - 1) {
        value = args[a];
      } else if (argspec.default) {
        value = argspec.default;
      } else {
        throw new Error(
          `wrong # args: should be "${argspecsToSignature(
            args[0],
            this.argspecs
          )}"`
        );
      }
      scope.variables.set(argspec.name, value);
    }
    if (a < args.length)
      throw new Error(
        `wrong # args: should be "${argspecsToSignature(
          args[0],
          this.argspecs
        )}"`
      );

    const evaluator = new CompilingEvaluator(
      scope.variableResolver,
      scope.commandResolver,
      null
    );
    const result = evaluator.evaluateScript(this.body.script);
    return result == NIL ? new StringValue("") : result;
  }
}

function valueToList(value: Value): Value[] {
  switch (value.type) {
    case ValueType.TUPLE:
      return (value as TupleValue).values;
    case ValueType.SCRIPT: {
      const evaluator = new InlineEvaluator(null, null, null);
      const values = [];
      for (let sentence of (value as ScriptValue).script.sentences) {
        for (let word of sentence.words) {
          values.push(evaluator.evaluateWord(word));
        }
      }
      return values;
    }
    default:
      throw new Error("unsupported list format");
  }
}

function valueToArgspec(value: Value): ArgSpec {
  switch (value.type) {
    case ValueType.SCRIPT: {
      const values = valueToList(value);
      if (values.length == 0) throw new Error("argument with no name");
      const name = values[0].asString();
      if (name == "") throw new Error("argument with no name");
      switch (values.length) {
        case 1:
          return { name };
        case 2:
          return { name, default: values[1] };
        default:
          throw new Error(
            `too many fields in argument specifier "${value.asString()}"`
          );
      }
    }
    default:
      return { name: value.asString() };
  }
}
function valueToArgspecs(value: Value): ArgSpec[] {
  return valueToList(value).map(valueToArgspec);
}
function argspecsToSignature(name: Value, argspecs: ArgSpec[]): string {
  const chunks = [name.asString()];
  const argspectoSignature = (argspec) =>
    argspec.default ? `?${argspec.name}?` : argspec.name;
  if (argspecs[argspecs.length - 1]?.name == "args") {
    chunks.push(...argspecs.slice(undefined, -1).map(argspectoSignature));
    chunks.push("?arg ...?");
  } else {
    chunks.push(...argspecs.map(argspectoSignature));
  }
  return chunks.join(" ");
}

const procCmd = (scope: TclScope): Command => ({
  evaluate: (args) => {
    if (args.length != 4)
      throw new Error('wrong # args: should be "proc name args body"');
    const [, name, _argspecs, body] = args;
    const argspecs = valueToArgspecs(_argspecs);
    scope.commands.set(
      name.asString(),
      (scope: TclScope) => new ProcCommand(scope, argspecs, body as ScriptValue)
    );
    return new StringValue("");
  },
});

const returnCmd = (scope: TclScope): Command => ({
  evaluate: (args, flowController) => {
    if (args.length > 2)
      throw new Error('wrong # args: should be "return ?result?"');
    return flowController.interrupt(
      ResultCode.RETURN,
      args.length == 2 ? args[1] : new StringValue("")
    );
  },
});

export function initTclCommands(scope: TclScope) {
  scope.commands.set("if", ifCmd);
  scope.commands.set("set", setCmd);
  scope.commands.set("proc", procCmd);
  scope.commands.set("return", returnCmd);
}
