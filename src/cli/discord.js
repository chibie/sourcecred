// @flow

import * as Common from "./common";
import {type Command} from "./command";
import {LoggingTaskReporter} from "../util/taskReporter";
import {DataDirectory} from "../backend/dataDirectory";
import Loader from "../plugins/discord/loader";

function die(std, message) {
  std.err("fatal: " + message);
  std.err("fatal: run 'sourcecred help discord' for help");
  return 1;
}

const discord: Command = async (args, std) => {
  if (args.length !== 1) {
    return die(std, "Expected one positional argument (or --help).");
  }
  const [guildId] = args;

  const taskReporter = new LoggingTaskReporter();
  const dir = new DataDirectory(Common.sourcecredDirectory());
  const token = process.env.SOURCECRED_DISCORD_TOKEN || null;
  if (!token) {
    throw new Error("Expecting a SOURCECRED_DISCORD_TOKEN");
  }

  await Loader.updateMirror(guildId, token, dir, taskReporter);
  const wg = await Loader.createGraph(guildId, dir);
  console.log(wg.graph._nodes);
  return 0;
};

export default discord;
