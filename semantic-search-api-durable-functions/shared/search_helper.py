import os
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from shared import openai_helper

admin_key = os.environ.get("AZSEARCH_KEY") # Cognitive Search Admin Key
index_name = os.environ.get("INDEX_NAME") # Cognitive Search index name
credential = AzureKeyCredential(admin_key)

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