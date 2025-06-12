FROM node:22.15-bookworm AS base


# -------------------------------------------------------
# get the init system
FROM base AS tools

# update packages and install the minimal init system "dumb-init"
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init


# -------------------------------------------------------
FROM base AS build

WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
# We need a specific command because we need to copy the folder with it, not just the content.
COPY .yarn/releases ./.yarn/releases/
CMD sleep 1h
RUN yarn set version berry && yarn install --immutable

ENV NODE_ENV=production
COPY . .
RUN yarn build-ts

# Delete old node_modules and re-install only production dependencies
RUN rm -rf node_modules && yarn workspaces focus --all --production


# -------------------------------------------------------
# Final step that will run the application
FROM node:22.15-bookworm-slim AS runner

# Variable passed as a build arg. Represents the tag or git sha used for the build
ARG APP_VERSION
# Set APP_VERSION as ENV variable from ARG passed at build step
ENV APP_VERSION=${APP_VERSION:-latest}
# Set BUILD_TIMESTAMP as ENV variable from ARG passed at build step
ARG BUILD_TIMESTAMP
ENV BUILD_TIMESTAMP=${BUILD_TIMESTAMP:-not-provided}
# Set NODE_ENV to production so we don't trigger .husky/install.mjs
ENV NODE_ENV=production

WORKDIR /app

# Copy the installed dumb-init system from build image
COPY --from=tools /usr/bin/dumb-init /usr/bin/dumb-init

# Copy the dependencies and compiled server code
COPY --chown=node:node --from=build ./app/node_modules ./node_modules
COPY --chown=node:node --from=build ./app/dist ./dist

# Set user to be non-root node
USER node

CMD ["dumb-init", "node", "dist/workers/entrypoint.js"]
