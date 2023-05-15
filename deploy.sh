#! /bin/bash

# This can be run from Azure Cloud Shell
# This script provisions Azure Resources such as 
# Azure Function App,
# Azure Storage with static website enabled,
# Azure Storage.
# It also deploys Azure Function App Code and confiures the App Settings to use the provided Open AI Endpoint and Open AI Key.
# 


printf "This can be run from Azure Cloud Shell\n \
This script provisions Azure Resources such as\n \
Azure Function App and Azure Storage with static website enabled.\n\
\nIt also deploys Azure Function App Code and confiures the App Settings to use the provided Open AI Endpoint and Open AI Key.\n"
read -p "Press enter to continue...."


RESOURCE_GROUP=$1
REGION=$2
OPENAI_EP=$3
OPENAI_KEY=$4
OPENAI_DEPLOYMENT_NAME=$5
FUNC_NAME=$6
FUNC_STORAGE=$7
Azure_CosmosDB_ConnectionString=$8



while [ -z "${RESOURCE_GROUP}" ]
do
    echo "Please provide resource group name:"
    read RESOURCE_GROUP
done

while [ -z "${REGION}" ]
do
    echo "Please provide region as in westus, eastus, etc:"
    read REGION
done


while [ -z "${OPENAI_EP}" ]
do
    echo "Please provide Azure Open AI Endpoint:"
    read OPENAI_EP
done


while [ -z "${OPENAI_KEY}" ]
do
    echo "Please provide Azure Open AI Key:"
    read OPENAI_KEY
done

while [ -z "${OPENAI_DEPLOYMENT_NAME}" ]
do
    echo "Please provide Azure Open AI Deployment Name:"
    read OPENAI_DEPLOYMENT_NAME
done

while [ -z "${FUNC_NAME}" ] || [ ${#FUNC_NAME} -gt 14 ]
do
    echo "Please provide Azure Function App Name. max length 14 characters:"
    read FUNC_NAME

    if [ ${#FUNC_NAME} -gt 14 ]
    then
        echo "Function App Name should be less than 14 characters"
        FUNC_NAME=""
    fi
done

while [ -z "${Azure_CosmosDB_ConnectionString}" ]
do
    echo "Please provide Azure Cosmos DB Connection String:"
    read Azure_CosmosDB_ConnectionString
done



# check if FUNC_STORAGE contains only alphanumeric characters

check_variable_name() {
  local name=$1
  if [[ ! "$name" =~ ^[[:alnum:]]+$ ]]; then
    #echo "$name must be alphanumeric" >&2
    return 1
  fi
  local len=${#name}
  if (( len < 3 || len > 24 )); then
    #echo "$name length must be between 3 and 24 characters" >&2
    return 1
  fi
  return 0
}


while [ -z "${FUNC_STORAGE}" ]
do
    echo "Please provide Storage Account name for Func App. Storage Name must be alphanumeric and between 3 and 24 characters:"
    read FUNC_STORAGE
    if !(check_variable_name "$FUNC_STORAGE"); then
        echo "Storage Account name must be alphanumeric and between 3 and 24 characters" >&2
        FUNC_STORAGE=""
    fi

done





func_prefix="funcchatapi$FUNC_NAME"
FUNC_NAME=$func_prefix

WEB_APP_NAME="azurechatgpt$FUNC_NAME"

#check if backend directory exists
if [ ! -d "backend" ]
then
    printf "\nError: backend directory not found. Exiting...\n"
    exit 1
fi



RG_EXISTS=$(az group exists -g $RESOURCE_GROUP | jq -r '.') 
if [ $RG_EXISTS = "false" ]
then
    printf "\nCreating Resource Group...\n" 
    az group create -n $RESOURCE_GROUP -l $REGION
fi

if [ $? -ne 0 ]
then
    printf "\nError creating resource group. Exiting...\n"
    exit 1
fi

#check if storage account exists

storage_name=$(az resource list -g $RESOURCE_GROUP | jq -r --arg FUNC_STORAGE $FUNC_STORAGE '.[] | select(.type == "Microsoft.Storage/storageAccounts") | select(.name = $FUNC_STORAGE) | .name')

if [[ $storage_name = $FUNC_STORAGE ]]
then
    printf "\nStorage Account $storage_name already exists.\n"
else
    printf "\nCreating Storage account - $FUNC_STORAGE...\n"
    az storage account create --name $FUNC_STORAGE --location $REGION --resource-group $RESOURCE_GROUP --sku Standard_LRS
fi  


if [ $? -ne 0 ]
then
    printf "\nError creating storage account. Exiting...\n"
    exit 1
fi

#check if function app exists
printf "\nCreating Function App $FUNC_NAME...\n"
function_name=$(az resource list -g $RESOURCE_GROUP | jq -r --arg FUNC_NAME $FUNC_NAME '.[] | select(.type == "Microsoft.Web/sites") | select(.name = $FUNC_NAME) | .name')


if [[ $function_name = $FUNC_NAME ]]
then
    printf "\nFunction App $function_name already exists.\n"
else
    
    az functionapp create --name $FUNC_NAME --storage-account $FUNC_STORAGE --consumption-plan-location $REGION --resource-group $RESOURCE_GROUP --os-type Linux --runtime python --runtime-version 3.9 --functions-version 4

fi



if [ $? -ne 0 ]
then
    printf "\nError creating function app. Exiting...\n"
    exit 1
fi

az functionapp config appsettings set --name $FUNC_NAME --resource-group $RESOURCE_GROUP --settings OPENAI_RESOURCE_ENDPOINT=$OPENAI_EP OPENAI_API_KEY=$OPENAI_KEY OPENAI_API_VERSION="2023-03-15-preview" DEPLOYMENT_NAME=$OPENAI_DEPLOYMENT_NAME AzureCosmosDBConnectionString=$Azure_CosmosDB_ConnectionString


if [ $? -ne 0 ]
then
    printf "\nError configuring function app settings. Exiting...\n"
    exit 1
fi


cd backend

while true;do
    function_name=$(az resource list -g $RESOURCE_GROUP | jq -r --arg FUNC_NAME $FUNC_NAME '.[] | select(.type == "Microsoft.Web/sites") | select(.name = $FUNC_NAME) | .name')
    if [[ $function_name = $FUNC_NAME ]]
    then
        break
    else
        printf "\nWaiting for Function App to be created...\n"
        sleep 10
    fi
done



printf "\nDeploying Function App Code...\n"
func azure functionapp publish $FUNC_NAME --force --python

if [ $? -ne 0 ]
then
    printf "\nError deploying function app code. Exiting...\n"
    exit 1
fi

cd ..

printf "\nCreating Azure Active Directory App Registration...\n"

#tenant ID
tenantId=$(az account show | jq -r .tenantId)

#create func app app id
API_App_ID=$(az ad app create --display-name $FUNC_NAME | jq  -r .appId)
az ad sp create --id $API_App_ID

#create API URI
az ad app update --id $API_App_ID --set identifierUris="['api://$API_App_ID']"

# get API Identifier URI
API_APP_IDENTIFIER_URI=$(az ad app show --id $API_App_ID  | jq -r .identifierUris[0])
printf "\nAPI Identifier URI: $API_APP_IDENTIFIER_URI\n"

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
    --id $API_App_ID \
    --identifier-uris api://$API_App_ID \
    --set api="$api"

#enable AAD auth on Azure function
az webapp auth update --name $FUNC_NAME --resource-group $RESOURCE_GROUP --enabled true --action Return401 

#Add Identity provider
az webapp auth microsoft update  -g $RESOURCE_GROUP --name $FUNC_NAME \
  --client-id $API_App_ID  \
  --issuer https://sts.windows.net/$tenantId/
#if [ $? -ne 0 ]
#then
#    printf "\nError creating App Registrations. Exiting...\n"
#    exit 1
#fi

printf "\nCreating Azure Active Directory App Registration for Web App...\n"

#create web app app id
Web_App_ID=$(az ad app create --display-name $WEB_APP_NAME  | jq -r .appId)
az ad sp create --id $Web_App_ID


#get oauth permission id
oauth_permission_id=$(az ad app show --id $API_App_ID | jq -r .api.oauth2PermissionScopes[0].id)
printf "\nOAuth Permission ID: $oauth_permission_id\n"
#Add API Permission to Web App ID
az ad app permission add --api $API_App_ID --api-permissions $oauth_permission_id=Scope --id $Web_App_ID

#Grant admin consent
az ad app permission grant --id $Web_App_ID --api $API_App_ID --scope user_impersonation


#if [ $? -ne 0 ]
#then
#    printf "\nError creating App Registrations for Web App. Exiting...\n"
#    exit 1
#fi

printf "\nDeploy Web App to Azure Storage...\n"

cd react-webapp

cat << EOF > src/config.json
{
    "TENANT_ID": "$tenantId",
    "CLIENT_ID": "$Web_App_ID",
    "USER_IMPERSONATIION_SCOPE": "$API_APP_IDENTIFIER_URI/user_impersonation",
    "CHAT_API_ENDPOINT": "https://$FUNC_NAME.azurewebsites.net/api/openai"
}
EOF

npm run build

az storage blob service-properties update --account-name $FUNC_STORAGE --static-website --404-document 404.html --index-document index.html

az storage blob delete-batch --account-name $FUNC_STORAGE --source '$web' --pattern "*"

az storage blob upload-batch --account-name $FUNC_STORAGE -s ./build -d '$web'

static_webapp_endpoint=$(az storage account show --name $FUNC_STORAGE --query "primaryEndpoints.web" | jq -r .)
static_webapp_endpoint="${static_webapp_endpoint%/}"
az functionapp cors add -g $RESOURCE_GROUP -n $FUNC_NAME --allowed-origins $static_webapp_endpoint


# Add redirect Urls
objectId=$(az ad app show --id $Web_App_ID | jq -r .id)
#redirecttype=spa | web | publicClient
redirecttype=spa
redirecturl=$static_webapp_endpoint
graphurl=https://graph.microsoft.com/v1.0/applications/$objectId
az rest --method PATCH --uri $graphurl --headers 'Content-Type=application/json' --body '{"'$redirecttype'":{"redirectUris":["'$redirecturl'"]}}' 

cd ..

printf "\nWeb App Deployed to Azure Storage.\n. Url: $static_webapp_endpoint\n"
exit 0

