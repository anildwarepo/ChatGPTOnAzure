import Col from 'react-bootstrap/Col';
import React, { useState, ChangeEvent, FormEvent } from 'react';
import "../styles/chatgptui.css";
import UserIconSvg from '../assets/user.svg';
import BotIconSvg from '../assets/bot.svg';
import {sendChatMessage, fetchChatHistory, fetcheBotApiStatus, uploadFile, check_progress} from '../services/chatService';
import { useRef, useEffect } from 'react';
import Accordion from 'react-bootstrap/Accordion';
import RangeSlider from 'react-bootstrap-range-slider';
import SettingsIconSvg from '../assets/settings.svg';
import config from "../config.json";

import Form from 'react-bootstrap/Form';
import { Prompt, Chat, ChatAPIRequest, GptPrompt } from '../services/interfaces/iprompt';
import { Row } from 'react-bootstrap';

export const ChatGPTUI = (props: any) => {
    const [entityId, setEntityId] = useState("");
    const [maxTokens , setMaxTokens] = useState(200);
    const [topKSearchResults , setTopKSearchResults] = useState(3);
    const [numChunk , setnumChunk] = useState(20);
    const [temperature , setTemperature] = useState(0.3);
    const [includeChatHistory , setIncludeChatHistory] = useState(true);
    const [useSearchEngine , setuseSearchEngine] = useState(true);
    const [useVectorCache , setuseVectorCache] = useState(true);
    const [file, setFile] = useState<File | null>(null);
    const [systemMessage , setSystemMessage] = useState("Assistant helps users with answers to the questions.\n Answer ONLY with the facts listed in the list of context below. If there isn't enough information below, say you don't know. \n   Do not generate answers that don't use the context below. \n  Each source has a name followed by colon and the actual information, always include the source name for each fact you use in the response.\n  Use square brakets to reference the source, e.g. [info1.txt]. Don't combine sources, list each source separately, e.g. [info1.txt][info2.pdf].");
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
    numChunk: 20,
    topKSearchResults: 3,
    temperature: 0.3,
    includeChatHistory: false,
    useSearchEngine: false,
    useVectorCache: false,
    chatHistoryCount: 10,
    chatHistory: '',
    userInfo: props.accounts[0]
  ? {
      name: props.accounts[0].name,
      email: props.accounts[0].username,
      tenantId: props.accounts[0].tenantId
    }
  : {
      name: 'local-user',
      email: config.email,
      tenantId: 'aad-tenant-id'
    }
  });

  useEffect(() => {
    getBotApiStatus();
  },[]);

  useEffect(() => {
    divRef.current?.scrollIntoView({ inline: 'nearest', block: 'start', behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
      setParameters(prevState => ({...prevState, topKSearchResults: Number(topKSearchResults)})); 
  }, [topKSearchResults]);

  useEffect(() => {
    setParameters(prevState => ({...prevState, numChunk: Number(numChunk)})); 
    }, [numChunk]);
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
        setParameters(prevState => ({...prevState, useVectorCache: useVectorCache})); 
        }, [useVectorCache]);
    
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

  useEffect(() => {
    if(!entityId){
        return;
    }
    const intervalId = setInterval(async () => {
      const result = await check_progress(entityId, props);
      if(result == "Success"){
        clearInterval(intervalId);
        const botItem = {userType: "log", userMessage: "File uploaded successfully."};
        setPrevChatHistory(() => {
            const updatedHistory = [...prevChatHistory, botItem];
            return updatedHistory;
        });
      }
      else
      {
        const botItem = {userType: "log", userMessage: result};
        setPrevChatHistory(() => {
            const updatedHistory = [...prevChatHistory, botItem];
            return updatedHistory;
        });
      }
    
    }, 2000);

    // Cleanup: Clear the interval when the component is unmounted
    return () => clearInterval(intervalId);
  }, [entityId]);

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
        chatAPIRequest.chatHistory = chatHistoryUserMessageString + '\n' + chatHistorySystemResponseString + '\n';
        chatAPIRequest.gptPrompt.question.content = 'Question: ' + userQuery;        
    }

    setIsSending(true);
    const userItem = {userType: "user", userMessage: userQuery};
    const userItems = [...chatHistory, userItem];
    setChatHistory(userItems);
    sendChatMessage(chatAPIRequest, props).then((response) => {
        //console.log(response);
        let botItem = null;
        if(response.response == null) {
            botItem = {userType: "system", userMessage: "Sorry, I am not able to answer your question at this time. Please try again later."}; 
            //botItem = {userType: "system", userMessage: response.response.llm_response};
        }
        else {
            botItem = {userType: "system", userMessage: response.response.llm_response};
            setUsage(response.response.usage);
        }
        
        const botItems = [...userItems, botItem];
        setChatHistory(botItems);
        
        setUserQuery('');
        setIsSending(false);

    });
    

    console.log(chatHistory.length);
  }

  const startNewChat = () => {
    setPrevChatHistory([]);
    setChatHistory([]);
    setUserQuery('');
    setUsage({completion_tokens:0, prompt_tokens: 0, total_tokens:0});
  }

  

  const getChatHistory = () => {
    setPrevChatHistory([]);
    fetchChatHistory(chatAPIRequest, props).then((response) => {
        //console.log(response);
        if(response.chatHistory == null) {
            const botItem = {userType: "system", userMessage: response.message};
            setPrevChatHistory(() => {
                const updatedHistory = [];
                updatedHistory.push(botItem);
                return updatedHistory;
            });
            return;
        }
        response.chatHistory!.reverse().map ((doc: any) => {
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

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
        setFile(event.target.files[0]);
      }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (file) {
        const formData = new FormData();
        formData.append('file', file);
        const userItem = {userType: "log", userMessage: "uploading file..."};
        setIsSending(true);
        uploadFile(formData, props).then((response) => {
            if(response) {
                const botItem = {userType: "log", userMessage: response.message};

                setPrevChatHistory(() => {
                    const updatedHistory = [...prevChatHistory, userItem];
                    updatedHistory.push(botItem);
                    return updatedHistory;
                });
                if ('entityId' in response) {
                    setEntityId(response.entityId);
                }
            
                setIsSending(false);
                
            }
        });

      } else {
        console.warn('No file selected');
      }
  };



    

  const getBotApiStatus = () => {
    setPrevChatHistory([]);
    fetcheBotApiStatus(props).then((response) => {
        const botItem = {userType: "log", userMessage: response.message};
        const userItem = {userType: "log", userMessage: "Fetching Bot API Status..."};
        setPrevChatHistory(() => {
            const updatedHistory = [...prevChatHistory, botItem];
            //updatedHistory.push(botItem);
            return updatedHistory;
        });
    });
  }

  

  const validateParameters = (e: any) => {
    switch(e.target.id) {
        case 'maxTokens':
            setMaxTokens(parseInt(e.target.value));
            setParameters(prevState => ({...prevState, maxTokens: parseInt(e.target.value)}));
            break;
        case 'topKSearchResults':
            setTopKSearchResults(parseInt(e.target.value));
            setParameters(prevState => ({...prevState, topKSearchResults: parseInt(e.target.value)}));
            break;
        case 'numChunk':
            setnumChunk(parseInt(e.target.value));
            setParameters(prevState => ({...prevState, numChunk: parseInt(e.target.value)}));
            break;        
        case 'chatHistoryCount':
            setChatHistoryCount(parseInt(e.target.value))
            setParameters(prevState => ({...prevState, chatHistoryCount: parseInt(e.target.value)}));
            break;     
        case 'temperature':
            setTemperature(parseFloat(e.target.value));
            setParameters(prevState => ({...prevState, temperature: parseFloat(e.target.value)}));
            break;
        case 'systemMessage':
            setSystemMessage(e.target.value);
            setParameters(prevState => ({...prevState, systemMessage: e.target.value}));
            break;
        case 'includeChatHistory':
            setIncludeChatHistory(!includeChatHistory);
            break;
        case 'useVectorCache':
            setuseVectorCache(!useVectorCache);
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
        
        default:
            return;
    }

  }

  const validateParameters2 = (e: any) => {
        
    switch(e.target.id) {
        case 'maxTokens':
            if(e.target.value >= 50 && e.target.value <= 4000) {
                setMaxTokens(e.target.value);
                setParameters(prevState => ({...prevState, maxTokens: e.target.value}));
            }
            
            break;
        case 'topKSearchResults':
            if(e.target.value >= 1 && e.target.value <= 20) {
                setTopKSearchResults(e.target.value);
                setParameters(prevState => ({...prevState, topKSearchResults: e.target.value}));
            }
            break;
        case 'numChunk':
            if(e.target.value >= 20 && e.target.value <= 200) {
                setnumChunk(e.target.value);
                setParameters(prevState => ({...prevState, numChunk: e.target.value}));
            }
            break;             
        case 'temperature':
            const newTemperature = parseFloat(e.target.value);    
            if(!isNaN(newTemperature) && newTemperature >= 0.0 && newTemperature <= 1.0) {
                setTemperature(newTemperature);
                setParameters(prevState => ({...prevState, temperature: newTemperature}));
            }
            break;
        case 'systemMessage':
            setSystemMessage(e.target.value);
            setParameters(prevState => ({...prevState, systemMessage: e.target.value}));
            break;
        case 'includeChatHistory':
            setIncludeChatHistory(!includeChatHistory);
            break;
        case 'useVectorCache':
            setuseVectorCache(!useVectorCache);
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
            //if(e.target.value >= 1 && e.target.value <= 50) {
            setChatHistoryCount(e.target.value)
            setParameters(prevState => ({...prevState, chatHistoryCount: e.target.value}));
            //}
            break;
        default:
            return;
    }
       
  }

  return (
      <div className="main-container-div">

            <div className="main-left-column">
           
            
            <input type="button" value="New Chat" className="btn-newchat" onClick={startNewChat} />
            {/*<input type="button" value="Load Chat History" className="btn-newchat" onClick={() => { getChatHistory(); }} /> */}
              <Accordion className="chat-settings" defaultActiveKey="0">
                <Accordion.Item eventKey="0">
                    <Accordion.Header>
                    <img className="icon" src={SettingsIconSvg} alt="icon" /><span>Azure OpenAI Settings</span>
                    </Accordion.Header>
                    <Accordion.Body>
                        <div className="setting-border mt-3">
                            <Form.Label htmlFor="maxTokens">Max Tokens</Form.Label>
                            <Form>
                                <Form.Group as={Row}>
                                    <Col xs="9">
                                    <RangeSlider
                                        value={maxTokens}
                                        id="maxTokens"
                                        min={1}
                                        max={4000}
                                        step={1}
                                        variant='success'
                                        onChange={changeEvent => validateParameters(changeEvent)}
                                    />
                                    </Col>
                                    <Col xs="3">
                                    <Form.Control value={maxTokens} readOnly />
                                    </Col>
                                </Form.Group>
                            </Form>
                           
                            <Form.Text id="maxTokensHelp" >
                                Max Token can range from 1 to 4000.
                            </Form.Text>
                        </div>
                        <div className="setting-border mt-3 ">
                            <Form.Label htmlFor="temperature">Temperature</Form.Label>
                            <Form>
                                <Form.Group as={Row}>
                                    <Col xs="9">
                                    <RangeSlider
                                        value={temperature}
                                        id="temperature"
                                        min={0}
                                        max={1}
                                        step={0.1}
                                        variant='success'
                                        onChange={changeEvent => validateParameters(changeEvent)}
                                    />
                                    </Col>
                                    <Col xs="3">
                                    <Form.Control value={temperature} readOnly/>
                                    </Col>
                                </Form.Group>
                            </Form>
                           
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
                            <Form>
                                <Form.Group as={Row}>
                                    <Col xs="9">
                                    <RangeSlider
                                        value={chatHistoryCount}
                                        id="chatHistoryCount"
                                        min={1}
                                        max={20}
                                        step={1}
                                        variant='success'
                                        onChange={changeEvent => validateParameters(changeEvent)}
                                    />
                                    </Col>
                                    <Col xs="3">
                                    <Form.Control value={chatHistoryCount} readOnly />
                                    </Col>
                                </Form.Group>
                            </Form>
                            
                           
                            <Form.Text id="chatHistoryCountHelp">
                                This can range from 1 to 20. This can max out tokens and not return response.
                            </Form.Text>
                        </div>
                    </Accordion.Body>
                </Accordion.Item>
                </Accordion>
                <Accordion className="chat-settings" defaultActiveKey="0">
                <Accordion.Item eventKey="0">
                    <Accordion.Header>
                    <img className="icon" src={SettingsIconSvg} alt="icon" /><span>Vector Search Settings</span>
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
                            <Form.Label htmlFor="useVectorCache">Use Vector Cache</Form.Label>
                            <Form.Check 
                                type="switch"
                                id="useVectorCache"
                                label="Cache LLM response in a VectorDB Cache"
                                onChange={validateParameters}
                                checked={useVectorCache}
                            />
                           
                        </div>
                        <div className="setting-border mt-3">
                            <Form.Label htmlFor="topKSearchResults">Top K Search Results to include</Form.Label>
                            <Form>
                                <Form.Group as={Row}>
                                    <Col xs="9">
                                    <RangeSlider
                                        value={topKSearchResults}
                                        id="topKSearchResults"
                                        min={1}
                                        max={20}
                                        step={1}
                                        variant='success'
                                        onChange={changeEvent => validateParameters(changeEvent)}
                                    />
                                    </Col>
                                    <Col xs="3">
                                    <Form.Control value={topKSearchResults} readOnly />
                                    </Col>
                                </Form.Group>
                            </Form>
                           
                            <Form.Text id="topKSearchResultsHelp" >
                                Top K Search Results can range from 1 to 20.
                            </Form.Text>
                        </div>
                        <div className="setting-border mt-3">
                            <Form.Label htmlFor="uploadFile">Add File to Vector Index (max 100MB)</Form.Label>
                            <form onSubmit={handleSubmit}>
                                <input type="file" onChange={handleFileChange} />
                                <button type="submit" disabled={isSending} >Upload</button>
                            </form>
                           
                        </div>
                        <div className="setting-border mt-3">
                            <Form.Label htmlFor="numChunk">Number of lines in chunk</Form.Label>
                            <Form>
                                <Form.Group as={Row}>
                                    <Col xs="9">
                                    <RangeSlider
                                        value={numChunk}
                                        id="numChunk"
                                        min={1}
                                        max={20}
                                        step={1}
                                        variant='success'
                                        onChange={changeEvent => validateParameters(changeEvent)}
                                    />
                                    </Col>
                                    <Col xs="3">
                                    <Form.Control value={numChunk} readOnly />
                                    </Col>
                                </Form.Group>
                            </Form>
                            
                            <Form.Text id="numChunkHelp" >
                                The uploaded file will be chunked and each chunk will be indexed.
                                Max line in each chunk can range from 1 to 20.
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
                        <li key={index} className={chat.userType === 'user' ? 'chat-item-right' : 'chat-item-left'}>
                            <div className={chat.userType === 'user' ? 'message-item-right' : 'message-item-left'}>
                                <div ><img src={chat.userType === 'user' ? UserIconSvg :  BotIconSvg} alt="icon" /></div>
                                <div ref={divRef}  className={chat.userType === 'user' ? 'chat-item-message-user' : 'chat-item-message-bot'}>
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