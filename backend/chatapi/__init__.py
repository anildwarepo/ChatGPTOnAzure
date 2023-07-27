import os
import datetime
import logging
import json
import azure.functions as func
from sys import path
from shared import openai_helper
import uuid
import pandas as pd
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient


admin_key = os.environ.get("AZSEARCH_KEY") # Cognitive Search Admin Key
index_name = os.environ.get("INDEX_NAME") # Cognitive Search index name
credential = AzureKeyCredential(admin_key)

# Create an SDK client
endpoint = os.environ.get("AZSEARCH_EP")

semantic_config = os.environ.get("SEMANTIC_CONFIG")

search_client = SearchClient(endpoint=endpoint,
                    index_name=index_name,
                    credential=credential)




def azcognitive_score(user_query, topk):
    user_query_vector = openai_helper.generate_embeddings(user_query)

    results = search_client.search(search_text=None, 
                                   include_total_count=True, 
                                   vector=user_query_vector,
                                   vector_fields="textVector",
                                   select=["text", "fileName", "pageNumber"],
                                   top=topk
                                   )
    document=""
    sources = []
    
    i=0
    while i < topk:
        try:
            item = next(results)
            document += (item['text'])
            sourceInfo = {"fileName": item['fileName'], "pageNumber":  item['pageNumber']}
            sources.append(sourceInfo)
        except Exception as e:
            print(e)
            break
        i+=1
    #system_message="""
    #You are an AI search Assitant. You are given a question and a context. You need to answer the question using only the context.
    #If you do not know the Answer, you can say "I don't know".  
    #The context is a collection of documents.    
    #"""
    system_message =  {"role": "system", "content": os.getenv("SYSTEM_MESSAGE_FOR_SEARCH")}
    question = {"role":"user", "content":f"Question: {user_query} \n <context> {document} </context>"}
    prompt= [system_message] +[question]
    return prompt, sources

def createlog(prompt, response):
    #create guid
    new_uuid = str(uuid.uuid4())
    timestamp = datetime.datetime.utcnow()
    
    log = { "utcTimeStamp": str(timestamp),  "conversationId" : new_uuid, "prompt" : prompt['gptPrompt'], "userInfo": prompt['userInfo'], "response" : response }
    return log


def format_response(openai_response, sources, usage):
    df = pd.DataFrame(sources)
    arr_unique_filename = df['fileName'].unique()
    citations = ""
    for filename in arr_unique_filename:
        page_numbers = df.loc[df['fileName'] == filename]
        citations += f"\n{filename}, page numbers:"
        for page in page_numbers['pageNumber']:
            citations += f"[{page}]\n"      
    
    openai_response += openai_response + f"\n\n\nCitations: \n{citations}"


    return { "llm_response" : openai_response, "usage" : usage }



def main(req: func.HttpRequest, chatHistory: func.DocumentList, documents: func.Out[func.Document]) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request.')
    
    if req.method == "GET":
        logging.info('Python HTTP trigger function processed a request.')
        if not chatHistory:
            return func.HttpResponse(json.dumps({"api": "chatapi", "method": "GET", "status": "success", "chatHistory": None, "message": "no chat history found"}))
        else:
            chat_history_json = [doc.to_json() for doc in chatHistory]
            return func.HttpResponse(json.dumps({"api": "chatapi", "method": "GET", "status": "success", "chatHistory": chat_history_json}))
   

    if req.method == "POST":
        logging.info('Python HTTP trigger function processed a request.')
        #deployment_name = req.route_params.get('deployment_name')
        api_version = req.params.get('api-version')
        
        
        prompt = req.get_json()
        useSearchEngine = prompt['useSearchEngine']
        #user_query = prompt['prompt']
        
        if useSearchEngine:
            topk = int(prompt["topKSearchResults"])
            
            if len(prompt['gptPrompt']['question']['content']) < 500:
                search_prompt, sources = azcognitive_score(prompt['gptPrompt']['question']['content'], topk)
                openai_response, usage, function_called = openai_helper.call_openai_with_search(search_prompt, prompt)
                if  not function_called:
                    openai_response = format_response(openai_response, sources, usage)
                else:
                    openai_response = { "llm_response" : openai_response, "usage" : usage }
            else:
                openai_response = openai_helper.call_openai(prompt)
        else:  
            #prompt = "{userQuery: userQuery, maxTokens: max_tokens, temperature: temperature, systemMessage: systemMessage}"
            openai_response = openai_helper.call_openai(prompt)

        log = createlog(prompt, openai_response)
        documents.set(func.Document.from_json(json.dumps(log)))
        return func.HttpResponse(json.dumps({"api": "chatapi", "method": "POST", "status": "success", "response": openai_response}))




