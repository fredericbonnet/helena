/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { ERROR, Result, ResultCode } from "../core/results";
import { LIST, ListValue, STR, StringValue, Value } from "../core/values";

export const INVALID_SUBCOMMAND_ERROR = () => ERROR("invalid subcommand name");
export const UNKNOWN_SUBCOMMAND_ERROR = (name: string) =>
  ERROR(`unknown subcommand "${name}"`);

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
    if (code != ResultCode.OK) return INVALID_SUBCOMMAND_ERROR();
    if (!handlers[name]) return UNKNOWN_SUBCOMMAND_ERROR(name);
    return handlers[name]();
  }
}
