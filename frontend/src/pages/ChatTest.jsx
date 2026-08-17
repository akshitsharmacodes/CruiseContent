import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const ChatTest = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);
  const location = useLocation();

  // Extract user_id from query params, or default to anonymous
  const queryParams = new URLSearchParams(location.search);
  const userId = queryParams.get('user_id') || 'anonymous_' + Math.floor(Math.random() * 1000);

  useEffect(() => {
    // Connect to WebSocket
    const wsUrl = `ws://localhost:8000/ws/chat/?user_id=${userId}`;
    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onopen = () => {
      console.log('Connected to chat WebSocket');
      setIsConnected(true);
    };

    socketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessages((prevMessages) => [...prevMessages, data]);
    };

    socketRef.current.onclose = () => {
      console.log('Disconnected from chat WebSocket');
      setIsConnected(false);
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [userId]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (inputMessage.trim() !== '' && socketRef.current && isConnected) {
      socketRef.current.send(JSON.stringify({
        message: inputMessage
      }));
      setInputMessage('');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2>Chat Test (User: {userId})</h2>
      <div style={{ marginBottom: '10px' }}>
        Status: {isConnected ? <span style={{ color: 'green' }}>Connected</span> : <span style={{ color: 'red' }}>Disconnected</span>}
      </div>
      
      <div style={{ 
        border: '1px solid #ccc', 
        height: '400px', 
        overflowY: 'scroll', 
        padding: '10px',
        marginBottom: '10px',
        backgroundColor: '#f9f9f9',
        borderRadius: '5px'
      }}>
        {messages.map((msg, index) => (
          <div key={index} style={{ 
            marginBottom: '10px',
            textAlign: msg.sender === userId ? 'right' : 'left'
          }}>
            <span style={{ fontSize: '0.8em', color: '#666' }}>{msg.sender}</span>
            <div style={{
              display: 'inline-block',
              padding: '8px 12px',
              borderRadius: '15px',
              backgroundColor: msg.sender === userId ? '#007bff' : '#e9ecef',
              color: msg.sender === userId ? 'white' : 'black',
              marginLeft: '5px',
              marginRight: '5px'
            }}>
              {msg.message}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={sendMessage} style={{ display: 'flex' }}>
        <input 
          type="text" 
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type a message..."
          style={{ flexGrow: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
          disabled={!isConnected}
        />
        <button 
          type="submit"
          style={{ 
            padding: '10px 20px', 
            marginLeft: '10px', 
            backgroundColor: '#28a745', 
            color: 'white', 
            border: 'none', 
            borderRadius: '5px',
            cursor: isConnected ? 'pointer' : 'not-allowed'
          }}
          disabled={!isConnected}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatTest;
