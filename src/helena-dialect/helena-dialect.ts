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
import { ensembleCmd } from "./ensembles";
import { registerModuleCommands } from "./modules";
import { registerNumberCommands } from "./numbers";

export { Scope } from "./core";

export function initCommands(scope: Scope, rootDir?: string) {
  registerBasicCommands(scope);
  registerVariableCommands(scope);

  registerMathCommands(scope);
  registerLogicCommands(scope);
  registerControlCommands(scope);

  registerNumberCommands(scope);
  registerStringCommands(scope);
  registerListCommands(scope);
  registerDictCommands(scope);
  registerTupleCommands(scope);
  registerScriptCommands(scope);

  scope.registerNamedCommand("argspec", argspecCmd);

  scope.registerNamedCommand("scope", scopeCmd);
  scope.registerNamedCommand("namespace", namespaceCmd);
  scope.registerNamedCommand("ensemble", ensembleCmd);

  registerModuleCommands(scope, rootDir || process.cwd());

  scope.registerNamedCommand("macro", macroCmd);
  scope.registerNamedCommand("closure", closureCmd);
  scope.registerNamedCommand("proc", procCmd);
  scope.registerNamedCommand("coroutine", coroutineCmd);
  scope.registerNamedCommand("alias", aliasCmd);
}
