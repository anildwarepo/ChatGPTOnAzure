# ChatGPTOnAzure

A react based web app that uses Azure Durable Functions to connect to Azure Open AI. 
It also can ingest documents and create a vector index using Azure Cognitive Search. 



![](webapp-pic.png)


## Prerequisites

To deploy this web app and azure functions using a single cli command:
- az cli installed.
- Azure Functions Core tools installed.
- bash with jq installed. Azure Cloud shell can be used. 
- Azure Open AI resource created and ChatGPT turbo model deployed. 
- Deployment user needs to have Azure Active Directory Service Principal create permissions and grant admin consent to API permissions.
- Azure Resource Group creation and contributor permissions.
- npm react-script package installed.


## Run locally
To deploy locally, run the below commands. Rename local.settings-rename.json to local.settings.json.
Update the values for the below keys in local.settings.json.

    "AFR_ENDPOINT": "",
    "AFR_API_KEY": "",
    "OPENAI_RESOURCE_ENDPOINT": "",
    "OPENAI_API_KEY": "",
    "OPENAI_API_KEY_EMBEDDING": "",
    "OPENAI_ENDPOINT_EMBEDDING": "",
    "AZSEARCH_EP": "",
    "AZSEARCH_KEY": "",
    "INDEX_NAME": "",
    "VECTOR_INDEX_NAME": "",
    "DEPLOYMENT_NAME": "",
    "OPENAI_MODEL_NAME": "",
    "SEMANTIC_CONFIG": "",
    "AzureCosmosDBConnectionString": ""

Run the below commands in CLI like windows powershell or bash. 
    
    git clone https://github.com/anildwarepo/ChatGPTOnAzure

    cd semantic-search-api-durable-functions
    python -m venv .venv
    pip install -r requirements.txt
    func start
    
    cd ..

    cd react-webapp
    npm install
    npm start




git clone https://github.com/anildwarepo/ChatGPTOnAzure

## Deploy ChatGPT on Azure as a Static Website using Azure Storage

To deploy the web app, run the below commands in bash CLI as shown.

    git clone https://github.com/anildwarepo/ChatGPTOnAzure
    az login
    az extension add --name authV2


    cd ChatGPTOnAzure

    chmod +x deploy.sh
    ./deploy.sh <resource-group-name>  <region>  <Azure Open AI Endpoint> <Azure Open AI Key> <Azure Open AI Model Deployment Name> <funcapp_name>  <Azure Cosmos DB Account name>

    For e.g
    ./deploy.sh chatgpt-webapp-rg  westus2 https://openairesourcename.openai.azure.com/ key1 gpt-35-turbo chatgptwebapp1 chatgptwebapp1store cosmosdb-chat

### (Optional) Deploy only the Function app.
The function app can be deployed using the below func cli. Azure Functions Cli can be installed from [here](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local?tabs=v4%2Clinux%2Ccsharp%2Cportal%2Cbash#install-the-azure-functions-core-tools).

    
    cd backend
    #modify database and collections names in chatapi/function.json
            "databaseName": "logging-db",
            "collectionName": "openai-logs",
    #deploy function app
    FUNC_NAME="<name of function>"
    func azure functionapp publish $FUNC_NAME --force --python


## Configuration AAD Authentication
This support supports AAD authentication on both react web app and Azure functions using oauth. 
To configure AAD authentication, update C:\source\repos\ChatGPTOnAzure\react-webapp\src\config.json and change "UseAADAuth": false to 
"UseAADAuth": true.

You can then run deploy.sh as shown above to deploy the apps to Azure. 


## Create Vector Index and ingest documents right from the UI. 

![](webapp-pic1.png)