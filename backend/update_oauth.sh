#!/bin/bash


# replace all <value> blocks with your own value

# create app registration and extract appId
clientid=$1

# generate a UUID for the scope
uuid=$(uuidgen)

# set the API object as a JSON object
api=$(echo '{
    "acceptMappedClaims": null,
    "knownClientApplications": [],
    "oauth2PermissionScopes": [{
    "adminConsentDescription": "User Impersonation",
    "adminConsentDisplayName": "User Impersonation",
    "id": "'$uuid'",
    "isEnabled": true,
    "type": "User",
    "userConsentDescription": null,
    "userConsentDisplayName": null,
    "value": "user_impersonation"
    }],
    "preAuthorizedApplications": [],
    "requestedAccessTokenVersion": 2
}' | jq .)

# Update app registration with App ID URL and api object
az ad app update \
    --id $clientid \
    --identifier-uris api://$clientid \
    --set api="$api"
