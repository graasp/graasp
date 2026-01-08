# -----> Build image
FROM node:24.12.0-bookworm AS build
# update packages and install the minimal init system "dumb-init"
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init

ENV NODE_ENV=production

WORKDIR /usr/src/app

RUN npm install drizzle-kit@latest drizzle-orm@latest pg dotenv --omit=dev

# -----> Production image
# Select a node image with a specific LTS version
# Use the debian based image with the slim variant
FROM node:24.12.0-bookworm-slim

# Set the NODE_ENV to "production" to get the expected behaviour of tools
ENV NODE_ENV=production

# Copy the minimal init system "dumb-init" from the builder image to the production image
COPY --from=build /usr/bin/dumb-init /usr/bin/dumb-init

# Set workdir
WORKDIR /usr/src/app

# Copy files and own them to the node user
COPY --chown=node:node --from=build /usr/src/app/node_modules /usr/src/app/node_modules
COPY --chown=node:node ./src/drizzle /usr/src/app/src/drizzle
COPY --chown=node:node drizzle.config.ts /usr/src/app

# Set user to node, so we do not run things as the root user
USER node

# Start the migration process
CMD ["dumb-init", "npx", "drizzle-kit", "migrate"]
