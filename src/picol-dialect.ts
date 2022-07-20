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
  NumberValue,
  FALSE,
  TRUE,
  BooleanValue,
} from "./values";

export class PicolScope {
  parent?: PicolScope;
  variables: Map<string, Value> = new Map();
  commands: Map<string, (scope: PicolScope) => Command> = new Map();
  constructor(parent?: PicolScope) {
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
  resolveScopedCommand(name: string): (scope: PicolScope) => Command {
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

const addCmd = (scope: PicolScope): Command => ({
  evaluate: (args) => {
    if (args.length < 2)
      throw new Error(`wrong # args: should be "+ arg ?arg ...?"`);
    const result = args.reduce((total, arg, i) => {
      if (i == 0) return 0;
      const v = NumberValue.fromValue(arg).value;
      return total + v;
    }, 0);
    return new NumberValue(result);
  },
});
const subtractCmd = (scope: PicolScope): Command => ({
  evaluate: (args) => {
    if (args.length < 2)
      throw new Error(`wrong # args: should be "- arg ?arg ...?"`);
    if (args.length == 2) {
      const v = NumberValue.fromValue(args[1]).value;
      return new NumberValue(-v);
    }
    const result = args.reduce((total, arg, i) => {
      if (i == 0) return 0;
      const v = NumberValue.fromValue(arg).value;
      if (i == 1) return v;
      return total - v;
    }, 0);
    return new NumberValue(result);
  },
});

const multiplyCmd = (scope: PicolScope): Command => ({
  evaluate: (args) => {
    if (args.length < 2)
      throw new Error(`wrong # args: should be "* arg ?arg ...?"`);
    const result = args.reduce((total, arg, i) => {
      if (i == 0) return 1;
      const v = NumberValue.fromValue(arg).value;
      return total * v;
    }, 1);
    return new NumberValue(result);
  },
});
const divideCmd = (scope: PicolScope): Command => ({
  evaluate: (args) => {
    if (args.length < 3)
      throw new Error(`wrong # args: should be "/ arg arg ?arg ...?"`);
    const result = args.reduce((total, arg, i) => {
      if (i == 0) return 1;
      const v = NumberValue.fromValue(arg).value;
      if (i == 1) return v;
      return total / v;
    }, 0);
    return new NumberValue(result);
  },
});

const compareValuesCmd =
  (name: string, fn: (op1, op2) => boolean) =>
  (scope: PicolScope): Command => ({
    evaluate: (args) => {
      if (args.length != 3)
        throw new Error(`wrong # args: should be "${name} arg arg"`);
      return fn(args[1], args[2]) ? TRUE : FALSE;
    },
  });
const eqCmd = compareValuesCmd(
  "==",
  (op1, op2) => op1 == op2 || op1.asString() == op2.asString()
);
const neCmd = compareValuesCmd(
  "!=",
  (op1, op2) => op1 != op2 && op1.asString() != op2.asString()
);

const compareNumbersCmd =
  (name: string, fn: (op1, op2) => boolean) =>
  (scope: PicolScope): Command => ({
    evaluate: (args) => {
      if (args.length != 3)
        throw new Error(`wrong # args: should be "${name} arg arg"`);
      const op1 = NumberValue.fromValue(args[1]).value;
      const op2 = NumberValue.fromValue(args[2]).value;
      return fn(op1, op2) ? TRUE : FALSE;
    },
  });

const gtCmd = compareNumbersCmd(">", (op1, op2) => op1 > op2);
const geCmd = compareNumbersCmd(">=", (op1, op2) => op1 >= op2);
const ltCmd = compareNumbersCmd("<", (op1, op2) => op1 < op2);
const leCmd = compareNumbersCmd("<=", (op1, op2) => op1 <= op2);

const notCmd = (scope: PicolScope): Command => ({
  evaluate: (args) => {
    if (args.length != 2) throw new Error(`wrong # args: should be "! arg"`);
    const v = BooleanValue.fromValue(args[1]);
    return v.value ? FALSE : TRUE;
  },
});
const andCmd = (scope: PicolScope): Command => ({
  evaluate: (args) => {
    if (args.length < 2)
      throw new Error(`wrong # args: should be "&& arg ?arg ...?"`);
    let result = true;
    for (let i = 1; i < args.length; i++) {
      const v = BooleanValue.fromValue(args[i]).value;
      if (!v) {
        result = false;
        break;
      }
    }

    return result ? TRUE : FALSE;
  },
});
const orCmd = (scope: PicolScope): Command => ({
  evaluate: (args) => {
    if (args.length < 2)
      throw new Error(`wrong # args: should be "|| arg ?arg ...?"`);
    let result = false;
    for (let i = 1; i < args.length; i++) {
      const v = BooleanValue.fromValue(args[i]).value;
      if (v) {
        result = true;
        break;
      }
    }

    return result ? TRUE : FALSE;
  },
});

const ifCmd = (scope: PicolScope): Command => ({
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

const setCmd = (scope: PicolScope): Command => ({
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
  scope: PicolScope;
  argspecs: ArgSpec[];
  body: ScriptValue;
  constructor(scope: PicolScope, argspecs: ArgSpec[], body: ScriptValue) {
    this.scope = scope;
    this.argspecs = argspecs;
    this.body = body;
  }

  evaluate(args: Value[]): Value {
    const scope = new PicolScope(this.scope);
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

const procCmd = (scope: PicolScope): Command => ({
  evaluate: (args) => {
    if (args.length != 4)
      throw new Error('wrong # args: should be "proc name args body"');
    const [, name, _argspecs, body] = args;
    const argspecs = valueToArgspecs(_argspecs);
    scope.commands.set(
      name.asString(),
      (scope: PicolScope) =>
        new ProcCommand(scope, argspecs, body as ScriptValue)
    );
    return new StringValue("");
  },
});

const returnCmd = (scope: PicolScope): Command => ({
  evaluate: (args, flowController) => {
    if (args.length > 2)
      throw new Error('wrong # args: should be "return ?result?"');
    return flowController.interrupt(
      ResultCode.RETURN,
      args.length == 2 ? args[1] : new StringValue("")
    );
  },
});

export function initPicolCommands(scope: PicolScope) {
  scope.commands.set("+", addCmd);
  scope.commands.set("-", subtractCmd);
  scope.commands.set("*", multiplyCmd);
  scope.commands.set("/", divideCmd);
  scope.commands.set("==", eqCmd);
  scope.commands.set("!=", neCmd);
  scope.commands.set(">", gtCmd);
  scope.commands.set(">=", geCmd);
  scope.commands.set("<", ltCmd);
  scope.commands.set("<=", leCmd);
  scope.commands.set("!", notCmd);
  scope.commands.set("&&", andCmd);
  scope.commands.set("||", orCmd);
  scope.commands.set("if", ifCmd);
  scope.commands.set("set", setCmd);
  scope.commands.set("proc", procCmd);
  scope.commands.set("return", returnCmd);
}
