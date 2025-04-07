#!/usr/bin/env bash

function show_help() {
    echo "This script allows to build and push the docker images for the core and the migration"
    echo "Usage: bash docker/build.sh ECR_URI VERSION"
    echo "Arguments:"
    echo "  ECR_URI      URI of the ECR in AWS, example: public.ecr.aws/qzuer78"
    echo "  VERSION      The version that is deployed, should be a semantic version i.e 1.45.8"
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

# Check if the aws cli is authenticated
aws_identity=$(aws sts get-caller-identity)
if [ $? -eq 0 ]; then
  echo -e "Using AWS identity:\n$aws_identity"
else
  echo "AWS CLI is not authenticated, please ensure the cli is authenticated before running this script";
  exit 1
fi

ecr_credentials=$(aws ecr-public get-login-password --region us-east-1)
if [ -z $ecr_credentials ]; then
  echo "The AWS credentials were not received"
  echo "Please check that the ECR_URI is correct and that you are logged into an account or role that is allowed to use that ECR"
  exit 1
fi
# login the docker client with the ECR credentials derived from the currently authenticated user
echo $ecr_credentials | docker login --username AWS --password-stdin $aws_ecr_uri

# define the image tags including the ecr uri
core_tag_short="graasp:core-$tag_version"
core_tag_full="$aws_ecr_uri/$core_tag_short"

migrate_tag_short="graasp:migrate-$tag_version"
migrate_tag_full="$aws_ecr_uri/$migrate_tag_short"

docker build -t $core_tag_full -f docker/Dockerfile --build-arg APP_VERSION=$tag_version .
docker push $core_tag_full

docker build -t $migrate_tag_full -f docker/migrate.Dockerfile .
docker push $migrate_tag_full
