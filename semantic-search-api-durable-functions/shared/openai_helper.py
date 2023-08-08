import json
import os
import openai
import inspect
import math
import faiss
import numpy as np
import uuid
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient

from shared import arm_helper

admin_key = os.environ.get("AZSEARCH_KEY") # Cognitive Search Admin Key
index_name = os.environ.get("VECTOR_INDEX_NAME") # Cognitive Search index name
credential = AzureKeyCredential(admin_key)

# Create an SDK client
endpoint = os.environ.get("AZSEARCH_EP")

semantic_config = os.environ.get("SEMANTIC_CONFIG")

openai.api_type = "azure"
openai.api_version = os.getenv("OPENAI_API_VERSION")   # SET YOUR API VERSION

vector_index = faiss.IndexFlatIP(1536)
gpt_response_cache = {}
search_client = SearchClient(endpoint=endpoint,
                    index_name=index_name,
                    credential=credential)
DEPLOYMENT_NAME = os.getenv("DEPLOYMENT_NAME")
# helper method used to check if the correct arguments are provided to a function
def check_args(function, args):
    sig = inspect.signature(function)
    params = sig.parameters

    # Check if there are extra arguments
    for name in args:
        if name not in params:
            return False
    # Check if the required arguments are provided 
    for name, param in params.items():
        if param.default is param.empty and name not in args:
            return False

    return True

def clear_vector_index():
    vector_index.reset()
    gpt_response_cache.clear()
    return "Vector index cleared"


def calculator(num1, num2, operator):
    if operator == '+':
        return str(num1 + num2)
    elif operator == '-':
        return str(num1 - num2)
    elif operator == '*':
        return str(num1 * num2)
    elif operator == '/':
        return str(num1 / num2)
    elif operator == '**':
        return str(num1 ** num2)
    elif operator == 'sqrt':
        return str(math.sqrt(num1))
    else:
        return "Invalid operator"

def update_azure_tags(tagkey, tagvalue):
    return arm_helper.add_azure_tag(tagkey, tagvalue)

functions = [
        {
            "name": "update_azure_tags",
            "description": "Updates the tags of an Azure resource group given tag key and value",
            "parameters": {
                "type": "object",
                "properties": {
                    "tagkey": {"type": "string"},
                    "tagvalue": {"type": "string"}
                },
                "required": ["tagkey", "tagvalue"],
            },    
        },
        {
            "name": "clear_vector_index",
            "description": "clears the vector index and resets the cache",
            "parameters": {
                "type": "object",
                "properties": {
                    
                },
                "required": [],
            },    
        },
        {
            "name": "calculator",
            "description": "A simple calculator used to perform basic arithmetic operations",
            "parameters": {
                "type": "object",
                "properties": {
                    "num1": {"type": "number"},
                    "num2": {"type": "number"},
                    "operator": {"type": "string", "enum": ["+", "-", "*", "/", "**", "sqrt"]},
                },
                "required": ["num1", "num2", "operator"],
            },
        }
    ]

available_functions = {
            "update_azure_tags": update_azure_tags,
            "calculator": calculator,
            "clear_vector_index": clear_vector_index
} 

class LLM_Response:
    def __init__(self, gpt_response, usage, is_function, from_cache, distance):
        self.gpt_response = gpt_response
        self.usage = usage
        self.is_function = is_function
        self.from_cache = from_cache
        self.distance = distance

def call_openai_basic(prompt):
    
    openai.api_key = os.getenv("OPENAI_API_KEY")  # SET YOUR OWN API KEY HERE
    openai.api_base = os.getenv("OPENAI_RESOURCE_ENDPOINT")  # SET YOUR RESOURCE ENDPOINT
    
    try:
        response = openai.ChatCompletion.create(
                    engine=DEPLOYMENT_NAME, 
                    messages = prompt,
                    temperature=0.5,
                    max_tokens=200,
                    stop=f"Answer:"                
                    )
        return response['choices'][0]['message']['content']
    except Exception as e:
        return str(e)
    

def call_openai(prompt):
    
    openai.api_key = os.getenv("OPENAI_API_KEY")  # SET YOUR OWN API KEY HERE
    openai.api_base = os.getenv("OPENAI_RESOURCE_ENDPOINT")  # SET YOUR RESOURCE ENDPOINT
    system_message  = prompt['gptPrompt']['systemMessage']
    
    question = prompt['chatHistory'] + prompt['gptPrompt']['question'] if prompt.get('includeChatHistory') else prompt['gptPrompt']['question']


    new_prompt= [system_message] + [question]
    max_response_tokens = int(prompt['maxTokens'])
    
    temperature =  prompt['temperature']
    try:
        response = openai.ChatCompletion.create(
                    engine=DEPLOYMENT_NAME, 
                    messages = new_prompt,
                    temperature=temperature,
                    max_tokens=max_response_tokens,
                    stop=f"Answer:"                
                    )
        return { "llm_response" : response['choices'][0]['message']['content'], "usage" : response.usage }
    except Exception as e:
        return { "llm_response" : e.user_message, "usage" : None } 



# cache invalidation strategies
# LRU
# MAX CACHE HIT COUNT

def check_cache(prompt):
    question = prompt['gptPrompt']['question']['content']
    emb_q = generate_embeddings(question)
    input_vector = np.float32([emb_q])
    d,i = vector_index.search(input_vector, k=1)
    if d[0][0] < 0 or d[0][0] < np.float32(.9):
        return False, d[0][0], None
    else:
        return True, d[0][0], gpt_response_cache[i[0][0]] 

        
def add_to_cache(prompt, gpt_response, distance):
    question = prompt['gptPrompt']['question']['content']
    emb =  generate_embeddings(question)
    emb_vectors = []
    emb_vectors.append(emb)
    vectors_to_add = np.float32(emb_vectors)
    faiss.normalize_L2(vectors_to_add)
    vector_index.add(vectors_to_add)
    gpt_response_cache[vector_index.ntotal - 1] = gpt_response



def check_azure_cog_search_cache(prompt):
    question = prompt['gptPrompt']['question']['content']
    emb_q = generate_embeddings(question)
    results = search_client.search(search_text=None, 
                                   include_total_count=True, 
                                   vector=emb_q,
                                   vector_fields="user_query_vector",
                                   select=["user_query", "gpt_response"],
                                   top=1
                                   )
    try:
        r = next(results)
        if r['@search.score'] < 0 or r['@search.score'] < np.float32(.9):
                return False, r['@search.score'], None
        else:
            return True, r['@search.score'], r['gpt_response']
    except StopIteration:
        return False, 0, None    

    


def add_to_azure_cog_search_cache(prompt, gpt_response, distance):
    search_doc = {
                 "id" : str(uuid.uuid4()),
                 "user_query" : prompt['gptPrompt']['question']['content'],
                 "gpt_response" : gpt_response,
                 "distance" : str(distance),
                 "user_query_vector" : generate_embeddings(prompt['gptPrompt']['question']['content']),
                 "gpt_response_vector" : generate_embeddings(gpt_response)
              }
    search_client.upload_documents(documents = [search_doc])




def call_openai_with_search(search_prompt, prompt, useVectorCache) -> LLM_Response:
    
    #cached, distance, gpt_response = check_cache(prompt)
    #if cached:
       #return gpt_response , None , False
    #   return LLM_Response(f"[FROM CACHE - d={distance}]\n\n" + gpt_response, None, False, True, distance)

    distance = 'n/a'
    if useVectorCache:
        cached, distance, gpt_response = check_azure_cog_search_cache(prompt)
        if cached:
            return LLM_Response(f"[FROM CACHE - d={distance}]\n\n" + gpt_response, None, False, True, distance)

    openai.api_key = os.getenv("OPENAI_API_KEY")  # SET YOUR OWN API KEY HERE
    openai.api_base = os.getenv("OPENAI_RESOURCE_ENDPOINT")  # SET YOUR RESOURCE ENDPOINT

    max_response_tokens = int(prompt['maxTokens'])    
    temperature =  prompt['temperature']


    function_call_response = ""
    try:
        if prompt.get('includeChatHistory'):
            search_prompt[1]['content'] = prompt['chatHistory'] + search_prompt[1]['content']

        response = openai.ChatCompletion.create(
                    engine=DEPLOYMENT_NAME, 
                    messages = search_prompt,
                    temperature=temperature,
                    max_tokens=max_response_tokens,
                    functions=functions,
                    function_call="auto", 
                    stop=f"Answer:"                
                    )
        
        if 'function_call' in response['choices'][0]['message']:
            function_name = response['choices'][0]['message']['function_call']['name']
            # verify function exists
            if function_name not in available_functions:
                function_call_response += "Function " + function_name + " does not exist"
            function_to_call = available_functions[function_name]  

            # verify function has correct number of arguments
            function_args = json.loads(response['choices'][0]['message']['function_call']["arguments"])
            if check_args(function_to_call, function_args) is False:
                function_call_response += "Invalid number of arguments for function: " + function_name
            function_response = function_to_call(**function_args)      
            #return f"\n\n Functions called:{function_name} \n\n Function Response: {function_response}" , response.usage , True
            return LLM_Response(f"\n\n Functions called:{function_name} \n\n Function Response: {function_response}", response.usage, True, False, distance)
        else:
            #add_to_cache(prompt, response['choices'][0]['message']['content'], distance)
            if useVectorCache:
                add_to_azure_cog_search_cache(prompt, response['choices'][0]['message']['content'], distance)
            #return f"[FROM LLM - d={distance}]\n\n" + response['choices'][0]['message']['content'] , response.usage , False
            return LLM_Response(f"[FROM LLM - d={distance}]\n\n" + response['choices'][0]['message']['content'], response.usage, False, False, distance)
        
    except Exception as e:
        return e,  None 

def generate_embeddings(text):
    openai.api_key = os.getenv("OPENAI_API_KEY_EMBEDDING")  # SET YOUR OWN API KEY HERE
    openai.api_base = os.getenv("OPENAI_ENDPOINT_EMBEDDING")  # SET YOUR RESOURCE ENDPOINT
    response = openai.Embedding.create(
        input=text, engine="text-embedding-ada-002")
    embeddings = response['data'][0]['embedding']
    return embeddings




