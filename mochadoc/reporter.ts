import * as mocha from "mocha";
import { closeSuite, openSuite, testResult } from "./writer";

/**
 * Mocha reporter used for doc generation
 *
 * Generate Markdown content for suites and their attached docs
 *
 * @param runner - Mocha runner
 */
function MochadocReporter(runner: mocha.Runner) {
  mocha.reporters.Base.call(this, runner);

  runner.on("suite", function (suite: mocha.Suite) {
    if (suite.root) return;
    openSuite(suite);
  });

  runner.on("suite end", function (suite: mocha.Suite) {
    if (suite.root) return;
    closeSuite(suite);
  });

  runner.on("test end", function (test: mocha.Test) {
    testResult(test);
  });
}

module.exports = MochadocReporter;
