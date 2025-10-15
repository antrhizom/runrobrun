import React, { useState, useEffect } from 'react';
import { Trophy, Play, Users, User, Plus, X, LogIn, Settings, Sparkles, BookOpen, ArrowLeft } from 'lucide-react';
import { db } from './firebase';
import { collection, addDoc, doc, getDoc, getDocs, setDoc, updateDoc, onSnapshot, query, where, deleteDoc } from 'firebase/firestore';

const RobotRaceGame = () => {
  const [view, setView] = useState('home');
  const [userRole, setUserRole] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [roomId, setRoomId] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState(null);
  
  const [classrooms, setClassrooms] = useState([]);
  const [currentClassroom, setCurrentClassroom] = useState(null);
  const [classroomName, setClassroomName] = useState('');
  
  const [questions, setQuestions] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [difficulty, setDifficulty] = useState('mittel');
  const [questionCount, setQuestionCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [players, setPlayers] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [answerHistory, setAnswerHistory] = useState([]);

  const robots = ['🤖', '🦾', '🦿', '🛸', '👾', '🚀'];
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500'];

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  // ChatGPT API statt Claude
 const generateQuestionsWithAI = async () => {
  setIsGenerating(true);
  try {
    const response = await fetch("https://runrobrun.vercel.app/api/generate-questions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: selectedTopic,
        difficulty: difficulty,
        questionCount: questionCount
      })
    });

    if (!response.ok) {
      throw new Error(`Backend Error: ${response.status}`);
    }

    const data = await response.json();
    setQuestions(data.questions);
    setIsGenerating(false);
    return true;
  } catch (error) {
    console.error("Fehler beim Generieren:", error);
    setIsGenerating(false);
    alert("Fehler beim Generieren der Fragen: " + error.message);
    return false;
  }
};

  const startSinglePlayer = async () => {
    if (!selectedTopic) {
      alert("Bitte wähle ein Thema!");
      return;
    }
    const success = await generateQuestionsWithAI();
    if (success) {
      setPlayerName("Du");
      setPlayers([
        {
          id: 1,
          name: "Du",
          position: 0,
          score: 0,
          robot: robots[0],
          color: colors[0],
          isComputer: false
        },
        {
          id: 2,
          name: "Computer",
          position: 0,
          score: 0,
          robot: robots[1],
          color: colors[1],
          isComputer: true
        }
      ]);
      setGameStarted(true);
      setView('game');
    }
  };

  const createMultiplayerRoom = async () => {
    if (!selectedTopic || !playerName) {
      alert("Bitte fülle alle Felder aus!");
      return;
    }
    const success = await generateQuestionsWithAI();
    if (success) {
      const code = generateRoomCode();
      const newPlayerId = Date.now().toString();
      
      try {
        const roomRef = await addDoc(collection(db, 'rooms'), {
          code: code,
          topic: selectedTopic,
          difficulty: difficulty,
          questionCount: questionCount,
          questions: questions,
          players: [{
            id: newPlayerId,
            name: playerName,
            position: 0,
            score: 0,
            robot: robots[0],
            color: colors[0]
          }],
          status: 'waiting',
          currentQuestion: 0,
          gameStarted: false,
          createdAt: new Date().toISOString(),
          hostId: newPlayerId
        });
        
        setRoomCode(code);
        setRoomId(roomRef.id);
        setPlayerId(newPlayerId);
        setUserRole('host');
        setView('player-wait');
      } catch (error) {
        console.error("Fehler beim Erstellen des Raums:", error);
        alert("Fehler beim Erstellen des Raums!");
      }
    }
  };

  const joinMultiplayerRoom = async () => {
    if (!roomCode.trim() || !playerName.trim()) {
      alert("Bitte fülle alle Felder aus!");
      return;
    }

    try {
      const roomsRef = collection(db, 'rooms');
      const q = query(roomsRef, where('code', '==', roomCode.toUpperCase()));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        alert("Raum nicht gefunden! Prüfe den Code.");
        return;
      }

      const roomDoc = snapshot.docs[0];
      const roomData = roomDoc.data();
      
      if (roomData.gameStarted) {
        alert("Spiel hat bereits begonnen!");
        return;
      }

      const newPlayerId = Date.now().toString();
      const newPlayer = {
        id: newPlayerId,
        name: playerName,
        position: 0,
        score: 0,
        robot: robots[roomData.players.length % robots.length],
        color: colors[roomData.players.length % colors.length]
      };

      await updateDoc(doc(db, 'rooms', roomDoc.id), {
        players: [...roomData.players, newPlayer]
      });

      setRoomId(roomDoc.id);
      setPlayerId(newPlayerId);
      setRoomCode(roomCode.toUpperCase());
      setQuestions(roomData.questions);
      setUserRole('player');
      setView('player-wait');
    } catch (error) {
      console.error("Fehler beim Beitreten:", error);
      alert("Fehler beim Beitreten des Raums!");
    }
  };

  // Echtzeit-Listener für Multiplayer-Raum
  useEffect(() => {
    if (!roomId) return;

    const unsubscribe = onSnapshot(doc(db, 'rooms', roomId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setPlayers(data.players || []);
        
        if (data.gameStarted && !gameStarted) {
          setGameStarted(true);
          setQuestions(data.questions);
          setCurrentQuestion(data.currentQuestion || 0);
          setView('game');
        }
        
        if (data.currentQuestion !== undefined) {
          setCurrentQuestion(data.currentQuestion);
        }
      }
    });

    return () => unsubscribe();
  }, [roomId]);

  const startMultiplayerGame = async () => {
    if (userRole !== 'host') return;
    
    try {
      await updateDoc(doc(db, 'rooms', roomId), {
        gameStarted: true,
        status: 'playing',
        currentQuestion: 0
      });
    } catch (error) {
      console.error("Fehler beim Starten:", error);
    }
  };

  const createClassroom = async () => {
    if (!classroomName.trim()) {
      alert("Bitte gib einen Klassennamen ein!");
      return;
    }
    
    try {
      const classroomRef = await addDoc(collection(db, 'classrooms'), {
        name: classroomName,
        code: generateRoomCode(),
        questions: [],
        students: [],
        results: [],
        createdAt: new Date().toISOString()
      });
      
      alert("Klassenraum erstellt!");
      setClassroomName('');
      loadClassrooms();
    } catch (error) {
      console.error("Fehler beim Erstellen:", error);
      alert("Fehler beim Erstellen des Klassenraums!");
    }
  };

  const loadClassrooms = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'classrooms'));
      const classroomList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClassrooms(classroomList);
    } catch (error) {
      console.error("Fehler beim Laden:", error);
    }
  };

  useEffect(() => {
    if (view === 'organizer') {
      loadClassrooms();
    }
  }, [view]);

  const handleAnswer = async (answerIndex) => {
    setSelectedAnswer(answerIndex);
    setShowFeedback(true);

    const isCorrect = answerIndex === questions[currentQuestion].correct;
    
    // Speichere Antwort in Historie
    const answerRecord = {
      question: questions[currentQuestion].question,
      answers: questions[currentQuestion].answers,
      correctIndex: questions[currentQuestion].correct,
      selectedIndex: answerIndex,
      isCorrect: isCorrect
    };
    setAnswerHistory([...answerHistory, answerRecord]);
    
    if (roomId && playerId) {
      // Multiplayer: Update in Firebase
      try {
        const roomRef = doc(db, 'rooms', roomId);
        const roomSnap = await getDoc(roomRef);
        const roomData = roomSnap.data();
        
        const updatedPlayers = roomData.players.map(p => {
          if (p.id === playerId && isCorrect) {
            return {
              ...p,
              position: p.position + 1,
              score: p.score + 10
            };
          }
          return p;
        });

        await updateDoc(roomRef, {
          players: updatedPlayers
        });
      } catch (error) {
        console.error("Fehler beim Update:", error);
      }
    } else {
      // Einzelspieler: Lokal
      const updatedPlayers = [...players];
      
      if (isCorrect) {
        const playerIndex = players.findIndex(p => !p.isComputer);
        if (playerIndex !== -1) {
          updatedPlayers[playerIndex].position += 1;
          updatedPlayers[playerIndex].score += 10;
        }
      }

      const computerPlayer = players.find(p => p.isComputer);
      if (computerPlayer) {
        let computerCorrectChance = 0.7;
        if (difficulty === 'leicht') computerCorrectChance = 0.5;
        if (difficulty === 'schwer') computerCorrectChance = 0.85;
        
        const computerIsCorrect = Math.random() < computerCorrectChance;
        if (computerIsCorrect) {
          const computerIndex = players.findIndex(p => p.isComputer);
          if (computerIndex !== -1) {
            updatedPlayers[computerIndex].position += 1;
            updatedPlayers[computerIndex].score += 10;
          }
        }
      }

      setPlayers(updatedPlayers);
    }

    setTimeout(async () => {
      setShowFeedback(false);
      setSelectedAnswer(null);
      
      if (currentQuestion < questions.length - 1) {
        const nextQuestion = currentQuestion + 1;
        
        if (roomId && userRole === 'host') {
          await updateDoc(doc(db, 'rooms', roomId), {
            currentQuestion: nextQuestion
          });
        } else if (!roomId) {
          setCurrentQuestion(nextQuestion);
        }
      } else {
        setGameFinished(true);
        setView('results');
        
        if (roomId) {
          await updateDoc(doc(db, 'rooms', roomId), {
            status: 'finished'
          });
        }
      }
    }, 1500);
  };

  const resetGame = () => {
    setView('home');
    setUserRole(null);
    setRoomCode('');
    setRoomId(null);
    setPlayerId(null);
    setPlayerName('');
    setSelectedTopic('');
    setCurrentQuestion(0);
    setPlayers([]);
    setGameStarted(false);
    setGameFinished(false);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setQuestions([]);
  };

  if (view === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <div className="text-8xl mb-4">🤖</div>
            <h1 className="text-6xl font-bold text-white mb-4">Roboter-Rennen</h1>
            <p className="text-xl text-white/90">KI-gestütztes Quiz-Rennspiel</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <button
              onClick={() => setView('single-setup')}
              className="bg-white rounded-2xl p-8 shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300"
            >
              <User className="w-16 h-16 mx-auto mb-4 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Einzelspieler</h2>
              <p className="text-gray-600">Alleine gegen die Zeit spielen</p>
            </button>

            <button
              onClick={() => setView('multi-create')}
              className="bg-white rounded-2xl p-8 shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300"
            >
              <Users className="w-16 h-16 mx-auto mb-4 text-green-600" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Mehrspieler</h2>
              <p className="text-gray-600">Online mit Freunden spielen</p>
            </button>

            <button
              onClick={() => setView('organizer')}
              className="bg-white rounded-2xl p-8 shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300"
            >
              <Settings className="w-16 h-16 mx-auto mb-4 text-purple-600" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Lernorganisator</h2>
              <p className="text-gray-600">Klassenräume verwalten</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'single-setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8">
          <button onClick={() => setView('home')} className="mb-6 text-gray-600 hover:text-gray-800 flex items-center">
            <ArrowLeft className="mr-2" size={20} />
            Zurück
          </button>
          
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🤖</div>
            <h2 className="text-4xl font-bold text-gray-800 mb-2">Einzelspieler</h2>
            <p className="text-gray-600">Wähle ein Thema und die KI erstellt Fragen für dich!</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-3">
                <Sparkles className="inline mr-2 text-yellow-500" size={20} />
                Wähle dein Thema:
              </label>
              <input
                type="text"
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                placeholder="z.B. Mathematik, Geschichte, Biologie..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
              />
            </div>

            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-3">Schwierigkeitsgrad:</label>
              <div className="grid grid-cols-3 gap-3">
                {['leicht', 'mittel', 'schwer'].map((level) => (
                  <button
                    key={level}
                    onClick={() => setDifficulty(level)}
                    className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                      difficulty === level
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-3">Anzahl Fragen:</label>
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
              >
                <option value={3}>3 Fragen</option>
                <option value={5}>5 Fragen</option>
                <option value={10}>10 Fragen</option>
                <option value={15}>15 Fragen</option>
              </select>
            </div>

            <button
              onClick={startSinglePlayer}
              disabled={!selectedTopic || isGenerating}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-bold text-xl hover:from-green-600 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="inline mr-2 animate-spin" size={24} />
                  KI erstellt Fragen...
                </>
              ) : (
                <>
                  <Play className="inline mr-2" size={24} />
                  Spiel starten
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'multi-create') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8">
          <button onClick={() => setView('home')} className="mb-6 text-gray-600 hover:text-gray-800 flex items-center">
            <ArrowLeft className="mr-2" size={20} />
            Zurück
          </button>
          
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">👥</div>
            <h2 className="text-4xl font-bold text-gray-800 mb-2">Mehrspieler erstellen</h2>
            <p className="text-gray-600">Erstelle ein Online-Spiel!</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-3">Dein Name:</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Wie heißt du?"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none text-lg"
              />
            </div>

            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-3">
                <Sparkles className="inline mr-2 text-yellow-500" size={20} />
                Thema:
              </label>
              <input
                type="text"
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                placeholder="z.B. Geographie, Deutsch, Musik..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none text-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-3">Schwierigkeit:</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                >
                  <option value="leicht">Leicht</option>
                  <option value="mittel">Mittel</option>
                  <option value="schwer">Schwer</option>
                </select>
              </div>
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-3">Fragen:</label>
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                >
                  <option value={3}>3</option>
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={createMultiplayerRoom}
                disabled={!selectedTopic || !playerName || isGenerating}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-bold text-xl hover:from-green-600 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                {isGenerating ? "Wird erstellt..." : "Raum erstellen"}
              </button>
              <button
                onClick={() => setView('multi-join')}
                className="flex-1 bg-gray-200 text-gray-800 py-4 rounded-xl font-bold text-xl hover:bg-gray-300 transition-all"
              >
                Raum beitreten
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'multi-join') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
          <button onClick={() => setView('multi-create')} className="mb-6 text-gray-600 hover:text-gray-800 flex items-center">
            <ArrowLeft className="mr-2" size={20} />
            Zurück
          </button>
          
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🔗</div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Raum beitreten</h2>
            <p className="text-gray-600">Gib den Code ein</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-3">Raumcode:</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="6-stelliger Code"
                maxLength={6}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-center text-2xl font-mono focus:border-green-500 focus:outline-none"
              />
            </div>
            
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-3">Dein Name:</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Wie heißt du?"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none text-lg"
              />
            </div>

            <button
              onClick={joinMultiplayerRoom}
              disabled={!roomCode || !playerName}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-bold text-xl hover:from-green-600 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              <LogIn className="inline mr-2" size={24} />
              Beitreten
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'player-wait') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4 animate-bounce">🤖</div>
            <h2 className="text-4xl font-bold text-gray-800 mb-4">Warte auf andere Spieler...</h2>
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-6 text-white mb-6">
              <p className="text-sm opacity-90 mb-2">Raumcode zum Teilen:</p>
              <p className="text-5xl font-bold font-mono tracking-wider">{roomCode}</p>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-700 mb-4">Angemeldete Spieler ({players.length}):</h3>
            <div className="grid grid-cols-2 gap-4">
              {players.map((player) => (
                <div key={player.id} className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg p-4 text-center">
                  <div className="text-4xl mb-2">{player.robot}</div>
                  <p className="font-semibold text-gray-800">{player.name}</p>
                </div>
              ))}
            </div>
          </div>

          {userRole === 'host' && (
            <button
              onClick={startMultiplayerGame}
              disabled={players.length < 1}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-bold text-xl hover:from-green-600 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              <Play className="inline mr-2" size={24} />
              Spiel starten
            </button>
          )}
          
          {userRole !== 'host' && (
            <div className="text-center text-gray-600">
              <p>Warte bis der Host das Spiel startet...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'organizer') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 p-6">
        <div className="max-w-6xl mx-auto">
          <button onClick={() => setView('home')} className="mb-6 text-gray-600 hover:text-gray-800 flex items-center">
            <ArrowLeft className="mr-2" size={20} />
            Zurück
          </button>

          <div className="bg-white rounded-2xl shadow-2xl p-8 mb-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-4xl font-bold text-gray-800 mb-2">Lernorganisator</h1>
                <p className="text-gray-600">Verwalte Klassenräume (in der Cloud gespeichert)</p>
              </div>
              <BookOpen className="w-16 h-16 text-purple-600" />
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Neuer Klassenraum</h2>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={classroomName}
                  onChange={(e) => setClassroomName(e.target.value)}
                  placeholder="z.B. Klasse 5a, Mathe-Gruppe..."
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <button
                  onClick={createClassroom}
                  disabled={!classroomName.trim()}
                  className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="inline mr-2" size={20} />
                  Erstellen
                </button>
              </div>
            </div>

            {classrooms.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Deine Klassenräume</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {classrooms.map((classroom) => (
                    <div
                      key={classroom.id}
                      className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-purple-500 transition-all"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-gray-800">{classroom.name}</h3>
                          <p className="text-sm text-gray-600">Code: {classroom.code}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">{classroom.students?.length || 0} Schüler</p>
                          <p className="text-sm text-gray-600">{classroom.questions?.length || 0} Fragen</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {classrooms.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <BookOpen className="w-20 h-20 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Noch keine Klassenräume erstellt</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'game' && !gameFinished) {
    const progress = ((currentQuestion + 1) / questions.length) * 100;
    const maxPosition = questions.length;

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">
                Frage {currentQuestion + 1} / {questions.length}
              </h2>
              {players.length > 0 && playerId && (
                <div className="text-lg font-semibold text-purple-600">
                  Deine Punkte: {players.find(p => p.id === playerId)?.score || 0}
                </div>
              )}
              {players.length > 0 && !playerId && (
                <div className="text-lg font-semibold text-purple-600">
                  Deine Punkte: {players.find(p => !p.isComputer)?.score || 0}
                </div>
              )}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8 mb-6">
            <div className="space-y-6">
              {players.map((player) => (
                <div key={player.id} className="relative">
                  <div className="flex items-center mb-2">
                    <span className="text-sm font-semibold text-gray-700 w-32">{player.name}</span>
                    <div className="flex-1 h-16 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full relative overflow-hidden">
                      <div className="absolute inset-0 flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="flex-1 border-r-2 border-gray-400 border-dashed h-full" />
                        ))}
                      </div>
                      <div
                        className="absolute top-1/2 -translate-y-1/2 text-4xl transition-all duration-500 ease-out"
                        style={{ left: `${(player.position / maxPosition) * 95}%` }}
                      >
                        {player.robot}
                      </div>
                    </div>
                    <div className="text-4xl ml-4">🏁</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <h3 className="text-3xl font-bold text-gray-800 mb-8 text-center">
              {questions[currentQuestion]?.question}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {questions[currentQuestion]?.answers.map((answer, index) => {
                const isSelected = selectedAnswer === index;
                const isCorrect = index === questions[currentQuestion].correct;
                const showAsCorrect = showFeedback && isCorrect;
                const showAsWrong = showFeedback && isSelected && !isCorrect;

                return (
                  <button
                    key={index}
                    onClick={() => !showFeedback && handleAnswer(index)}
                    disabled={showFeedback}
                    className={`p-6 rounded-xl text-lg font-semibold transition-all transform hover:scale-105 ${
                      showAsCorrect
                        ? 'bg-green-500 text-white ring-4 ring-green-300'
                        : showAsWrong
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-100 hover:bg-purple-100 text-gray-800'
                    } ${showFeedback ? 'cursor-not-allowed' : ''}`}
                  >
                    {answer}
                    {showAsCorrect && <span className="ml-2">✓</span>}
                    {showAsWrong && <span className="ml-2">✗</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'results') {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <Trophy className="w-24 h-24 mx-auto mb-4 text-yellow-500" />
            <h1 className="text-5xl font-bold text-gray-800 mb-2">Spiel beendet!</h1>
            <p className="text-xl text-gray-600">Ergebnisse</p>
          </div>

          <div className="space-y-4 mb-8">
            {sortedPlayers.map((player, index) => (
              <div
                key={player.id}
                className={`flex items-center gap-4 p-6 rounded-xl ${
                  index === 0
                    ? 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                    : index === 1
                    ? 'bg-gradient-to-r from-gray-300 to-gray-400'
                    : index === 2
                    ? 'bg-gradient-to-r from-orange-400 to-orange-500'
                    : 'bg-gray-100'
                }`}
              >
                <div className="text-4xl font-bold w-12 text-center">
                  {index + 1}
                </div>
                <div className="text-5xl">{player.robot}</div>
                <div className="flex-1">
                  <p className="text-xl font-bold">{player.name}</p>
                  <p className="text-lg">Punkte: {player.score}</p>
                </div>
                {index === 0 && <Trophy className="w-12 h-12 text-yellow-700" />}
              </div>
            ))}
          </div>

          {answerHistory.length > 0 && (
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Deine Antworten</h2>
              <div className="space-y-4">
                {answerHistory.map((record, qIndex) => (
                  <div key={qIndex} className="bg-white rounded-xl p-6 shadow-lg">
                    <div className="flex items-start gap-4">
                      <div className={`text-3xl ${record.isCorrect ? 'text-green-500' : 'text-red-500'}`}>
                        {record.isCorrect ? '✓' : '✗'}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-800 mb-3">
                          Frage {qIndex + 1}: {record.question}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {record.answers.map((answer, aIndex) => {
                            const isCorrectAnswer = aIndex === record.correctIndex;
                            const wasSelected = aIndex === record.selectedIndex;
                            
                            return (
                              <div
                                key={aIndex}
                                className={`p-3 rounded-lg text-sm ${
                                  isCorrectAnswer
                                    ? 'bg-green-100 border-2 border-green-500 text-green-800 font-semibold'
                                    : wasSelected && !isCorrectAnswer
                                    ? 'bg-red-100 border-2 border-red-500 text-red-800'
                                    : 'bg-gray-50 text-gray-600'
                                }`}
                              >
                                {answer}
                                {isCorrectAnswer && <span className="ml-2">✓ Richtig</span>}
                                {wasSelected && !isCorrectAnswer && <span className="ml-2">✗ Deine Antwort</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-3xl font-bold text-gray-800">{answerHistory.length}</p>
                    <p className="text-sm text-gray-600">Gesamt</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-green-600">
                      {answerHistory.filter(a => a.isCorrect).length}
                    </p>
                    <p className="text-sm text-gray-600">Richtig</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-red-600">
                      {answerHistory.filter(a => !a.isCorrect).length}
                    </p>
                    <p className="text-sm text-gray-600">Falsch</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={resetGame}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-xl font-bold text-xl hover:from-purple-700 hover:to-pink-700 transition-all"
          >
            Neues Spiel starten
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default RobotRaceGame;