
export interface Chat {
    userType: string;
    userMessage: string;
}

export interface ChatAPIRequest {

        gptPrompt: GptPrompt;
        maxTokens: number;
        temperature: number;
        includeChatHistory: boolean;
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

