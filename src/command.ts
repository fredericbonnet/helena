import { Value } from "./values";

export enum ResultCode {
  OK,
  RETURN,
  BREAK,
  CONTINUE,
  ERROR,
}
export type Result = [ResultCode, Value];
export interface Command {
  execute(args: Value[]): Result;
}
