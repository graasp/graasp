#!/usr/bin/env bash

function show_help() {
    echo "This script allows to auth to the ECR service"
    echo "Usage: bash docker/auth.sh ECR_URI REGION"
    echo "Arguments:"
    echo "  ECR_URI      URI of the ECR in AWS, example: public.ecr.aws/qzuer78 or a private ECR XXXXXXXX.dkr.ecr.region.amazonaws.com/repo."
    echo "  REGION       REGION of the ECR in AWS, example: eu-central-1"
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

# Get inputs from command line
if [ -z "$2" ]; then
  echo "Missing required REGION argument"
  exit 1
fi
aws_region=$2

# Check if the aws cli is authenticated
aws_identity=$(aws sts get-caller-identity)
if [ $? -eq 0 ]; then
  echo -e "Using AWS identity:\n$aws_identity"
else
  echo "AWS CLI is not authenticated, please ensure the cli is authenticated before running this script";
  exit 1
fi

if [[ $aws_ecr_uri == public.ecr* ]]; then
  echo "Using Public ECR"
  ecr_credentials=$(aws ecr-public get-login-password --region us-east-1)
else
  echo "Using Private ECR"
  ecr_credentials=$(aws ecr get-login-password --region $aws_region)
fi

if [ -z $ecr_credentials ]; then
  echo "The AWS credentials were not received"
  echo "Please check that the ECR_URI is correct and that you are logged into an account or role that is allowed to use that ECR"
  exit 1
fi
# login the docker client with the ECR credentials derived from the currently authenticated user
echo $ecr_credentials | docker login --username AWS --password-stdin $aws_ecr_uri
