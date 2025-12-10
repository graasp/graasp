#!/usr/bin/env bash

set -euo pipefail
# -e: exit on any command with a non-zero status
# -u: treat unset variables as errors
# -o pipefail: fail a pipeline if any command in it fails

# Optional: make errors show the line number and command that failed
trap 'echo "Error on line $LINENO: ${BASH_COMMAND}" >&2' ERR

function show_help() {
    echo "This script allows to build and push the docker images for the core and the migration"
    echo "Usage: bash docker/build.sh ECR_URI VERSION"
    echo "Arguments:"
    echo "  ECR_URI      URI of the ECR in AWS, example: public.ecr.aws/qzuer78 or a private ECR XXXXXXXX.dkr.ecr.region.amazonaws.com/repo."
    echo "  VERSION      The version that is deployed, should be a semantic version i.e v1.45.8"
}

# Check if no arguments are provided
if [ "$#" -eq 0 ]; then
    show_help
    exit 1
fi

# Get inputs from command line
if [ -z "$1" ]; then
  echo "Missing required ECR_URI argument"
  exit 1
fi
aws_ecr_uri=$1

if [ -z "$2" ]; then
  echo "Missing required VERSION argument"
  exit 1
fi
tag_version=$2

# define the image tags including the ecr uri
core_tag_short="graasp:core-$tag_version"
core_tag_full="$aws_ecr_uri/$core_tag_short"

workers_tag_short="graasp:workers-$tag_version"
workers_tag_full="$aws_ecr_uri/$workers_tag_short"

migrate_tag_short="graasp:migrate-$tag_version"
migrate_tag_full="$aws_ecr_uri/$migrate_tag_short"

docker build -t $core_tag_full -f docker/Dockerfile --build-arg APP_VERSION=$tag_version --build-arg BUILD_TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%S) --secret id=SENTRY_AUTH_TOKEN .
docker push $core_tag_full

docker build -t $workers_tag_full -f docker/workers.Dockerfile --build-arg APP_VERSION=$tag_version --build-arg BUILD_TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%S) .
docker push $workers_tag_full

docker build -t $migrate_tag_full -f docker/migrate.Dockerfile .
docker push $migrate_tag_full
