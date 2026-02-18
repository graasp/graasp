#!/bin/bash

bucketName=graasp
corsConfig='{
    "CORSRules": [
        {
            "AllowedHeaders": [
                "*"
            ],
            "AllowedMethods": [
                "HEAD",
                "PUT",
                "GET",
                "DELETE"
            ],
            "AllowedOrigins": [
                "null"
            ],
            "ExposeHeaders": []
        },
        {
            "AllowedHeaders": [
                "*"
            ],
            "AllowedMethods": [
                "HEAD",
                "GET"
            ],
            "AllowedOrigins": [
                "*"
            ],
            "ExposeHeaders": []
        }
    ]
}'

awslocal s3 mb s3://$bucketName

awslocal s3api put-bucket-cors --bucket $bucketName --cors-configuration "${corsConfig}"
