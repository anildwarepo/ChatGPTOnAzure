import azure.functions as func
import azure.durable_functions as df
import time, datetime
import os
import base64
from azure.storage.blob import BlobServiceClient, BlobClient, generate_blob_sas, BlobSasPermissions
import requests
import csv
from tenacity import retry, wait_random_exponential, stop_after_attempt  
import openai  
from azure.search.documents.indexes import SearchIndexClient  
from azure.search.documents.models import Vector  #pip install ./build/azure_search_documents-11.4.0b4-py3-none-any.whl  
from azure.search.documents.indexes.models import (  
    SearchIndex,  
    SearchField,  
    SearchFieldDataType,  
    SimpleField,  
    SearchableField,  
    SearchIndex,  
    SemanticConfiguration,  
    PrioritizedFields,  
    SemanticField,  
    SearchField,  
    SemanticSettings,  
    VectorSearch,  
    VectorSearchAlgorithmConfiguration,  
)  
from azure.core.credentials import AzureKeyCredential
from azure.ai.formrecognizer import DocumentAnalysisClient

entities_bp = df.Blueprint()

SEARCH_ENDPOINT = os.environ["AZSEARCH_EP"]
SEARCH_API_KEY = os.environ["AZSEARCH_KEY"]
SEARCH_INDEX = os.environ["INDEX_NAME"]
VECTOR_SEARCH_INDEX = os.environ["VECTOR_INDEX_NAME"]
api_version = '?api-version=2021-04-30-Preview'
headers = {'Content-Type': 'application/json',
        'api-key': SEARCH_API_KEY }

endpoint = os.environ["AFR_ENDPOINT"]
key = os.environ["AFR_API_KEY"]
credential = AzureKeyCredential(SEARCH_API_KEY)
openai.api_type = "azure"  
openai.api_key = os.getenv("OPENAI_API_KEY_EMBEDDING")  
openai.api_base = os.getenv("OPENAI_ENDPOINT_EMBEDDING")  
openai.api_version = os.getenv("OPENAI_API_VERSION") 

# File Upload Status Entity
@entities_bp.entity_trigger(context_name="context")
def entity_function(context: df.DurableEntityContext):
    current_value = context.get_state(lambda: "Processing...")
    operation = context.operation_name
    if operation == "add":
        time.sleep(30)
        amount = context.get_input()
        current_value += "amount"
    elif operation == "upload_file":
        file = context.get_input()
        result = upload_file_entity(file)
        current_value = "Success"
        context.set_state(current_value)
        context.set_result(result)
    context.set_state(current_value)

def upload_file_entity(activity_input):
    #file = activity_input['file']
    file_data = base64.b64decode(activity_input['fileData'])
    connection_string = os.environ["AzureWebJobsStorage"]
    blob_service_client = BlobServiceClient.from_connection_string(connection_string)
    container_name = "fileuploads"
    container_client = blob_service_client.get_container_client(container_name)
    blob_client = container_client.get_blob_client(activity_input['fileName'])
    blob_client.upload_blob(file_data, overwrite=True)
    sas_token = create_service_sas_blob(blob_client, blob_service_client.credential.account_key)
    sas_url = f"{blob_client.url}?{sas_token}"
    ingest_from_url(sas_url, activity_input['fileName'])
    
   
def create_service_sas_blob(blob_client: BlobClient, account_key: str):
    # Create a SAS token that's valid for one day, as an example
    start_time = datetime.datetime.now(datetime.timezone.utc)
    expiry_time = start_time + datetime.timedelta(minutes=5)

    sas_token = generate_blob_sas(
        account_name=blob_client.account_name,
        container_name=blob_client.container_name,
        blob_name=blob_client.blob_name,
        account_key=account_key,
        
        permission=BlobSasPermissions(read=True),
        expiry=expiry_time,
        start=start_time
    )
    return sas_token


def ingest_from_url(formUrl, fileName):
    try:    
        
        #delete_search_index()
        #delete_search_index(VECTOR_SEARCH_INDEX)
        #create_search_index()    
        create_vector_index()
        create_vector_index_for_cache(VECTOR_SEARCH_INDEX)
        document_analysis_client = DocumentAnalysisClient(
            endpoint=endpoint, credential=AzureKeyCredential(key)
        )
        if(formUrl != ""):
          print(f"Analyzing form from URL {formUrl}...")
          poller = document_analysis_client.begin_analyze_document_from_url("prebuilt-layout", formUrl)
          result = poller.result()
          print(f"Processing result...this might take a few minutes...")
          process_afr_result(result, fileName)
          
    except Exception as e:
        print(e)
    

@retry(wait=wait_random_exponential(min=1, max=20), stop=stop_after_attempt(6))
# Function to generate embeddings for title and content fields, also used for query embeddings
def generate_embeddings(text):
    response = openai.Embedding.create(
        input=text, engine="text-embedding-ada-002")
    embeddings = response['data'][0]['embedding']
    return embeddings

def create_vector_index_for_cache(index_name=None):
    index_client = SearchIndexClient(
        endpoint=SEARCH_ENDPOINT, credential=credential)
    

    try:
        idx = index_client.get_index(index_name)
        return
    except Exception as e:
        if e.status_code == 404:
            pass
        else:
            raise e

    fields = [
        SimpleField(name="id", type=SearchFieldDataType.String, key=True),
        SearchableField(name="user_query", type=SearchFieldDataType.String,
                        searchable=True, retrievable=True),
        SearchableField(name="gpt_response", type=SearchFieldDataType.String,
                        searchable=True, retrievable=True),
        SearchableField(name="distance", type=SearchFieldDataType.Double,
                        searchable=False, retrievable=True),                        
        
        SearchField(name="user_query_vector", type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
                    searchable=True, vector_search_dimensions=1536, vector_search_configuration="vector-config"),
        SearchField(name="gpt_response_vector", type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
                    searchable=True, vector_search_dimensions=1536, vector_search_configuration="vector-config"),
    ]

    vector_search = VectorSearch(
      algorithm_configurations=[
          VectorSearchAlgorithmConfiguration(
              name="vector-config",
              kind="hnsw",
              hnsw_parameters={
                  "m": 4,
                  "efConstruction": 400,
                  "efSearch": 500,
                  "metric": "cosine"
              }
          )
      ]
    )

    semantic_config_for_cache = SemanticConfiguration(
        name="semantic-config-for-cache",
        prioritized_fields=PrioritizedFields(
            title_field=SemanticField(field_name="user_query"),
            prioritized_content_fields=SemanticField(field_name="gpt_response"),
        )
    )
    # Create the semantic settings with the configuration
    semantic_settings = SemanticSettings(configurations=[semantic_config_for_cache])

    # Create the search index with the semantic settings
    index = SearchIndex(name=index_name, fields=fields,
                        vector_search=vector_search, semantic_settings=semantic_settings)
    result = index_client.create_index(index)
    print(f' {result.name} created')

def create_vector_index(index_name=SEARCH_INDEX):
    index_client = SearchIndexClient(
        endpoint=SEARCH_ENDPOINT, credential=credential)
    
    try:
        idx = index_client.get_index(index_name)
        return
    except Exception as e:
        if e.status_code == 404:
            pass
        else:
            raise e


    fields = [
        SimpleField(name="id", type=SearchFieldDataType.String, key=True),
        SearchableField(name="text", type=SearchFieldDataType.String,
                        searchable=True, retrievable=True),
        SearchableField(name="summary", type=SearchFieldDataType.String,
                        searchable=True, retrievable=True),                        
        SearchableField(name="fileName", type=SearchFieldDataType.String,
                        searchable=False, retrievable=True),
        SearchableField(name="pageNumber", type=SearchFieldDataType.String,
                        filterable=False, searchable=False, retrievable=True),
        SearchField(name="textVector", type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
                    searchable=True, vector_search_dimensions=1536, vector_search_configuration="vector-config"),
        SearchField(name="summaryVector", type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
                    searchable=True, vector_search_dimensions=1536, vector_search_configuration="vector-config"),
    ]

    vector_search = VectorSearch(
      algorithm_configurations=[
          VectorSearchAlgorithmConfiguration(
              name="vector-config",
              kind="hnsw",
              hnsw_parameters={
                  "m": 4,
                  "efConstruction": 400,
                  "efSearch": 500,
                  "metric": "cosine"
              }
          )
      ]
    )

    semantic_config = SemanticConfiguration(
        name="my-semantic-config",
        prioritized_fields=PrioritizedFields(
            title_field=SemanticField(field_name="text"),
            prioritized_keywords_fields=[SemanticField(field_name="summary")]
        )
    )
    # Create the semantic settings with the configuration
    semantic_settings = SemanticSettings(configurations=[semantic_config])

    # Create the search index with the semantic settings
    index = SearchIndex(name=index_name, fields=fields,
                        vector_search=vector_search, semantic_settings=semantic_settings)
    result = index_client.create_index(index)
    return(f' {result.name} created')



def delete_search_index(index_name=SEARCH_INDEX):
    try:
        url = SEARCH_ENDPOINT + "indexes/" + index_name + api_version 
        response  = requests.delete(url, headers=headers)
        return("Index deleted")
    except Exception as e:
        return(e)


def add_document_to_index(page_idx, documents, index_name=SEARCH_INDEX):
    try:
        url = SEARCH_ENDPOINT + "indexes/" + index_name + "/docs/index" + api_version
        response  = requests.post(url, headers=headers, json=documents)
        print(f"page_idx is {page_idx} - {len(documents['value'])} Documents added")
    except Exception as e:
        print(e)


def process_afr_result(result, filename):
    print(f"Processing {filename } with {len(result.pages)} pages into Azure Search....this might take a few minutes depending on number of pages...")
    for page_idx in range(len(result.pages)):
        docs = []
        content_chunk = ""
        for line_idx, line in enumerate(result.pages[page_idx].lines):
            #print("...Line # {} has text content '{}'".format(line_idx,line.content.encode("utf-8")))
            content_chunk += str(line.content.encode("utf-8")).replace('b','') + "\n"

            if line_idx != 0 and line_idx % 20 == 0:
              search_doc = {
                    "id":  f"page-number-{page_idx + 1}-line-number-{line_idx}",
                    "text": content_chunk,
                    "textVector": generate_embeddings(content_chunk),
                    "fileName": filename,
                    "pageNumber": str(page_idx+1)
              }
              docs.append(search_doc)
              content_chunk = ""
        search_doc = {
                    "id":  f"page-number-{page_idx + 1}-line-number-{line_idx}",
                    "text": content_chunk,
                    "textVector": generate_embeddings(content_chunk),
                    "fileName": filename,
                    "pageNumber": str(page_idx + 1)
        }
        docs.append(search_doc)   
        add_document_to_index(page_idx, {"value": docs})
        #create_chunked_data_files(page_idx, search_doc)

def create_chunked_data_files(page_idx, search_doc):
    try:
        output_path = os.path.join(os.getcwd(), "data-files", f'{page_idx}-data.csv')
        with open(output_path, 'w') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow([search_doc['id'], search_doc['text']])
            
    except Exception as e:
        print(e)