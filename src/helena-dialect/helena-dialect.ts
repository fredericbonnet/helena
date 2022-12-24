/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  breakCmd,
  continueCmd,
  errorCmd,
  evalCmd,
  idemCmd,
  returnCmd,
  tailcallCmd,
  yieldCmd,
} from "./basic-commands";
import { macroCmd } from "./macros";
import { Scope } from "./core";
import { letCmd, setCmd, getCmd, existsCmd, unsetCmd } from "./variables";
import { scopeCmd } from "./scopes";
import { closureCmd } from "./closures";
import { coroutineCmd } from "./coroutines";
import { registerMathCommands } from "./math";
import { registerLogicCommands } from "./logic";
import { argspecCmd } from "./argspecs";
import { aliasCmd } from "./aliases";
import { whenCmd, ifCmd, whileCmd } from "./controls";
import { procCmd } from "./procs";
import { namespaceCmd } from "./namespaces";
import { registerStringCommands } from "./strings";
import { registerListCommands } from "./lists";
import { registerDictCommands } from "./dicts";
import { registerScriptCommands } from "./scripts";
import { registerTupleCommands } from "./tuples";

export { Scope, Variable, CommandValue } from "./core";

export function initCommands(scope: Scope) {
  scope.registerCommand("idem", idemCmd);
  scope.registerCommand("return", returnCmd);
  scope.registerCommand("tailcall", tailcallCmd);
  scope.registerCommand("yield", yieldCmd);
  scope.registerCommand("error", errorCmd);
  scope.registerCommand("break", breakCmd);
  scope.registerCommand("continue", continueCmd);
  scope.registerCommand("eval", evalCmd);

  registerMathCommands(scope);
  registerLogicCommands(scope);

  registerStringCommands(scope);
  registerListCommands(scope);
  registerDictCommands(scope);
  registerTupleCommands(scope);
  registerScriptCommands(scope);

  scope.registerCommand("let", letCmd);
  scope.registerCommand("set", setCmd);
  scope.registerCommand("get", getCmd);
  scope.registerCommand("exists", existsCmd);
  scope.registerCommand("unset", unsetCmd);

  scope.registerCommand("argspec", argspecCmd);

  scope.registerCommand("scope", scopeCmd);
  scope.registerCommand("namespace", namespaceCmd);

  scope.registerCommand("macro", macroCmd);
  scope.registerCommand("closure", closureCmd);
  scope.registerCommand("proc", procCmd);
  scope.registerCommand("coroutine", coroutineCmd);
  scope.registerCommand("alias", aliasCmd);

  scope.registerCommand("while", whileCmd);
  scope.registerCommand("if", ifCmd);
  scope.registerCommand("when", whenCmd);
}
