import { Token, TokenType } from "./tokenizer";

export enum SyllableType {
  LITERAL,
  LIST,
  BLOCK,
  COMMAND,
}

export class LiteralSyllable {
  type: SyllableType = SyllableType.LITERAL;
  value: string;
}
export class ListSyllable {
  type: SyllableType = SyllableType.LIST;
  value: Script;
  path?;
}
export class BlockSyllable {
  type: SyllableType = SyllableType.BLOCK;
  value: Script;
  path?;
}
export class CommandSyllable {
  type: SyllableType = SyllableType.COMMAND;
  value: Script;
  path?;
}

type SubscriptSyllable = ListSyllable | BlockSyllable | CommandSyllable;
export type Syllable = LiteralSyllable | SubscriptSyllable;

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
    let parent = undefined;
    let script = new Script();
    let command: Command;
    let word: Word;
    let syllable: Syllable;

    const openSubscript = (syllable: SubscriptSyllable) => {
      const subscript = new Script();
      const path = { parent, script, command, word };
      parent = syllable;
      script = subscript;
      command = undefined;
      word = undefined;
      syllable.value = subscript;
      syllable.path = path;
    };
    const closeSubscript = (syllable: SubscriptSyllable) => {
      script = syllable.path.script;
      command = syllable.path.command;
      word = syllable.path.word;
      parent = syllable.path.parent;
      syllable.path = undefined;
    };

    while (!stream.end()) {
      const token = stream.next();
      switch (token.type) {
        case TokenType.WHITESPACE:
        case TokenType.CONTINUATION:
          word = undefined;
          break;

        case TokenType.NEWLINE:
        case TokenType.SEMICOLON:
          command = undefined;
          word = undefined;
          break;

        case TokenType.TEXT:
        case TokenType.ESCAPE:
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
          if (syllable?.type != SyllableType.LITERAL) {
            syllable = new LiteralSyllable();
            syllable.value = token.literal;
            word.syllables.push(syllable);
          } else {
            syllable.value += token.literal;
          }
          break;

        case TokenType.OPEN_LIST:
          if (!command) {
            command = new Command();
            script.commands.push(command);
            word = undefined;
          }
          if (!word) {
            word = new Word();
            command.words.push(word);
          }
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
          if (!command) {
            command = new Command();
            script.commands.push(command);
            word = undefined;
          }
          if (!word) {
            word = new Word();
            command.words.push(word);
          }
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
          if (!command) {
            command = new Command();
            script.commands.push(command);
            word = undefined;
          }
          if (!word) {
            word = new Word();
            command.words.push(word);
          }
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

        default:
          throw new Error("syntax error");
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
