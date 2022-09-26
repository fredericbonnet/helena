/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { idemCmd, returnCmd, yieldCmd } from "./basic-commands";
import { macroCmd } from "./macros";
import { Scope } from "./core";
import { letCmd, setCmd, getCmd } from "./variables";
import { scopeCmd } from "./scopes";
import { closureCmd } from "./closures";

export { Scope, Variable, CommandValue } from "./core";

export function initCommands(scope: Scope) {
  scope.registerCommand("idem", idemCmd);
  scope.registerCommand("return", returnCmd);
  scope.registerCommand("yield", yieldCmd);

  scope.registerCommand("let", letCmd);
  scope.registerCommand("set", setCmd);
  scope.registerCommand("get", getCmd);

  scope.registerCommand("scope", scopeCmd);

  scope.registerCommand("macro", macroCmd);
  scope.registerCommand("closure", closureCmd);
}
