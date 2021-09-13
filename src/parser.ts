import { Token, TokenType } from "./tokenizer";

export enum SyllableType {
  LITERAL,
  LIST,
  BLOCK,
  COMMAND,
  STRING,
}

export class LiteralSyllable {
  type: SyllableType = SyllableType.LITERAL;
  value: string;
}
export class ListSyllable {
  type: SyllableType = SyllableType.LIST;
  subscript: Script;
  path?;
}
export class BlockSyllable {
  type: SyllableType = SyllableType.BLOCK;
  subscript: Script;
  path?;
}
export class CommandSyllable {
  type: SyllableType = SyllableType.COMMAND;
  subscript: Script;
  path?;
}
export class StringSyllable {
  type: SyllableType = SyllableType.STRING;
  syllables: Syllable[];
  path?;
}

type SubscriptSyllable = ListSyllable | BlockSyllable | CommandSyllable;
type RecursiveSyllable = SubscriptSyllable | StringSyllable;
export type Syllable = LiteralSyllable | RecursiveSyllable;

export class Word {
  syllables: Syllable[] = [];
}
export class Command {
  words: Word[] = [];
}
export class Script {
  commands: Command[] = [];
}

export class Parser {
  parse(tokens: Token[]) {
    let stream = new TokenStream(tokens);
    let mode = "script";
    let parent = undefined;
    let script = new Script();
    let command: Command;
    let word: Word;
    let syllable: Syllable;

    const pushPath = (syllable: RecursiveSyllable, path) => {
      syllable.path = { mode, parent, script, command, word };
      ({ mode, parent, script, command, word } = path);
    };
    const popPath = (syllable: RecursiveSyllable) => {
      ({ mode, parent, script, command, word } = syllable.path);
      syllable.path = undefined;
    };

    const openSubscript = (syllable: SubscriptSyllable) => {
      syllable.subscript = new Script();
      pushPath(syllable, {
        mode: "script",
        parent: syllable,
        script: syllable.subscript,
        command: undefined,
        word: undefined,
      });
    };
    const closeSubscript = (syllable: SubscriptSyllable) => {
      popPath(syllable);
    };
    const openString = (syllable: StringSyllable) => {
      syllable.syllables = [];
      pushPath(syllable, {
        mode: "string",
        parent: syllable,
        script,
        command,
        word,
      });
      mode = "string";
    };
    const closeString = (syllable: StringSyllable) => {
      popPath(syllable);
    };

    const ensureWord = () => {
      if (!command) {
        command = new Command();
        script.commands.push(command);
        word = undefined;
      }
      if (!word) {
        word = new Word();
        command.words.push(word);
        syllable = undefined;
      }
    };
    const addLiteral = (value: string) => {
      if (syllable?.type == SyllableType.LITERAL) {
        (syllable as LiteralSyllable).value += value;
      } else {
        syllable = new LiteralSyllable();
        (syllable as LiteralSyllable).value = value;
        word.syllables.push(syllable);
      }
    };
    const addStringSequence = (value: string) => {
      if (syllable?.type == SyllableType.LITERAL) {
        (syllable as LiteralSyllable).value += value;
      } else {
        syllable = new LiteralSyllable();
        (syllable as LiteralSyllable).value = value;
        parent.syllables.push(syllable);
      }
    };
    const closeWord = () => {
      word = undefined;
      mode = "script";
    };
    const closeCommand = () => {
      closeWord();
      command = undefined;
    };

    while (!stream.end()) {
      const token = stream.next();
      switch (mode) {
        case "script":
          switch (token.type) {
            case TokenType.WHITESPACE:
            case TokenType.CONTINUATION:
              closeWord();
              break;

            case TokenType.NEWLINE:
            case TokenType.SEMICOLON:
              closeCommand();
              break;

            case TokenType.TEXT:
            case TokenType.ESCAPE:
              ensureWord();
              addLiteral(token.literal);
              break;

            case TokenType.OPEN_LIST:
              ensureWord();
              syllable = new ListSyllable();
              word.syllables.push(syllable);
              openSubscript(syllable);
              break;

            case TokenType.CLOSE_LIST:
              if (!parent) {
                throw new Error("unmatched right parenthesis");
              }
              closeSubscript(parent);
              break;

            case TokenType.OPEN_BLOCK:
              ensureWord();
              syllable = new BlockSyllable();
              word.syllables.push(syllable);
              openSubscript(syllable);
              break;

            case TokenType.CLOSE_BLOCK:
              if (!parent) {
                throw new Error("unmatched right brace");
              }
              closeSubscript(parent);
              break;

            case TokenType.OPEN_COMMAND:
              ensureWord();
              syllable = new CommandSyllable();
              word.syllables.push(syllable);
              openSubscript(syllable);
              break;

            case TokenType.CLOSE_COMMAND:
              if (!parent) {
                throw new Error("unmatched right bracket");
              }
              closeSubscript(parent);
              break;

            case TokenType.STRING_DELIMITER:
              if (word) {
                throw new Error("unexpected string delimiter");
              }
              ensureWord();
              syllable = new StringSyllable();
              word.syllables.push(syllable);
              openString(syllable);
              break;

            default:
              throw new Error("syntax error");
          }
          break;

        case "string":
          switch (token.type) {
            case TokenType.STRING_DELIMITER:
              closeString(parent);
              break;

            default:
              addStringSequence(token.literal);
          }
          break;
      }
    }

    if (parent) {
      switch (parent.type) {
        case SyllableType.LIST:
          throw new Error("unmatched left parenthesis");
        case SyllableType.BLOCK:
          throw new Error("unmatched left brace");
        case SyllableType.COMMAND:
          throw new Error("unmatched left bracket");
        case SyllableType.STRING:
          throw new Error("unmatched string delimiter");
        default:
          throw new Error("unterminated script");
      }
    }

    return script;
  }
}

class TokenStream {
  tokens: Token[];
  index: number = 0;
  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  end() {
    return this.index >= this.tokens.length;
  }
  next() {
    return this.tokens[this.index++];
  }
  current() {
    return this.tokens[this.index];
  }
  peek() {
    return this.tokens[this.index + 1];
  }
}
