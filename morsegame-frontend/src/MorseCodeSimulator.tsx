import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Users, Radio } from 'lucide-react';

const MorseCodeSimulator = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [participantName, setParticipantName] = useState('');
  const [team, setTeam] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSender, setIsSender] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentSender, setCurrentSender] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [morseBuffer, setMorseBuffer] = useState('');
  const [lastSignal, setLastSignal] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [pressStartTime, setPressStartTime] = useState(null);

  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const transmitTimeoutRef = useRef(null);
  const bufferTimeoutRef = useRef(null);
  const oscillatorRef = useRef(null);
  const gainNodeRef = useRef(null);

  // Use refs to store current values that can be accessed in closures
  const isSenderRef = useRef(isSender);
  const isMutedRef = useRef(isMuted);
  const participantNameRef = useRef(participantName);

  // Update refs whenever state changes
  useEffect(() => {
    isSenderRef.current = isSender;
  }, [isSender]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    participantNameRef.current = participantName;
  }, [participantName]);

  const API_BASE = window.location.port === '5173' ? 'http://localhost:8080' : 'https://';

  // Get URL parameters on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const teamParam = urlParams.get('team');
    const nameParam = urlParams.get('name');

    if (teamParam) setTeam(teamParam);
    if (nameParam) setParticipantName(nameParam);
  }, []);

  // Morse code mapping
  const morseCode = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
    'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
    'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
    'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
    'Y': '-.--', 'Z': '--..', '1': '.----', '2': '..---', '3': '...--',
    '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..',
    '9': '----.', '0': '-----', ' ': '/'
  };

  const reverseMorse = Object.fromEntries(
    Object.entries(morseCode).map(([key, value]) => [value, key])
  );


  // Initialize WebSocket connection
  useEffect(() => {
    if (!isAuthenticated || !team || !participantName) return;

    const connectWebSocket = () => {
      try {
        // Construct WebSocket URL with team and participant name
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${API_BASE.replace('http', 'ws')}/ws/${team}?name=${participantName}`;

        console.log('Connecting to WebSocket:', wsUrl);

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('WebSocket connected');
          setIsConnected(true);
          wsRef.current = ws;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('Received message:', data);

            switch (data.class_type) {
              case 'MorseSignal':
                // Use refs to get current values instead of stale closure values
                if (!isMutedRef.current) {
                  //playMorseSound(data.signal === 'dot' ? 600 : 400, data.duration || (data.signal === 'dot' ? 150 : 400));
                  playMorseSound(600, data.duration || (data.signal === 'dot' ? 150 : 400));
                }
                break;

              case 'SenderChange':
                setCurrentSender(data.sender);
                // Update isSender based on whether we are the current sender
                console.log(data.sender === participantNameRef.current || data.sender === 'You')
                setIsSender(data.sender === participantNameRef.current || data.sender === 'You');
                break;

              case 'ParticipantsUpdate':
                setParticipants(data.participants || []);
                break;

              case 'error':
                console.error('Server error:', data.message);
                break;

              default:
                console.log('Unknown message type:', data.type);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          setIsConnected(false);
          setIsSender(false);
          setCurrentSender(null);

          // Attempt to reconnect after 3 seconds if not a normal closure
          if (event.code !== 1000) {
            setTimeout(connectWebSocket, 3000);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setIsConnected(false);
        };

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        setIsConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [isAuthenticated, team, participantName]);

  // Audio setup
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  const startMorseSound = () => {
    if (!audioContextRef.current || isMuted || oscillatorRef.current) return;
    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);

    oscillator.frequency.setValueAtTime(800, audioContextRef.current.currentTime);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);

    oscillator.start();

    oscillatorRef.current = oscillator;
    gainNodeRef.current = gainNode;
  };

  const stopMorseSound = () => {
    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
      oscillatorRef.current = null;
      gainNodeRef.current = null;
    }
  };

  const playMorseSound = (frequency, duration = 150) => {
    if (!audioContextRef.current || isMutedRef.current) return;

    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);

    oscillator.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + duration / 1000);

    oscillator.start(audioContextRef.current.currentTime);
    oscillator.stop(audioContextRef.current.currentTime + duration / 1000);
  };

  const addToMorseBuffer = (signal) => {
    setMorseBuffer(prev => {
      const newBuffer = prev + signal;

      // Clear existing timeout
      if (bufferTimeoutRef.current) {
        clearTimeout(bufferTimeoutRef.current);
      }

      // Set new timeout to decode after 2 seconds of inactivity
      bufferTimeoutRef.current = setTimeout(() => {
        //decodeMorseBuffer(newBuffer);
        setMorseBuffer('');
      }, 2000);

      return newBuffer;
    });
  };

  const decodeMorseBuffer = (buffer) => {
    // Split by spaces and decode each morse sequence
    const sequences = buffer.split('   '); // Three spaces indicate word separation
    const decoded = sequences.map(sequence => {
      const letters = sequence.split(' '); // Single space between letters
      return letters.map(letter => reverseMorse[letter] || '?').join('');
    }).join(' ');

    if (decoded.trim()) {
      console.log('Decoded morse:', decoded);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const teamParam = urlParams.get('team');
    const nameParam = urlParams.get('name');

    // Try to load from cache first
    const cachedAuth = localStorage.getItem('morseAuth');
    if (cachedAuth) {
      try {
        const { team, participantName, password } = JSON.parse(cachedAuth);
        setTeam(teamParam || team);
        setParticipantName(nameParam || participantName);
        setPassword(password);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error loading cached auth:', error);
        localStorage.removeItem('morseAuth');
      }
    } else {
      // Fall back to URL params
      if (teamParam) setTeam(teamParam);
      if (nameParam) setParticipantName(nameParam);
    }
  }, []);

  const handleAuth = async () => {
    if (!participantName.trim() || !team || !password) {
      setAuthError('Please fill in all fields');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/${team}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team, password })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Authentication successful:', result);

        // Cache the auth data
        localStorage.setItem('morseAuth', JSON.stringify({
          team,
          participantName,
          password
        }));

        setIsAuthenticated(true);
        setAuthError('');

        const newUrl = new URL(window.location);
        newUrl.searchParams.set('team', team);
        newUrl.searchParams.set('name', participantName);
        window.history.replaceState({}, '', newUrl);

      } else {
        const error = await response.json();
        setAuthError(error.message || 'Authentication failed');
      }
    } catch (error) {
      console.error('Auth error:', error);
      setAuthError('Connection error. Please try again.');
    }
  };

  const handleLogout = () => {
    // Clear cache
    localStorage.removeItem('morseAuth');

    // Reset all state
    setIsAuthenticated(false);
    setParticipantName('');
    setTeam('');
    setPassword('');
    setAuthError('');
    setIsSender(false);
    setIsConnected(false);
    setCurrentSender(null);
    setParticipants([]);
    setMorseBuffer('');
    setLastSignal('');

    // Close WebSocket connection
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close(1000, 'Logging out');
    }

    // Clear URL params
    const newUrl = new URL(window.location);
    newUrl.searchParams.delete('team');
    newUrl.searchParams.delete('name');
    window.history.replaceState({}, '', newUrl);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAuth();
    }
  };

  const electAsSender = () => {
    if (!isSender && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        wstype: 'elect_sender'
      }));
    }
  };

  const releaseSender = () => {
    if (isSender && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        wstype: 'release_sender'
      }));
    }
  };

  const startTransmission = () => {
    if (!isSender) return;

    const now = Date.now();
    setPressStartTime(now);
    setIsTransmitting(true);
    if (!isMuted) {
      startMorseSound();
    }
  };

  const endTransmission = () => {
    if (!isSender || !pressStartTime) return;

    const duration = Date.now() - pressStartTime;
    const signal = duration < 200 ? 'dot' : 'dash'; // 200ms threshold

    setIsTransmitting(false);
    setPressStartTime(null);
    stopMorseSound();
    setLastSignal(signal);

    // Send to server
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        wstype: 'morse_signal',
        signal: signal,
        duration: duration
      }));
    }

    // Add to local buffer for visual feedback
    // addToMorseBuffer(signal === 'dot' ? '.' : '-');
  };

  const handleMouseDown = () => {
    startTransmission();
  };

  const handleMouseUp = () => {
    endTransmission();
  };

  const handleMouseLeave = () => {
    // End transmission if mouse leaves while pressed
    if (isTransmitting) {
      endTransmission();
    }
  };

  const handleTouchStart = (e) => {
    e.preventDefault();
    startTransmission();
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    endTransmission();
  };

  // Show authentication form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="h-screen w-screen  bg-slate-900  text-white flex items-center justify-center">
        <div className="bg-slate-800/30 backdrop-blur-sm rounded-lg p-8 max-w-md">
          <div className="text-center mb-6">
            <Radio className="h-12 w-12 text-blue-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold">Lone Elk Morse Code Communicator</h1>
            <p className="text-slate-400 mt-2">Join your team</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Participant Name
              </label>
              <input
                type="text"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Team
              </label>
              <select
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select team</option>
                <option value="team-a">Team A</option>
                <option value="team-b">Team B</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter team password"
              />
            </div>

            {authError && (
              <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm">
                {authError}
              </div>
            )}

            <button
              onClick={handleAuth}
              className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              Join Team
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-900 text-white overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 px-4 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Radio className="h-8 w-8 text-blue-400" />
            <h1 className="text-2xl font-bold">Lone Elk Morse Code Communicator</h1>
            <div className="text-slate-400">
              {participantName} @ {team}
            </div>
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
              isConnected ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-400' : 'bg-red-400'
              }`} />
              <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>


          <div className="flex items-center space-x-4">
            <button
              onClick={handleLogout}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
            >
              Logout
            </button>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-2 rounded-lg transition-colors ${
                isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {/* Participants */}
        <div className="bg-slate-800/30 backdrop-blur-sm rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-3 mb-3">
            <Users className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold">Participants ({participants.length})</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {participants.map((participant, index) => (
              <div
                key={index}
                className={`px-3 py-1 rounded-full text-sm ${
                  currentSender === participant
                    ? 'bg-green-600/30 text-green-300 border border-green-500/50'
                    : 'bg-slate-700/50 text-slate-300'
                }`}
              >
                {participant}
                {currentSender === participant && ' (Sender)'}
              </div>
            ))}
          </div>
        </div>

        {/* Sender Control */}
        <div className="bg-slate-800/30 backdrop-blur-sm rounded-lg p-6 mb-6">

          <div className="text-center">
            {currentSender === null ? (
              // No one is sender - anyone can elect
              <button
                onClick={electAsSender}
                disabled={!isConnected}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Elect as Sender
              </button>
            ) : isSender ? (
              // You are the current sender
              <div className="space-y-4">
                <div className="text-green-400 font-semibold">You are the sender</div>
                <button
                  onClick={releaseSender}
                  className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Release Sender Role
                </button>
              </div>
            ) : (
              // Someone else is sender - show option to take over
              <div className="space-y-4">
                <div className="text-slate-400">
                  {currentSender} is currently the sender
                </div>
                <button
                  onClick={electAsSender}
                  disabled={!isConnected}
                  className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-slate-600 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Take Over as Sender
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Transmission Controls */}
        <div className="bg-slate-800/30 backdrop-blur-sm rounded-lg p-8">
          <div className="text-center space-y-6">
            <h2 className="text-xl font-semibold mb-6">Morse Code Transmitter</h2>

            {/* Signal Display */}
            {/*<div className="bg-slate-900/50 rounded-lg p-4 mb-6">*/}
            {/*  <div className="text-sm text-slate-400 mb-2">Last Signal:</div>*/}
            {/*  <div className="text-2xl font-mono">*/}
            {/*    {lastSignal === 'dot' && <span className="text-yellow-400">•</span>}*/}
            {/*    {lastSignal === 'dash' && <span className="text-yellow-400">−</span>}*/}
            {/*    {!lastSignal && <span className="text-slate-600">−</span>}*/}
            {/*  </div>*/}
            {/*</div>*/}

            {/*/!* Current Buffer *!/*/}
            {/*<div className="bg-slate-900/50 rounded-lg p-4 mb-6">*/}
            {/*  <div className="text-sm text-slate-400 mb-2">Current Buffer:</div>*/}
            {/*  <div className="text-xl font-mono text-blue-300 min-h-[1.5rem]">*/}
            {/*    {morseBuffer || '−'}*/}
            {/*  </div>*/}
            {/*</div>*/}

            {/* Transmission Controls */}
            <div className="flex justify-center">
              <button
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                disabled={!isSender || !isConnected}
                className={`w-32 h-32 rounded-full font-bold text-xl transition-all transform select-none ${
                  isSender && isConnected
                    ? isTransmitting
                      ? 'bg-red-500 scale-95 shadow-lg shadow-red-500/30 text-white'
                      : 'bg-blue-600 hover:bg-blue-500 hover:scale-105 shadow-lg hover:shadow-blue-600/30 text-white'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
                style={{ userSelect: 'none', touchAction: 'none' }}
              >
                {isSender && isConnected ? (isTransmitting ? (
                  <div className="text-center leading-tight">
                    SENDING
                  </div>
                ) : 'PRESS & HOLD') : !isConnected ? 'DISCONNECTED' : 'NOT SENDER'}
              </button>
            </div>

            <div className="text-sm text-slate-400 mt-4">
              {isSender && isConnected
                ? 'Hold down to transmit • Short press = dot (•) • Long press = dash (−)'
                : !isConnected
                  ? 'Waiting for connection...'
                  : 'You must be the sender to transmit'
              }
            </div>
          </div>
        </div>

        {/* Morse Code Reference */}
        <div className="bg-slate-800/30 backdrop-blur-sm rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold mb-4">Morse Code Reference</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-sm font-mono">
            {Object.entries(morseCode).slice(0, 26).map(([letter, morse]) => (
              <div key={letter} className="bg-slate-700/30 rounded px-2 py-1">
                <span className="text-blue-300">{letter}</span>
                <span className="text-slate-300 ml-2">{morse}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MorseCodeSimulator;