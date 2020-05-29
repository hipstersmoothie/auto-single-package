/* eslint-disable import/no-extraneous-dependencies */

const { SEMVER, execPromise, getCurrentBranch } = require("@auto-canary/core");

const CHERRY_PICK_LABEL = "bug-fix";

module.exports = class NextCherryPickPlugin {
  constructor() {
    this.name = "next-cherry-pick";
  }

  /**
   * Setup the plugin
   *
   * @param {import('@auto-canary/core').default} auto
   */
  apply(auto) {
    auto.hooks.modifyConfig.tap(this.name, (config) => {
      if (!config.labels.find((l) => l.name === CHERRY_PICK_LABEL)) {
        config.labels.push({
          name: CHERRY_PICK_LABEL,
          description:
            "A bug-fix on the 'next' branch that should be cherry-picked to master",
          releaseType: "patch",
        });
      }

      return config;
    });

    auto.hooks.next.tapPromise(this.name, async (_, bump, { commits }) => {
      const headLabels = commits[0] ? commits[0].labels : [];

      auto.logger.log.info(
        `Labels found on the last commit: ${headLabels.join(", ")}`
      );

      if (bump === SEMVER.patch && headLabels.includes(CHERRY_PICK_LABEL)) {
        const branch = await getCurrentBranch();
        const commitToCherryPick = await auto.git.getSha();

        auto.logger.log.info("Resetting all uncommitted changes to repo...");
        // We don't care about the version that just published so get rid of it
        await execPromise("git", ["reset", "--hard", "HEAD"]);
        auto.logger.log.info("Switching to master...");
        await execPromise("git", ["checkout", auto.baseBranch]);
        auto.logger.log.info("Cherry picking the commit...");
        await execPromise("git", [
          "cherry-pick",
          commitToCherryPick,
          "-m",
          1,
        ]);
        auto.logger.log.info("Pushing the new commit...");
        await execPromise("git", ["push", auto.remote, auto.baseBranch]);
        auto.logger.log.info(`Switching back to "${branch}"...`);
        await execPromise("git", ["checkout", branch]);

        auto.logger.log.success("Updated master with bug-fix!");
      } else {
        auto.logger.log.info(
          `Did not detect patch with ${CHERRY_PICK_LABEL}, no updates to master pushed.`
        );
      }
    });
  }
};
