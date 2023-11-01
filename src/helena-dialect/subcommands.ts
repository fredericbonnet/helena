/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { ERROR, Result, ResultCode } from "../core/results";
import { LIST, ListValue, STR, StringValue, Value } from "../core/values";

export class Subcommands {
  readonly list: ListValue;
  constructor(names: string[]) {
    this.list = LIST(names.map((name) => STR(name)));
  }
  dispatch(
    subcommand: Value,
    handlers: { [name: string]: () => Result }
  ): Result {
    const { data: name, code } = StringValue.toString(subcommand);
    if (code != ResultCode.OK) return ERROR("invalid subcommand name");
    if (!handlers[name]) return ERROR(`unknown subcommand "${name}"`);
    return handlers[name]();
  }
}
