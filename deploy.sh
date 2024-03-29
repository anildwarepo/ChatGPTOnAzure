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
Azure Function App, Azure Cosmos DB with serverless and Azure Storage with static website enabled.\n\
It also deploys Azure Function App Code and confiures the App Settings to use the provided Open AI Endpoint and Open AI Key.\n"
read -p "Press enter to continue...."


# Check if the config file exists
config_file="deploy.config.txt"
if [ ! -f "$config_file" ]; then
    echo "Config file '$config_file' not found."
    exit 1
fi

# Read the values from config.txt into an array
mapfile -t values < "$config_file"

# Assign values to variables
RESOURCE_GROUP="${values[0]//$'\r'/}"
REGION="${values[1]//$'\r'/}"
FUNC_STORAGE="${values[2]//$'\r'/}"
FUNC_NAME="${values[3]//$'\r'/}"
AFR_ENDPOINT="${values[4]//$'\r'/}"
AFR_API_KEY="${values[5]//$'\r'/}"
OPENAI_RESOURCE_NAME="${values[6]//$'\r'/}"
OPENAI_EMBEDDING_MODEL="${values[7]//$'\r'/}"
OPENAI_API_VERSION="${values[8]//$'\r'/}"
AZSEARCH_EP="${values[9]//$'\r'/}"
AZSEARCH_KEY="${values[10]//$'\r'/}"
INDEX_NAME="${values[11]//$'\r'/}"
VECTOR_INDEX_NAME="${values[12]//$'\r'/}"
DEPLOYMENT_NAME="${values[13]//$'\r'/}"
OPENAI_MODEL_NAME="${values[14]//$'\r'/}"
SEMANTIC_CONFIG="${values[15]//$'\r'/}"
CHAT_HISTORY_LOGGING_ENABLED="${values[16]//$'\r'/}"
SYSTEM_MESSAGE="${values[17]//$'\r'/}"
SYSTEM_MESSAGE_FOR_SEARCH="${values[18]//$'\r'/}"
Azure_CosmosDB_Account="${values[19]//$'\r'/}"
#AzureCosmosDBConnectionString="${values[19]}"



# Validate and assign values to variables
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

while [ -z "${FUNC_STORAGE}" ]
do
    echo "Please provide Storage Account name for Func App. Storage Name must be alphanumeric and between 3 and 24 characters:"
    read FUNC_STORAGE
    if !(check_variable_name "$FUNC_STORAGE"); then
        echo "Storage Account name must be alphanumeric and between 3 and 24 characters" >&2
        FUNC_STORAGE=""
    fi

done

while [ -z "${FUNC_NAME}" ] || [ ${#FUNC_NAME} -gt 14 ]
do
    echo "Please provide Azure Function App Name. Max length 14 characters:"
    read FUNC_NAME

    if [ ${#FUNC_NAME} -gt 14 ]
    then
        echo "Function App Name should be less than 14 characters"
        FUNC_NAME=""
    fi
done

while [ -z "${AFR_ENDPOINT}" ]
do
    echo "Please provide AFR Endpoint:"
    read AFR_ENDPOINT
done

while [ -z "${AFR_API_KEY}" ]
do
    echo "Please provide AFR API Key:"
    read AFR_API_KEY
done

while [ -z "${OPENAI_RESOURCE_NAME}" ]
do
    echo "Please provide OpenAI Resource Name:"
    read OPENAI_RESOURCE_NAME
done

while [ -z "${OPENAI_EMBEDDING_MODEL}" ]
do
    echo "Please provide OpenAI Embedding Model:"
    read OPENAI_EMBEDDING_MODEL
done

while [ -z "${OPENAI_API_VERSION}" ]
do
    echo "Please provide OpenAI API Version:"
    read OPENAI_API_VERSION
done

while [ -z "${AZSEARCH_EP}" ]
do
    echo "Please provide AzSearch Endpoint:"
    read AZSEARCH_EP
done

while [ -z "${AZSEARCH_KEY}" ]
do
    echo "Please provide AzSearch Key:"
    read AZSEARCH_KEY
done

while [ -z "${INDEX_NAME}" ]
do
    echo "Please provide Index Name:"
    read INDEX_NAME
done

while [ -z "${VECTOR_INDEX_NAME}" ]
do
    echo "Please provide Vector Index Name:"
    read VECTOR_INDEX_NAME
done

while [ -z "${DEPLOYMENT_NAME}" ]
do
    echo "Please provide Deployment Name:"
    read DEPLOYMENT_NAME
done

while [ -z "${OPENAI_MODEL_NAME}" ]
do
    echo "Please provide OpenAI Model Name:"
    read OPENAI_MODEL_NAME
done

while [ -z "${SEMANTIC_CONFIG}" ]
do
    echo "Please provide Semantic Config:"
    read SEMANTIC_CONFIG
done

while [ -z "${CHAT_HISTORY_LOGGING_ENABLED}" ]
do
    echo "Please provide Chat History Logging Enabled (true/false):"
    read CHAT_HISTORY_LOGGING_ENABLED
done

while [ -z "${SYSTEM_MESSAGE}" ]
do
    echo "Please provide System Message:"
    read SYSTEM_MESSAGE
done

while [ -z "${SYSTEM_MESSAGE_FOR_SEARCH}" ]
do
    echo "Please provide System Message for Search:"
    read SYSTEM_MESSAGE_FOR_SEARCH
done

while [ -z "${Azure_CosmosDB_Account}" ]
do
    echo "Please provide a name for the cosmosdbaccount:"
    read Azure_CosmosDB_Account
done






# check if FUNC_STORAGE contains only alphanumeric characters

check_variable_name() {
  local name=$FUNC_STORAGE
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

func_prefix="funcchatapi$FUNC_NAME"
FUNC_NAME=$func_prefix

WEB_APP_NAME="azurechatgpt$FUNC_NAME"

#check if semantic-search-api-durable-functions directory exists
if [ ! -d "semantic-search-api-durable-functions" ]
then
    printf "\nError: semantic-search-api-durable-functions directory not found. Exiting...\n"
    exit 1
fi


OPENAI_RESOURCE_ENDPOINT=$(az cognitiveservices account list | jq -r --arg OPENAI_NAME $OPENAI_RESOURCE_NAME '.[]  | select(.name == $OPENAI_NAME) | .properties.endpoint')
if [[ -z $OPENAI_RESOURCE_ENDPOINT ]]
then
    printf "\nError: OpenAI Resource Endpoint not found. Exiting...\n"
    exit 1
fi


RG_EXISTS=$(az group exists -g $RESOURCE_GROUP | jq -r '.')

if [ -z "$RG_EXISTS" ] || [ "$RG_EXISTS" = "false" ]; then
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


#create azure cosmos db account
cosmosdb_name=$(az resource list -g $RESOURCE_GROUP | jq -r --arg Azure_CosmosDB_Account $Azure_CosmosDB_Account '.[] | select(.type == "Microsoft.DocumentDB/databaseAccounts") | select(.name = $Azure_CosmosDB_Account) | .name')

#check if cosmos db account exists
if [[ $cosmosdb_name = $Azure_CosmosDB_Account ]]
then
    printf "\nCosmos DB Account $cosmosdb_name already exists.\n"
else
    printf "\nCreating Cosmos DB Account - $Azure_CosmosDB_Account...\n"
    az cosmosdb create --name $Azure_CosmosDB_Account --resource-group $RESOURCE_GROUP --kind GlobalDocumentDB --locations regionName=$REGION failoverPriority=0 isZoneRedundant=False --capabilities EnableServerless
    #create database
    az cosmosdb sql database create --account-name $Azure_CosmosDB_Account --name "logging-db" --resource-group $RESOURCE_GROUP
    #create container
    az cosmosdb sql container create --account-name $Azure_CosmosDB_Account --database-name "logging-db" --name "openai-logs" --partition-key-path "/userInfo/email" --resource-group $RESOURCE_GROUP
    
    
fi

#get cosmos db connection string
Azure_CosmosDB_ConnectionString=$(az cosmosdb keys list --name $Azure_CosmosDB_Account --resource-group $RESOURCE_GROUP --type connection-strings | jq -r .connectionStrings[0].connectionString)

Azure_CosmosDB_Endpoint=$(az cosmosdb show --resource-group $RESOURCE_GROUP --name $Azure_CosmosDB_Account --query documentEndpoint)

if [ $? -ne 0 ]
then
    printf "\nError creating cosmosdb account. Exiting...\n"
    exit 1
fi

#check if function app exists
printf "\nCreating Function App $FUNC_NAME...\n"
function_name=$(az resource list -g $RESOURCE_GROUP | jq -r --arg FUNC_NAME $FUNC_NAME '.[] | select(.type == "Microsoft.Web/sites") | select(.name == $FUNC_NAME) | .name')


if [[ $function_name = $FUNC_NAME ]]
then
    printf "\nFunction App $function_name already exists.\n"
else
    
    az functionapp create --name $FUNC_NAME --storage-account $FUNC_STORAGE --consumption-plan-location $REGION --resource-group $RESOURCE_GROUP --os-type Linux --runtime python --runtime-version 3.10 --functions-version 4

fi

# Create Managed Identity on Function App
printf "\nCreating Managed Identity on Function App $FUNC_NAME...\n"
az functionapp identity assign --name $FUNC_NAME --resource-group $RESOURCE_GROUP





if [ $? -ne 0 ]
then
    printf "\nError creating function app. Exiting...\n"
    exit 1
fi

# Configure Function App Settings
printf "\nConfiguring Function App Settings...\n"
az functionapp config appsettings set --name $FUNC_NAME --resource-group $RESOURCE_GROUP \
    --settings AFR_ENDPOINT=$AFR_ENDPOINT \
    AFR_API_KEY=$AFR_API_KEY \
    AzureWebJobsFeatureFlags="EnableWorkerIndexing" \
    OPENAI_RESOURCE_ENDPOINT=$OPENAI_RESOURCE_ENDPOINT \
    OPENAI_EMBEDDING_MODEL=$OPENAI_EMBEDDING_MODEL \
    OPENAI_API_VERSION=$OPENAI_API_VERSION \
    AZSEARCH_EP=$AZSEARCH_EP \
    AZSEARCH_KEY=$AZSEARCH_KEY \
    INDEX_NAME=$INDEX_NAME \
    VECTOR_INDEX_NAME=$VECTOR_INDEX_NAME \
    DEPLOYMENT_NAME=$DEPLOYMENT_NAME \
    OPENAI_MODEL_NAME=$OPENAI_MODEL_NAME \
    SEMANTIC_CONFIG=$SEMANTIC_CONFIG \
    CHAT_HISTORY_LOGGING_ENABLED=$CHAT_HISTORY_LOGGING_ENABLED \
    SYSTEM_MESSAGE="$SYSTEM_MESSAGE" \
    SYSTEM_MESSAGE_FOR_SEARCH="$SYSTEM_MESSAGE_FOR_SEARCH" \
    AzureCosmosDBConnectionString__accountEndpoint=$Azure_CosmosDB_Endpoint \
    AzureCosmosDBConnectionString__credential="managedidentity"




if [ $? -ne 0 ]
then
    printf "\nError configuring function app settings. Exiting...\n"
    exit 1
fi


cd semantic-search-api-durable-functions

while true;do
    function_name=$(az resource list -g $RESOURCE_GROUP | jq -r --arg FUNC_NAME $FUNC_NAME '.[] | select(.type == "Microsoft.Web/sites") | select(.name == $FUNC_NAME) | .name')
    if [[ $function_name = $FUNC_NAME ]]
    then
        break
    else
        printf "\nWaiting for Function App to be created...\n"
        sleep 10
    fi
done



printf "\nDeploying Function App Code...\n"
sleep 30
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
    "CHAT_API_ENDPOINT": "https://$FUNC_NAME.azurewebsites.net/api/orchestrators/chatbot_orchestrator/chatbot_api",
    "CHAT_API_STATUS_ENDPOINT": "https://$FUNC_NAME.azurewebsites.net/api/orchestrators/chatbot_orchestrator/check_status",
    "CHAT_API_HISTORY_ENDPOINT": "https://$FUNC_NAME.azurewebsites.net/api/orchestrators/chatbot_orchestrator/fetch_chat_history",
    "FILE_UPLOAD_ENDPOINT": "https://$FUNC_NAME.azurewebsites.net/api/file_upload",
    "FILE_UPLOAD_ENDPOINT_CHECK_PROGRESS": "https://$FUNC_NAME.azurewebsites.net/api/file_upload_progress/",
    "UseAADAuth": true,
    "email": "someone@example.com"
}
EOF

npm install
npm run build

az storage blob service-properties update --account-name $FUNC_STORAGE --static-website --404-document 404.html --index-document index.html

az storage blob delete-batch --account-name $FUNC_STORAGE --source '$web' --pattern "*"

az storage blob upload-batch --account-name $FUNC_STORAGE -s ./build -d '$web'

static_webapp_endpoint=$(az storage account show --name $FUNC_STORAGE --query "primaryEndpoints.web" | jq -r .)
static_webapp_endpoint="${static_webapp_endpoint%/}"
az functionapp cors add -g $RESOURCE_GROUP -n $FUNC_NAME --allowed-origins $static_webapp_endpoint "http://localhost:3000"


# Add redirect Urls
objectId=$(az ad app show --id $Web_App_ID | jq -r .id)
#redirecttype=spa | web | publicClient
redirecttype=spa
redirecturl=$static_webapp_endpoint
graphurl=https://graph.microsoft.com/v1.0/applications/$objectId
az rest --method PATCH --uri $graphurl --headers 'Content-Type=application/json' --body '{"'$redirecttype'":{"redirectUris":["'$redirecturl'","http://localhost:3000"]}}' 

cd ..

printf "\nWeb App Deployed to Azure Storage.\n. Url: $static_webapp_endpoint\n"
exit 0

