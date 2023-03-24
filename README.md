# Helena: a minimalist programming language

## What is Helena

Helena is a minimalist programming language inspired by [Tcl](https://tcl.tk/about/language.html), [Unix shells](https://en.wikipedia.org/wiki/Unix_shell), and the Unix philosophy in general. It is designed to be flexible, composable, readable, and easy to use, with a syntax that is close to natural language.

## Key Features

- **Minimalist, unambiguous syntax:** : Helena uses a minimalist syntax that consists primarily of words, white spaces and delimiters, with a strong resemblance to natural language. This syntax is designed to be easy to read, write and understand with no ambiguity.

- **No reserved keywords:** In Helena, words have no intrinsic meaning outside of the dialect they belong to. This allows for a more minimalist syntax and makes it easy to redefine commands programmatically.
- **Flexible dialects:** Helena supports a variety of dialects, each with its own set of commands and semantics. These dialects can be procedural, functional, declarative, object-oriented, or any other programming paradigm that can be expressed as a set of commands.

- **Extensible by design:** Every Helena command is written as a standalone function that takes a list of arguments as input and produces a result code and value as output. This means that there is no fundamental difference between a built-in command provided by a dialect and a user-written command, allowing users to easily create their own commands and extend existing dialects for maximum flexibility.
- **General-purpose glue language:** Commands in Helena can be written in any host language, making it a versatile tool for integrating different software systems, just like Unix shells are glue languages for Unix commands.

## Philosophy

Helena is based on two fundamental concepts:

- A common syntax shared across all dialects
- A collection of dialects, each implementing a specific set of features

_(Note that the above definitions may differ from those used in the field of linguistics, but they better reflect their general understanding in the realm of computing.)_

### Common Syntax

Programming languages typically have a set of reserved keywords with well-defined semantics. Although some keywords may cover the same concept across different languages (e.g. `if`), others may represent distinct concepts (e.g. `case` or `match`). Moreover, different languages may use different keywords to express the same fundamental concept (e.g. `switch`, `case`, or `select`). In some cases, the same keyword may have different meanings depending on the context, as is the case with `static` in C++. The [Language Study](http://rigaux.org/language-study/syntax-across-languages/) site provides a useful comparison of the syntaxes used by different programming languages.

Unlike most programming languages, Helena doesn't define any reserved keywords. Instead, it uses a minimalist syntax that consists primarily of words, whitespaces and delimiters. This syntax is designed to be easy to read and write unambiguously, with a strong resemblance to natural language.

To get an understanding of how Helena looks, you should read the `example/syntax.lna` file, which defines the 14 rules of Helena syntax.

### Dialects

Helena allows several dialects to coexist, each of which having its own set of commands and semantics. Dialects can be implemented in any host language, making it easy to extend the language with new features and functionality.

An alternative way to understand Helena dialects is as domain-specific languages (DSLs) that share a common syntax. In fact, it is entirely possible to implement DSLs that look like any natural human language, minus the typography and punctuation rules. You can also emulate the semantics of any programming language in Helena syntax by just implementing the language keywords as Helena commands.

### Primitive value types

Helena supports the following built-in value types:

- **Nil** singleton
- Boolean **True** and **False** singletons
- **Integer**
- **Number**
- **String**: a sequence of characters
- **List**: a sequence of values
- **Map**: an associative array with string keys and arbitrary values
- **Tuple**: a syntactic groups of values; tuples are structurally identical to lists but their semantics is different
- **Script**: a parsed script and its source
- **Qualified value**: a source value and a sequence of selectors (for example, list index or map keys)

Dialects can also define their own custom types.

## Project Status

Helena is currently in very early alpha stage of development. The current prototype is implemented in TypeScript, with plans to re-implement it in a low-level systems programming language such as C, Rust, Go, or Zig in the medium term. While the current implementation is not production-ready, it has been designed for maximal productivity during the development phase.

From its inception, the Helena project has followed an incremental, [emergent design](https://en.wikipedia.org/wiki/Emergent_Design) philosophy along with the [Test Driven Development](https://en.wikipedia.org/wiki/Test-driven_development) (TDD) process. The test suite (written using [Mocha](https://mochajs.org/)+[Chai](https://www.chaijs.com/)) contains over 2,300 unit tests and runs in just a couple of seconds. This fast feedback loop helped me a lot moving this project forward and I'm convinced the outcome would have been very different with another choice of language.

As a result, the TypeScript code may not appear entirely idiomatic, as the language's specific features were avoided in order to make it easier to port to another host language. Nonetheless, the current prototype has already demonstrated the viability of Helena's core design principles and serves as a foundation for future development. Just don't use it for real-world projects, performances will be horrible!

### Syntax and architecture

The syntax of Helena is complete. It fits in 14 basic rules as described in the `example/syntax.lna` file.

The software architecture has proved its viability during the development of the built-in dialects, but is still subject to change until the final version. It is based on a flexible system of providers for maximal decoupling between the core runtime and the dialects.

### Dialects

Two dialects have been developed to demonstrate the viability of Helena's architecture:

- **Picol**: A very incomplete toy language inspired by by [Picol](https://wiki.tcl-lang.org/page/Picol), itself inspired by Tcl, and written by [Salvatore Sanfilippo](http://invece.org/) (of [Redis](https://en.wikipedia.org/wiki/Redis) fame). This dialect was created at the early stages of the project to validate its core concepts and architecture, and is intended as a proof of concept and a testbed for new ideas rather than for serious development.
- **Helena**: A completely new language with a modern design that includes immutable values, control structures, duck typing, first-class functions, coroutines, and loadable modules. This dialect is still evolving and aims to be feature-complete while maintaining a minimalist philosophy.

Although there is currently no documentation available, the test suite can provide insight into the structure and functionality of each dialect.

## Getting started

This project depends on [Node.js](https://nodejs.org/en) and [npm](https://www.npmjs.com/).

Clone the repository locally:

```bash
git clone https://github.com/fredericbonnet/helena.git
cd helena
git checkout main
```

Install the dependencies:

```bash
npm install
```

Launch the test suite:

```bash
npm test
```

Create a source file `hello.lna`:

```lna
let name "Your Name Here"
idem "Hello, ${name}!"
```

Execute the file:

```bash
npm start hello.lna
```

Start the Helena REPL:

```bash
npm start
```

Type some Helena code:

```lna
let name "Your Name Here"
idem "Hello, ${name}!"
```

Type **Ctrl-C** to exit.

## Visual Studio Code extension

The **Helena Language** extension for Visual Studio Code provides basic syntax coloring for source files with `.lna` and `.helena` extensions. You can install it from the **Extensions** pane within VS Code or from the marketplace:

https://marketplace.visualstudio.com/items?itemName=fredericbonnet.helena-language-support
