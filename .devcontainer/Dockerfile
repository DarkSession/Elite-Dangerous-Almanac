# Dev container image for the Elite Dangerous Almanac.
# Extends the standard TypeScript + Node base with Bubblewrap, which
# Claude Code uses to sandbox command execution.
FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm

# Install Bubblewrap (bwrap) for sandboxed command execution.
RUN apt-get update \
    && apt-get install -y --no-install-recommends bubblewrap \
    && rm -rf /var/lib/apt/lists/*

# pnpm, through the Corepack that ships with Node. This belongs here rather than in
# `postCreateCommand` because `corepack enable` writes its shims next to the `node`
# binary, which the container's `node` user cannot write to — run after creation it
# fails with EACCES and reports a broken postCreateCommand on every fresh container.
# Build steps run as root, so the shim is created once, at build time.
#
# The shim carries no version of its own: it resolves whatever `packageManager` in
# typescript/package.json names, at the moment pnpm is called from that directory.
# Repinning pnpm therefore needs no change here and no image rebuild.
RUN corepack enable pnpm

RUN (type -p wget >/dev/null || (sudo apt update && sudo apt install wget -y)) \
	&& sudo mkdir -p -m 755 /etc/apt/keyrings \
	&& out=$(mktemp) && wget -nv -O$out https://cli.github.com/packages/githubcli-archive-keyring.gpg \
	&& cat $out | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
	&& sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
	&& sudo mkdir -p -m 755 /etc/apt/sources.list.d \
	&& echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
	&& sudo apt update \
	&& sudo apt install gh -y