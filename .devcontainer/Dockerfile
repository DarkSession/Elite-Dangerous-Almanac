# Dev container image for the Elite Dangerous Almanac.
# Extends the standard TypeScript + Node base with Bubblewrap, which
# Claude Code uses to sandbox command execution.
FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm

# Install Bubblewrap (bwrap) for sandboxed command execution.
RUN apt-get update \
    && apt-get install -y --no-install-recommends bubblewrap \
    && rm -rf /var/lib/apt/lists/*

# pnpm, through the Corepack that ships with Node. Two things have to be true here,
# and only the first is obvious.
#
# Corepack has to be enabled at build time, because `corepack enable` writes its shim
# next to the `node` binary and the container's `node` user cannot write there — run
# from `postCreateCommand` it fails with EACCES on every fresh container. Build steps
# run as root, so the shim is created once, here.
#
# The base image also preinstalls its own pnpm, into a directory that comes *before*
# Corepack's shim directory on PATH. Left in place that copy keeps winning, and while
# it does honour `packageManager` by delegating to the pinned version, it does not
# check the integrity hash pinned alongside it: a substituted or corrupted pnpm
# download would simply run, where Corepack refuses the same pin with "Mismatch
# hashes". Enabling Corepack without removing it therefore buys the version pin but
# silently drops the guarantee the hash is there for. Corepack's own documentation
# says to uninstall a global package manager before enabling its shims.
#
# The final check is what keeps this honest. It fails the build if `pnpm` resolves to
# anything other than the Corepack shim, so a future base image cannot quietly shadow
# it again — which is exactly how this went unnoticed the first time.
#
# The shim carries no version of its own: it resolves whatever `packageManager` in
# typescript/package.json names, when pnpm is called from that directory. Repinning
# pnpm therefore needs no change here and no image rebuild.
RUN npm uninstall --global pnpm \
    && corepack enable pnpm \
    && test "$(command -v pnpm)" = "$(dirname "$(command -v corepack)")/pnpm"

# The VS Code extension does not put the Codex CLI on PATH for lifecycle commands.
# Plugin management is currently available in the alpha CLI, so pin the exact
# version that provides the commands used by postCreateCommand.
RUN npm install --global @openai/codex \
    && codex plugin --help >/dev/null

RUN (type -p wget >/dev/null || (sudo apt update && sudo apt install wget -y)) \
	&& sudo mkdir -p -m 755 /etc/apt/keyrings \
	&& out=$(mktemp) && wget -nv -O$out https://cli.github.com/packages/githubcli-archive-keyring.gpg \
	&& cat $out | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
	&& sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
	&& sudo mkdir -p -m 755 /etc/apt/sources.list.d \
	&& echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
	&& sudo apt update \
	&& sudo apt install gh -y
