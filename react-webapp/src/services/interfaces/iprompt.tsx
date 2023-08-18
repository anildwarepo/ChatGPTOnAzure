
export interface Chat {
    userType: string;
    userMessage: string;
}

export interface ChatAPIRequest {

        gptPrompt: GptPrompt;
        maxTokens: number;
        topKSearchResults: number;
        numChunk: number;
        temperature: number;
        includeChatHistory: boolean;
        useSearchEngine: boolean;
        useVectorCache: boolean;
        chatHistoryCount: number;
        chatHistory:string,
        userInfo : UserInfo
}


export interface UserInfo {
    name: string; 
    email: string; 
    tenantId: string;
}

export interface GptPrompt {
    
    systemMessage : Prompt;
    question : Prompt;    
}

export interface Prompt {

    role: string;
    content: string;
}

