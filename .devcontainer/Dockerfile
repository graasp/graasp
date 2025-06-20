# Update the VARIANT arg in docker-compose.yml to pick a Node version: 22, 24
ARG VARIANT=22
FROM mcr.microsoft.com/vscode/devcontainers/javascript-node:${VARIANT}

# Update args in docker-compose.yaml to set the UID/GID of the "node" user.
ARG USER_UID=1000
ARG USER_GID=$USER_UID
RUN if [ "$USER_GID" != "1000" ] || [ "$USER_UID" != "1000" ]; then \
  groupmod --gid $USER_GID node \
  && usermod --uid $USER_UID --gid $USER_GID node \
  && chown -R $USER_UID:$USER_GID /home/node \
  && chown -R $USER_UID:root /usr/local/share/nvm /usr/local/share/npm-global; \
  fi

# [Optional] Uncomment this section to install additional OS packages.
# RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
#     && apt-get -y install --no-install-recommends <your-package-list-here>

# install GNUPG to allow signing commits with GPG signature
RUN apt-get update && apt-get install gnupg2 -y
# install psql to connect to the database
RUN apt-get update && apt-get install postgresql-client -y

# [Optional] Uncomment if you want to install an additional version of node using nvm
# ARG EXTRA_NODE_VERSION=10
# RUN su node -c "source /usr/local/share/nvm/nvm.sh && nvm install ${EXTRA_NODE_VERSION}"

# [Optional] Uncomment if you want to install more global node packages
# RUN sudo -u node npm install -g <your-package-list-here>

USER node

RUN echo "source /usr/share/bash-completion/completions/git" >> ~/.bashrc
