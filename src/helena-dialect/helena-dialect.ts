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
import { letCmd, setCmd, getCmd } from "./variables";
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
import { stringCmd } from "./strings";
import { listCmd } from "./lists";

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

  scope.registerCommand("string", stringCmd);
  scope.registerCommand("list", listCmd);

  scope.registerCommand("let", letCmd);
  scope.registerCommand("set", setCmd);
  scope.registerCommand("get", getCmd);

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
