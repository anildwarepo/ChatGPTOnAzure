import Col from 'react-bootstrap/Col';
import React, { useState } from 'react';
import "../styles/chatgptui.css";
import UserIconSvg from '../assets/user.svg';
import BotIconSvg from '../assets/bot.svg';
import {sendChatMessage, fetchChatHistory} from '../services/chatService';
import { useRef, useEffect } from 'react';
import Accordion from 'react-bootstrap/Accordion';
import SettingsIconSvg from '../assets/settings.svg';

import Form from 'react-bootstrap/Form';
import { Prompt, Chat, ChatAPIRequest, GptPrompt } from '../services/interfaces/iprompt';

export const ChatGPTUI = (props: any) => {

    const [maxTokens , setMaxTokens] = useState(200);
    const [topKSearchResults , setTopKSearchResults] = useState(3);
    const [temperature , setTemperature] = useState(0.5);
    const [includeChatHistory , setIncludeChatHistory] = useState(false);
    const [useSearchEngine , setuseSearchEngine] = useState(false);
    const [systemMessage , setSystemMessage] = useState('You are an Open AI assistant.');
    const [chatHistoryCount , setChatHistoryCount] = useState(10);
    const divRef = useRef<null | HTMLDivElement>(null); 
    const [chatHistory, setChatHistory] = useState<Chat[]>([]); //{userType: "user", conversationId: 0, userMessage: `Welcome, ${props.accounts[0].name}!`}
    const [prevChatHistory, setPrevChatHistory] = useState<Chat[]>([]);
    const [userQuery, setUserQuery] = useState('');
    const [usage , setUsage] = useState({completion_tokens:0, prompt_tokens: 0, total_tokens:0});
    const [isSending, setIsSending] = useState(false);


  const [chatAPIRequest, setParameters] = useState<ChatAPIRequest>({
    gptPrompt: { systemMessage : {role: "system", content: "You are an Open AI assistant."}, question : {role: "user", content: ""}} as GptPrompt,
    maxTokens: 200,
    topKSearchResults: 3,
    temperature: 0,
    includeChatHistory: false,
    useSearchEngine: false,
    chatHistoryCount: 0,
    userInfo: {
        name: props.accounts[0].name,
        email: props.accounts[0].username,
        tenantId: props.accounts[0].tenantId
    }
  });

  useEffect(() => {
    divRef.current?.scrollIntoView({ inline: 'nearest', block: 'start', behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
      setParameters(prevState => ({...prevState, topKSearchResults: Number(topKSearchResults)})); 
  }, [topKSearchResults]);

  useEffect(() => {
    setParameters(prevState => ({...prevState, maxTokens: Number(maxTokens)})); 
    }, [maxTokens]);

  useEffect(() => {
      setParameters(prevState => ({...prevState, temperature: Number(temperature)})); 
  }, [temperature]);

  useEffect(() => {
      setParameters(prevState => ({...prevState, includeChatHistory: includeChatHistory})); 
  }, [includeChatHistory]);
  
  useEffect(() => {
    setParameters(prevState => ({...prevState, useSearchEngine: useSearchEngine})); 
    }, [useSearchEngine]);

  useEffect(() => {
      setParameters(prevState => ({...prevState, gptPrompt: {...prevState.gptPrompt, systemMessage: {...prevState.gptPrompt.systemMessage, content: systemMessage}} })); 
  }, [systemMessage]);

  useEffect(() => {
      setParameters(prevState => ({...prevState, gptPrompt: {...prevState.gptPrompt, question: {...prevState.gptPrompt.question, content: 'Question: ' + userQuery}} })); 
  }, [userQuery]);

  useEffect(() => {
      setParameters(prevState => ({...prevState, chatHistoryCount: Number(chatHistoryCount)})); 
  }, [chatHistoryCount]);

  useEffect(() => {
      // Update the document title using the browser API
      //getChatHistory();
      setChatHistory(prevChatHistory);
  }, [prevChatHistory]);

  const handleUserQueryChange = (e: any) => {
    setUserQuery(e.target.value);
  }

  const handleKeyPress = (e: any) => {
    if (e.keyCode === 13 && e.shiftKey) { // 13 is the code for "Enter" key
        e.preventDefault();
        // Handle the shift + enter key combination
        let newValue = userQuery + "\n";
        setUserQuery(newValue);

        console.log("Shift + Enter pressed - " + userQuery)
        return;
    }
    if (e.keyCode === 13) { // 13 is the code for "Enter" key
        e.preventDefault();
        // Handle the shift + enter key combination
        sendMessage();
        console.log("Enter pressed")
        return;
    }
  }

  const sendMessage = () => {
    if(userQuery === ""){return;}
    
    if(includeChatHistory) {
        const chatHistoryItems = chatHistory.slice(Math.max(chatHistory.length - chatHistoryCount, 0));
        const chatHistoryUserMessageString = chatHistoryItems.filter((chat) => chat.userType == 'user' ).map((chat) => chat.userMessage).join('\n');
        const chatHistorySystemResponseString = chatHistoryItems.filter((chat) => chat.userType == 'system' ).map((chat) => chat.userMessage).join('\n');
        chatAPIRequest.gptPrompt.question.content = chatHistoryUserMessageString + '\n' + chatHistorySystemResponseString + '\n' + 'Question: ' + userQuery;
        
    }

    setIsSending(true);
    const userItem = {userType: "user", userMessage: userQuery};
    const userItems = [...chatHistory, userItem];
    setChatHistory(userItems);
    sendChatMessage(chatAPIRequest, props).then((response) => {
        //console.log(response);
        const botItem = {userType: "system", userMessage: response.response.llm_response};
        const botItems = [...userItems, botItem];
        setChatHistory(botItems);
        setUsage(response.response.usage);
        setUserQuery('');
        setIsSending(false);

    });
    

    console.log(chatHistory.length);
  }

  const startNewChat = () => {
    setChatHistory([]);
    setUserQuery('');
    setUsage({completion_tokens:0, prompt_tokens: 0, total_tokens:0});
  }

  const getChatHistory = () => {
    setPrevChatHistory([]);
    fetchChatHistory(chatAPIRequest, props).then((response) => {
        console.log(response);
        response.chatHistory.reverse().map ((doc: any) => {
            let prompt = JSON.parse(doc);
            const userItem = {userType: "user", userMessage: prompt.prompt.question.content};
            const botItem = {userType: "system", userMessage: prompt.llm_response};
            setPrevChatHistory((prevChatHistory) => {
                // Add the new user message to the chat history
                const updatedHistory = [...prevChatHistory, userItem];
                // Add the bot response to the chat history
                updatedHistory.push(botItem);
                return updatedHistory;
            });

            
            
        });
        
    });

  }

  const validateParameters = (e: any) => {
        
    switch(e.target.id) {
        case 'maxTokens':
            if(e.target.value > 4000 || e.target.value < 0) {
                return;
            }
            setMaxTokens(e.target.value);
            setParameters(prevState => ({...prevState, maxTokens: e.target.value}));
            break;
        case 'topKSearchResults':
            if(e.target.value > 5 || e.target.value < 0) {
                return;
            }
            setTopKSearchResults(e.target.value);
            setParameters(prevState => ({...prevState, topKSearchResults: e.target.value}));
            break;            
        case 'temperature':
            if(e.target.value > 1 || e.target.value < 0) {
                return;
            }
            setTemperature(e.target.value);
            setParameters(prevState => ({...prevState, temperature: e.target.value}));
            break;
        case 'systemMessage':
            setSystemMessage(e.target.value);
            setParameters(prevState => ({...prevState, systemMessage: e.target.value}));
            break;
        case 'includeChatHistory':
            setIncludeChatHistory(!includeChatHistory);
            break;
        case 'useSearchEngine':
            setuseSearchEngine(!useSearchEngine);
            if(!useSearchEngine) {
                setSystemMessage("Assistant helps users with answers to the questions.\n Answer ONLY with the facts listed in the list of context below. If there isn't enough information below, say you don't know. \n   Do not generate answers that don't use the context below. \n  Each source has a name followed by colon and the actual information, always include the source name for each fact you use in the response.\n  Use square brakets to reference the source, e.g. [info1.txt]. Don't combine sources, list each source separately, e.g. [info1.txt][info2.pdf].");
            }
            else {  
                setSystemMessage("You are an Open AI assistant.");
            }
            break;
        case 'chatHistoryCount':
            if(e.target.value > 50 || e.target.value < 0) {
                return;
            }
            setChatHistoryCount(e.target.value)
            setParameters(prevState => ({...prevState, chatHistoryCount: e.target.value}));
            break;
        default:
            return;
    }
       
  }

  return (
      <div className="main-container-div">

            <div className="main-left-column">
              <input type="button" value="New Chat" className="btn-newchat" onClick={startNewChat} />
              <input type="button" value="Load Chat History" className="btn-newchat" onClick={() => { getChatHistory(); }} />
              <Accordion className="chat-settings" defaultActiveKey="0">
                <Accordion.Item eventKey="0">
                    <Accordion.Header>
                    <img className="icon" src={SettingsIconSvg} alt="icon" /><span>Settings</span>
                    </Accordion.Header>
                    <Accordion.Body>
                        <div className="setting-border mt-3">
                            <Form.Label htmlFor="useSearchEngine">Use Search Engine</Form.Label>
                            <Form.Check 
                                type="switch"
                                id="useSearchEngine"
                                label="Use Search engine to find answers"
                                onChange={validateParameters}
                                checked={useSearchEngine}
                            />
                           
                        </div>
                        <div className="setting-border mt-3">
                            <Form.Label htmlFor="topKSearchResults">Top K Search Results to include</Form.Label>
                            <Form.Control
                                type="number"
                                id="topKSearchResults"
                                aria-describedby="topKSearchResults"
                                onChange={validateParameters}
                                value={topKSearchResults}
                            />
                            <Form.Text id="topKSearchResultsHelp" >
                                Top K Search Results can range from 1 to 5.
                            </Form.Text>
                        </div>
                        <div className="setting-border mt-3">
                            <Form.Label htmlFor="maxTokens">Max Tokens</Form.Label>
                            <Form.Control
                                type="number"
                                id="maxTokens"
                                aria-describedby="maxTokens"
                                onChange={validateParameters}
                                value={maxTokens}
                            />
                            <Form.Text id="maxTokensHelp" >
                                Max Token can range from 1 to 4000.
                            </Form.Text>
                        </div>
                        <div className="setting-border mt-3 ">
                            <Form.Label htmlFor="temperature">Temperature</Form.Label>
                            <Form.Control
                                type="number"
                                id="temperature"
                                aria-describedby="temperature"
                                onChange={validateParameters}
                                value={temperature}
                            />
                            <Form.Text id="temperatureHelp" >
                                Temperature can range between 0 and 1.
                            </Form.Text>
                        </div>
                        <div className="setting-border mt-3 ">
                            <Form.Label htmlFor="systemMessage">System Message</Form.Label>
                            <Form.Control
                                type="text"
                                id="systemMessage"
                                aria-describedby="systemMessage"
                                onChange={validateParameters}
                                value={systemMessage}
                            />
                            <Form.Text id="systemMessageHelp" >
                                System Message sets the gaurd rails on ChatGPT LLM. Set your own System Message. 
                            </Form.Text>
                        </div>

                        <div className="setting-border mt-3 ">
                            <Form.Check 
                                type="switch"
                                id="includeChatHistory"
                                label="Include Chat History in Prompt"
                                onChange={validateParameters}
                                checked={includeChatHistory}
                            />

                        <Form.Label htmlFor="chatHistoryCount">Number of items to include from Chat History</Form.Label>
                            <Form.Control
                                type="number"
                                id="chatHistoryCount"
                                aria-describedby="chatHistoryCount"
                                onChange={validateParameters}
                                value={chatHistoryCount}
                            />
                            <Form.Text id="chatHistoryCountHelp">
                                This can range from 1 to 50. This can max out tokens and not return response.
                            </Form.Text>
                        </div>
                    </Accordion.Body>
                </Accordion.Item>
                </Accordion>
            </div>

          <Col md={9} className="ml-md-auto" style={{ height: "100vh", overflowY: "auto" }}>
              <div className="messages-container">
                <ul className="chat-item">
                    {
                        chatHistory.map((chat,index) => (
                        <li key={index} className={index % 2 === 0 ? 'chat-item-right' : 'chat-item-left'}>
                            <div className={index % 2 === 0 ? 'message-item-right' : 'message-item-left'}>
                                <div ><img src={index % 2 === 0 ? UserIconSvg :  BotIconSvg} alt="icon" /></div>
                                <div ref={divRef}  className={index % 2 === 0 ? 'chat-item-message-user' : 'chat-item-message-bot'}>
                                    {chat.userMessage} 
                                </div>
                            </div>
                        </li> 
                        
                    ))}
                </ul>
              </div>
              <div className="message-input-container">
                  <div className="message-input">
                      <textarea className="form-control" rows={3} placeholder="Type your query here. (Shift + Enter for new line)" value={userQuery} 
                          onChange={handleUserQueryChange}
                          onKeyDown={handleKeyPress}>  
                          disabled={isSending}                                  
                      </textarea>
                      <button disabled={isSending} className="btn-chat-send" onClick={sendMessage}>
                          <svg stroke="#3b3939" fill="none" strokeWidth="1" viewBox="0 0 30 30" width="20" height="20" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                      </button>
                  </div>
                  <div className="chat-status">
                      <span>total tokens:{usage?.total_tokens}</span>
                      <span> prompt tokens:{usage?.prompt_tokens}</span>
                      <span> completion tokens:{usage?.completion_tokens}</span>
                  </div>
              </div>
             
           </Col>
        </div>
    );
  }


export default ChatGPTUI;