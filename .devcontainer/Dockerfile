# Dev container image for the Elite Dangerous Almanac.
# Extends the standard TypeScript + Node base with Bubblewrap, which
# Claude Code uses to sandbox command execution.
FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm

# Install Bubblewrap (bwrap) for sandboxed command execution.
RUN apt-get update \
    && apt-get install -y --no-install-recommends bubblewrap \
    && rm -rf /var/lib/apt/lists/*
