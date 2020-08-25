// @flow

import {
  LoggingTaskReporter,
  SilentTaskReporter,
  formatTimeElapsed,
  startMessage,
  finishMessage,
} from "./taskReporter";

describe("util/taskReporter", () => {
  describe("formatTimeElapsed", () => {
    function tc(expected, ms) {
      it(`works for ${expected}`, () => {
        expect(formatTimeElapsed(ms)).toEqual(expected);
      });
    }
    tc("0ms", 0);
    tc("50ms", 50);
    tc("999ms", 999);
    const secs = 1000;
    tc("1s", 1 * secs + 400);
    tc("2s", 1 * secs + 600);
    tc("59s", 59 * secs);
    const mins = secs * 60;
    tc("1m 3s", mins + 3 * secs);
    tc("59m 59s", 59 * mins + 59 * secs);
    const hours = mins * 60;
    tc("1h 0m", hours);
    tc("1h 3m", hours + mins * 3);
    tc("23h 59m", 23 * hours + 59 * mins);
    const days = 24 * hours;
    tc("1d 0h", days);
    tc("555d 23h", 555 * days + 23 * hours);
  });

  describe("LoggingTaskReporter", () => {
    class TestCase {
      _time: number;
      messages: string[];
      taskReporter: LoggingTaskReporter;

      constructor() {
        this._time = 0;
        this.messages = [];
        const logMock = (x) => {
          this.messages.push(x);
        };
        const timeMock = () => this._time;
        this.taskReporter = new LoggingTaskReporter({
          consoleLog: logMock,
          getTime: timeMock,
          scopedPrefix: "scope/mock",
        });
      }
      start(task: string) {
        this.taskReporter.start(task);
        return this;
      }
      finish(task: string) {
        this.taskReporter.finish(task);
        return this;
      }
      time(t: number) {
        this._time = t;
        return this;
      }
    }

    it("errors when finishing an unregistered task", () => {
      const fail = () => new TestCase().finish("foo");
      expect(fail).toThrowError("task scope/mock: foo not registered");
    });
    it("errors when starting a task twice", () => {
      const fail = () => new TestCase().start("foo").start("foo");
      expect(fail).toThrowError("task scope/mock: foo already registered");
    });
    it("errors when finishing a task twice", () => {
      const fail = () =>
        new TestCase().start("foo").finish("foo").finish("foo");
      expect(fail).toThrowError("task scope/mock: foo not registered");
    });

    it("works for a task that immediately finishes", () => {
      const {messages} = new TestCase().start("foo").finish("foo");
      expect(messages).toEqual([startMessage("foo"), finishMessage("foo", 0)]);
    });

    it("works when two tasks are started, then one finishes", () => {
      const {messages} = new TestCase()
        .start("foo")
        .start("bar")
        .time(200)
        .finish("foo");
      expect(messages).toEqual([
        startMessage("foo"),
        startMessage("bar"),
        finishMessage("foo", 200),
      ]);
    });
    it("works when a task is started, finished, and re-started", () => {
      const {messages} = new TestCase()
        .start("foo")
        .finish("foo")
        .start("foo")
        .time(200)
        .finish("foo");
      expect(messages).toEqual([
        startMessage("foo"),
        finishMessage("foo", 0),
        startMessage("foo"),
        finishMessage("foo", 200),
      ]);
    });
  });

  describe("SilentTaskReporter", () => {
    it("errors when starting a task twice", () => {
      const fail = () => new SilentTaskReporter().start("foo").start("foo");
      expect(fail).toThrow("task foo already active");
    });
    it("errors when finishing a task twice", () => {
      const fail = () =>
        new SilentTaskReporter().start("foo").finish("foo").finish("foo");
      expect(fail).toThrow("task foo not active");
    });
    it("errors when finishing an unstarted test", () => {
      const fail = () => new SilentTaskReporter().finish("foo");
      expect(fail).toThrow("task foo not active");
    });
    it("works for starting a task", () => {
      const reporter = new SilentTaskReporter().start("foo");
      expect(reporter.entries()).toEqual([{type: "START", taskId: "foo"}]);
      expect(reporter.activeTasks()).toEqual(["foo"]);
    });
    it("works for starting and finishing a task", () => {
      const reporter = new SilentTaskReporter().start("foo").finish("foo");
      expect(reporter.entries()).toEqual([
        {type: "START", taskId: "foo"},
        {type: "FINISH", taskId: "foo"},
      ]);
      expect(reporter.activeTasks()).toEqual([]);
    });
    it("works for starting two tasks and finishing one", () => {
      const reporter = new SilentTaskReporter()
        .start("foo")
        .start("bar")
        .finish("foo");
      expect(reporter.entries()).toEqual([
        {type: "START", taskId: "foo"},
        {type: "START", taskId: "bar"},
        {type: "FINISH", taskId: "foo"},
      ]);
      expect(reporter.activeTasks()).toEqual(["bar"]);
    });
    it("doesn't emit anything to the console", () => {
      let usedConsole = false;
      jest.spyOn(console, "log").mockImplementation(() => {
        usedConsole = true;
      });
      jest.spyOn(console, "error").mockImplementation(() => {
        usedConsole = true;
      });
      jest.spyOn(console, "warn").mockImplementation(() => {
        usedConsole = true;
      });
      new SilentTaskReporter().start("foo").start("bar").finish("foo");
      expect(usedConsole).toEqual(false);
    });
  });
});
