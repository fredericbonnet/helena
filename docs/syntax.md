# The 14 rules of Helena syntax

The syntax of Helena fits in 14 basic rules, expressed in `example/syntax.lna` file and in the sections below.

## 1. Scripts, sentences and words

A script is a sequence of sentences separated by newline '`\n`' or semicolon
'`;`' characters.

A sentence is a sequence of words separated by white space characters:

- space '` `'
- horizontal tabulation '`\t`'
- form feed '`\r`'
- vertical tabulations '`\v`'

```lna
first sentence
second sentence; third sentence

fourth sentence
```

## 2. Continuations

A backslash character '`\`' preceding a newline character '`\n`' is a
continuation. Word separators that immediately follow the continuation are
ignored, and the whole continuation counts as a single space character.

Continuations can be used for sentences that span several lines:

```lna
one two three\
four five \
    six
```

## 3. Escape sequences

A sequence of characters starting with a backslash character '`\`' is an escape
sequence. The whole sequence is substituted with a single character matching
any of the recognized sequences below:

- control characters

  ```lna
  \a # BELL
  \b # BACKSPACE
  \f # FORM FEED (FF)
  \n # END OF LINE (EOL)
  \r # CARRIAGE RETURN (CR)
  \t # HORIZONTAL TABULATION (HT)
  \v # VERTICAL TABULATION (VT)
  ```

- 9-bit octal codepoint

  ```lna
  \123
  ```

- 8-bit hexadecimal codepoint

  ```lna
  \x1a \x2B
  ```

- 16-bit Unicode codepoint

  ```lna
  \u12aB
  ```

- 32-bit Unicode codepoint

  ```lna
  \U1234aBcD
  ```

- for any other character the backslash is simply ignored

  ```lna
  \c\d\e
  ```

## 4. Tuples

A tuple is a sequence of words enclosed between a pair of parentheses '`(`' /
'`)`':

```lna
(one two three)
```

Sentence separators behave as word separators within tuples:

```lna
(one two; three four
five six)
```

Parentheses always come in matching pairs, a left or right parenthesis alone
is invalid. Every open tuple must be closed.

## 5. Expressions

An expression is a script enclosed between a pair of brackets '`[`' / '`]`':

```lna
[first sentence
second sentence; third sentence
]
```

Brackets always come in matching pairs, a left or right bracket alone is
invalid. Every open expression must be closed.

## 6. Blocks

A block is a script enclosed between a pair of braces '`{`' / '`}`':

```lna
{first sentence
second sentence; third sentence
}
```

Braces always come in matching pairs, a left or right brace alone is invalid.
Every open block must be closed.

## 7. Substitutions

A sequence of characters starting with a dollar character '`$`' is a
substitution. The whole sequence is substituted with the resolved value.

Substitutions start with a source, which can be:

- a literal variable name holding the value to substitute:

  ```lna
  $varname
  ```

- a variable name enclosed in a block, holding the value to substitute:

  ```lna
  ${variable name}
  ```

- an expression whose result gives the value to substitute:

  ```lna
  $[cmd arg1 arg2]
  ```

- a tuple of multiple sources to substitute at once:

  ```lna
  $(var1 var2 var3 [cmd arg1 arg2] (var 4 var5))
  ```

Substitutions can be immediately followed by one or several selectors:

- an indexed selector selects a sub-value by an ordinal index, which is the
  result of the provided expression:

  ```lna
  $varname[index] $varname[cmd arg1 arg2]
  ```

- a keyed selector selects a subvalue by one or several successive keys,
  provided as a tuple:

  ```lna
  $varname(key1) $varname(key2 key3)
  ```

- a generic selector selects a sub-value by one or several rules, provided as
  sentences in a block:

  ```lna
  $varname{rule1} $varname{rule2 arg1 arg2; rule3 arg 3}
  ```

Selectors apply sequentially to the previously substituted value:

```lna
$varname(one)[two]{three}
```

If the substitution sequence is prefixed by one or several extra dollar signs
'`$`' and the substituted value is a string or tuple value, then it will
be repeatedly substituted:

```lna
$$varRef $$(var1Ref var2Ref) $$$(varRefRef) $$var(key)[index]
```

In the context of a **substitution word** (see rule 14 below), the prefix can
contain or end with an asterisk character '`*`':

```lna
cmd arg1 $*(var2 var3 var4) arg5
```

## 8. Strings

A string is a sequence of characters enclosed between a pair of double quotes
at word boundaries:

```lna
"string"
```

Strings can contain escape sequences, expressions, and non-tuple
substitution sequences:

```lna
"string \x12 $varname ${variable name}(key)[index1] [
cmd1 arg1 arg2
cmd2 arg3 arg4
] $[a b c](d e)[f]"
```

Every open string must be closed.

## 9. Here-strings

A here-string is a sequence of characters enclosed between matching groups of
3 or more double quotes at word boundaries:

```lna
"""here-string""" """"here-string with 4 quotes""""
```

Here-strings can contain any character, including double quotes, and can span
multiple lines:

```lna
"""
here-string with "quotes" and $special{ [ { \ characters
"""
```

Every open here-string must be closed.

## 10. Tagged strings

A tagged string is a sequence of lines enclosed between two pairs of double
quotes enclosing a tag literal at word boundaries:

```lna
""TAG
here-string with "quotes" and $special{ [ { \ characters
TAG""
```

The characters that follow the opening tag are ignored:

```lna
""TAG ignored characters
content
TAG""
```

Leading characters before the closing tag are ignored as well as all the
leading sequences of the preceding lines:

```lna
""TAG
ignored prefix|content
ignored prefix|TAG""
```

This is useful to remove indentations, line numbers, shell prompts, etc.:

```lna
""TAG
$ prompt

> result
> TAG""
```

Every open tagged string must be closed.

## 11. Line comments

A sequence of hash characters '`#`' at the beginning of a word not followed by
an open brace '`{`' starts a line comment that spans until the end of the
sentence (taking continuations into account).

```lna
this is a sentence # this is a line comment
##this is a comment too \
that spans several lines
word#this is not a comment
```

## 12. Block comments

A sequence of hash characters '`#`' at the beginning of a word followed by an
open brace '`{`' starts a block comment that spans until a matching sequence of
hash characters at the end of a word prefixed by a close brace character '`}`':

```lna
beginning of the sentence #{ this is a block comment }# rest of the sentence
```

Block comments can span several lines:

```lna
beginning of the sentence #{ this is
a block comment that
spans several
lines }# rest of the sentence
```

Block comments can nest if they use the same number of hash characters as the
outermost one:

```lna
word #{ outermost
#{child #{grandchild}#}#

##{ ignored open sequence

ignored close sequence }###
}#
```

Every open block comment must be closed.

## 13. Literals

A sequence of characters that doesn't match any of the above patterns is a
literal.

```lna
literal '-!:/#~|,<@> éèàçù€£ 😀✅⏰⌛
```

## 14. Word structure

Words are composed of one or several of the above sequences. Not all word
structures are valid.

### Root words

A **root word** is made of either:

- one or several literal and escape sequences stitched together
- a string, here-string or tagged string

```lna
literal word\twith\bescapes "string with [expressions] and $variables"
```

### Substitution words

A **substitution word** is made of a single substitution sequence:

```lna
$scalar ${variable name}[index] $(var1 var2){rule} $[cmd a b](key) $\*tuple
```

### Qualified words

A **qualified word** is made of a literal, block, or tuple sequence, followed
by one or several substitution selectors:

```lna
list[index] {variable name}(key) (var1 var2){rule1; rule2}
```

### Compound words

A **compound word** is made of several literal, escape, expression, and
non-tuple substitution sequences stitched together:

```lna
compound$word[index](key)\t[with commands]\tand\u1234escapes
```

### Ignored words

Line and block comments are **ignored words**.

### Invalid words

Any other word structure is invalid.
