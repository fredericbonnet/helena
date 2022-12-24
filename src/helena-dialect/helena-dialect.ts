/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { macroCmd } from "./macros";
import { Scope } from "./core";
import { scopeCmd } from "./scopes";
import { closureCmd } from "./closures";
import { coroutineCmd } from "./coroutines";
import { argspecCmd } from "./argspecs";
import { aliasCmd } from "./aliases";
import { procCmd } from "./procs";
import { namespaceCmd } from "./namespaces";
import { registerBasicCommands } from "./basic-commands";
import { registerVariableCommands } from "./variables";
import { registerMathCommands } from "./math";
import { registerLogicCommands } from "./logic";
import { registerControlCommands } from "./controls";
import { registerStringCommands } from "./strings";
import { registerListCommands } from "./lists";
import { registerDictCommands } from "./dicts";
import { registerTupleCommands } from "./tuples";
import { registerScriptCommands } from "./scripts";

export { Scope, Variable, CommandValue } from "./core";

export function initCommands(scope: Scope) {
  registerBasicCommands(scope);
  registerVariableCommands(scope);

  registerMathCommands(scope);
  registerLogicCommands(scope);
  registerControlCommands(scope);

  registerStringCommands(scope);
  registerListCommands(scope);
  registerDictCommands(scope);
  registerTupleCommands(scope);
  registerScriptCommands(scope);

  scope.registerCommand("argspec", argspecCmd);

  scope.registerCommand("scope", scopeCmd);
  scope.registerCommand("namespace", namespaceCmd);

  scope.registerCommand("macro", macroCmd);
  scope.registerCommand("closure", closureCmd);
  scope.registerCommand("proc", procCmd);
  scope.registerCommand("coroutine", coroutineCmd);
  scope.registerCommand("alias", aliasCmd);
}
