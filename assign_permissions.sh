#!/bin/bash

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

scope=$(
    az cosmosdb show \
        --resource-group $RESOURCE_GROUP \
        --name $Azure_CosmosDB_Account \
        --query id \
        --output tsv
)

echo $scope

principal=$(
    az webapp identity show \
        --resource-group $RESOURCE_GROUP \
        --name "funcchatapi$FUNC_NAME" \
        --query principalId \
        --output tsv
)

echo $principal


az cosmosdb sql role assignment create \
    --resource-group $RESOURCE_GROUP \
    --account-name $Azure_CosmosDB_Account \
    --role-definition-name "Cosmos DB Built-in Data Contributor" \
    --principal-id $principal \
    --scope $scope


azure_openai_resource_id=$(az cognitiveservices account list | jq -r --arg OPENAI_NAME $OPENAI_RESOURCE_NAME '.[] | select(.name == $OPENAI_NAME) | .id')

az role assignment create --role "Cognitive Services User" --assignee $principal --scope $azure_openai_resource_id