import os
import json
import azure.functions as func
import azure.durable_functions as df
from shared import search_helper, openai_helper, utils_helper
import tiktoken
from azure.storage.blob import BlobServiceClient


activity_bp = df.Blueprint()


    
logging_enabled = os.environ.get("CHAT_HISTORY_LOGGING_ENABLED")
encoding = tiktoken.encoding_for_model(os.environ.get("OPENAI_MODEL_NAME"))

def check_enviroment_variables():
    # List of required environment variables
    required_vars = [
        "AzureWebJobsStorage",
        "FUNCTIONS_WORKER_RUNTIME",
        "AzureWebJobsFeatureFlags",
        "AFR_ENDPOINT",
        "AFR_API_KEY",
        "OPENAI_RESOURCE_ENDPOINT",
        "OPENAI_API_KEY",
        "OPENAI_API_VERSION",
        "OPENAI_API_KEY_EMBEDDING",
        "OPENAI_ENDPOINT_EMBEDDING",
        "AZSEARCH_EP",
        "AZSEARCH_KEY",
        "INDEX_NAME",
        "VECTOR_INDEX_NAME",
        "DEPLOYMENT_NAME",
        "OPENAI_MODEL_NAME",
        "SEMANTIC_CONFIG",
        "CHAT_HISTORY_LOGGING_ENABLED",
        "SYSTEM_MESSAGE",
        "SYSTEM_MESSAGE_FOR_SEARCH",
        "AzureCosmosDBConnectionString"
    ]

    # Check if all required environment variables are set
    for var in required_vars:
        if not os.environ.get(var):
            raise Exception(f"{var} is not set")
    
@activity_bp.activity_trigger(input_name="params")
def check_status(params):
    try:
        check_enviroment_variables()

        ll_response = openai_helper.call_openai_basic([{"role": "system", "content": "You are an enterprise search agent helping users with useful response on their questions. You need to greet users and ask for question that you can help with."},{"role": "user", "content": "Greet user and ask for question"}])
        return {"api": "chatapi_status", "method": "GET", "status": "success", "chatHistory": None, "message": ll_response} 
    
    except Exception as e:
        return {"api": "chatapi_status", "method": "GET", "status": "error", "chatHistory": None, "message": str(e)}

      

@activity_bp.activity_trigger(input_name="input")
def fetch_chat_history(input):
    return {"api": "chatapi", "method": "GET", "status": "success", "chatHistory": None, "message": "Chat history fetched successfully"}




'''
prompt = {"gptPrompt": {"systemMessage": {"role": "system", 
"content": "Assistant helps users with answers to the questions.\\n Answer ONLY with the facts listed in the list of context below. 
If there isn\'t enough information below, say you don\'t know. \\n   
Do not generate answers that don\'t use the context below. \\n  
Each source has a name followed by colon and the actual information, always include the source name for each fact you use in the response.\\n  
Use square brakets to reference the source, e.g. [info1.txt]. Don\'t combine sources, list each source separately, e.g. [info1.txt][info2.pdf]."}, 
"question": {"role": "user", "content": "Question: what is sdwan"}}, "maxTokens": 200, "numChunk": 20, "topKSearchResults": 3, 
"temperature": 0.3, "includeChatHistory": true, "useSearchEngine": true, "useVectorCache": true, "chatHistoryCount": 10, 
"chatHistory": "what is sdwan\\nwhat is sdwan\\nwhat is sdwan\\nwhat is sdwan\\nSorry, I am not able to answer your question at this time. 
Please try again later.\\nSorry, I am not able to answer your question at this time. 
Please try again later.\\nSorry, I am not able to answer your question at this time. Please try again later.\\n
"LLM RESPONSE", "userInfo": {"name": "local-user", "email": "someone@example.com", "tenantId": "aad-tenant-id"}}

'''
@activity_bp.activity_trigger(input_name="input")      
@activity_bp.cosmos_db_output(arg_name="documents", 
                      database_name="logging-db",
                      container_name="openai-logs",
                      create_if_not_exists=True,
                      connection="AzureCosmosDBConnectionString")
def chatbot_api(input, documents: func.Out[func.Document]):
    prompt = input['data']
    useSearchEngine = prompt['useSearchEngine']
    useVectorCache = prompt['useVectorCache']
    if useSearchEngine:
            topk = int(prompt["topKSearchResults"])
            num_tokens = len(encoding.encode(prompt['gptPrompt']['question']['content']))

            if num_tokens < 1536: #max tokens for text-embedding-ada-002
                search_prompt, sources = search_helper.azcognitive_score(prompt['gptPrompt']['question']['content'], topk)
                #openai_response, usage, function_called = openai_helper.call_openai_with_search(search_prompt, prompt)
                openai_response = openai_helper.call_openai_with_search(search_prompt, prompt, useVectorCache)
                if  not openai_response.is_function:
                    openai_response = utils_helper.format_response(openai_response.gpt_response, sources, openai_response.usage)
                else:
                    return func.HttpResponse(json.dumps({"api": "chatapi", "method": "GET", "status": "error", 
                                                         "chatHistory": None, "message": f"Max Token Limit Exceeded: {num_tokens}"}))
            else:
                openai_response = openai_helper.call_openai(prompt)
    else:  
        #prompt = "{userQuery: userQuery, maxTokens: max_tokens, temperature: temperature, systemMessage: systemMessage}"
        openai_response = openai_helper.call_openai(prompt)

    if logging_enabled:
        log = utils_helper.createlog(prompt, openai_response)
        #documents.set(func.Document.from_json(json.dumps(log)))

    return {"api": "chatapi", "method": "POST", "status": "success", "response": openai_response}

@activity_bp.activity_trigger(input_name="input") 
def file_upload_activity(input):
    file = input['file']
    connection_string = os.environ["AzureWebJobsStorage"]
    blob_service_client = BlobServiceClient.from_connection_string(connection_string)
    container_name = "fileuploads"
    container_client = blob_service_client.get_container_client(container_name)
    blob_client = container_client.get_blob_client(file.filename)
    blob_client.upload_blob(file, overwrite=True)
    return {"api": "chatapi_status", "method": "GET", "status": "success", "chatHistory": None, "message": f"{file.filename} - File uploaded successfully"}
    
   