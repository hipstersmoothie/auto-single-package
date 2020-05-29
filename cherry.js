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

      if (bump === SEMVER.patch && headLabels.includes(CHERRY_PICK_LABEL)) {
        const branch = await getCurrentBranch();
        const commitToCherryPick = await auto.git.getSha();

        // We don't care about the version that just published so get rid of it
        await execPromise("git", ["reset", "--hard", "HEAD"]);
        // Switch to master
        await execPromise("git", ["checkout", auto.baseBranch]);
        // Cherry pick the commit
        await execPromise("git", ["cherry-pick", commitToCherryPick]);
        // Push the new commit
        await execPromise("git", ["push", auto.remote, auto.baseBranch]);
        // Switch back to starting branch
        await execPromise("git", ["checkout", branch]);
      }
    });
  }
};
