
export interface Chat {
    userType: string;
    userMessage: string;
}

export interface ChatAPIRequest {

        gptPrompt: GptPrompt;
        maxTokens: number;
        topKSearchResults: number;
        temperature: number;
        includeChatHistory: boolean;
        useSearchEngine: boolean;
        chatHistoryCount: number;
        userInfo : { name: string; email: string; tenantId: string; }
}

export interface GptPrompt {
    
    systemMessage : Prompt;
    question : Prompt;    
}

export interface Prompt {

    role: string;
    content: string;
}

