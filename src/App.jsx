import React, { useState, useEffect } from 'react';
import { Trophy, Play, Users, User, Plus, X, LogIn, Settings, Sparkles, BookOpen, ArrowLeft, BarChart3 } from 'lucide-react';
import { db } from './firebase';
import { collection, addDoc, doc, getDoc, getDocs, setDoc, updateDoc, onSnapshot, query, where, deleteDoc, orderBy, limit, serverTimestamp } from 'firebase/firestore';

const RobotRaceGame = () => {
  const [view, setView] = useState('home');
  const [userRole, setUserRole] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [roomId, setRoomId] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState(null);
  const [gameMode, setGameMode] = useState(null);
  
  const [classrooms, setClassrooms] = useState([]);
  const [currentClassroom, setCurrentClassroom] = useState(null);
  const [classroomName, setClassroomName] = useState('');
  const [organizerCode, setOrganizerCode] = useState('');
  const [organizerId, setOrganizerId] = useState(null);
  const [isOrganizerLoggedIn, setIsOrganizerLoggedIn] = useState(false);
  const [inputOrganizerCode, setInputOrganizerCode] = useState('');
  
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
  const [isEvaluating, setIsEvaluating] = useState(false); // NEU: Das Schloss
  // ... all deine anderen states
  // NEU: State, um zu verfolgen, ob der Spieler für die aktuelle Runde geantwortet hat
  const [playerHasAnswered, setPlayerHasAnswered] = useState(false);
  
  const [dashboardData, setDashboardData] = useState([]);

  const robots = ['🤖', '🦾', '🦿', '🛸', '👾', '🚀'];
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500'];

  const robotPrefixes = ['Blitz', 'Turbo', 'Mega', 'Ultra', 'Super', 'Hyper', 'Quantum', 'Cyber', 'Digital', 'Nano', 'Giga', 'Stellar', 'Cosmic', 'Neon', 'Thunder', 'Speed', 'Flash', 'Plasma', 'Elektro', 'Photon'];
  const robotSuffixes = ['Bot', 'Chip', 'Circuit', 'Core', 'Byte', 'Wire', 'Gear', 'Drive', 'Spark', 'Pulse', 'Matrix', 'Node', 'Link', 'Code', 'Robo', 'Tron', 'Droid', 'Mech', 'Tech', 'Unit'];

  const generateRandomName = () => {
    const prefix = robotPrefixes[Math.floor(Math.random() * robotPrefixes.length)];
    const suffix = robotSuffixes[Math.floor(Math.random() * robotSuffixes.length)];
    const number = Math.floor(Math.random() * 100);
    return `${prefix}${suffix}${number}`;
  };

  const generateMultipleRandomNames = (count) => {
    const names = new Set();
    while (names.size < count) {
      names.add(generateRandomName());
    }
    return Array.from(names);
  };

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const generateOrganizerCode = () => {
    return 'ORG-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  const createOrLoginOrganizer = async (code = null) => {
    try {
      if (code) {
        const organizersRef = collection(db, 'organizers');
        const q = query(organizersRef, where('code', '==', code.toUpperCase()));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          alert("Organisator-Code nicht gefunden!");
          return false;
        }
        
        const organizerDoc = snapshot.docs[0];
        setOrganizerId(organizerDoc.id);
        setOrganizerCode(code.toUpperCase());
        setIsOrganizerLoggedIn(true);
        return true;
      } else {
        const newCode = generateOrganizerCode();
        const organizerRef = await addDoc(collection(db, 'organizers'), {
          code: newCode,
          createdAt: new Date().toISOString()
        });
        
        setOrganizerId(organizerRef.id);
        setOrganizerCode(newCode);
        setIsOrganizerLoggedIn(true);
        
        alert(`Dein Organisator-Code: ${newCode}\n\nSpeichere diesen Code sicher! Du brauchst ihn, um später wieder auf deine Klassenräume zugreifen zu können.`);
        return true;
      }
    } catch (error) {
      console.error("Fehler beim Organisator-Login:", error);
      alert("Fehler beim Login: " + error.message);
      return false;
    }
  };

  const saveActivityToFirebase = async (activityData) => {
    try {
      await addDoc(collection(db, 'activities'), {
        ...activityData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Fehler beim Speichern der Aktivität:", error);
    }
  };

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
      return data.questions;
    } catch (error) {
      console.error("Fehler beim Generieren:", error);
      setIsGenerating(false);
      alert("Fehler beim Generieren der Fragen: " + error.message);
      return null;
    }
  };

  const startSinglePlayer = async () => {
    if (!selectedTopic) {
      alert("Bitte wähle ein Thema!");
      return;
    }
    
    const generatedQuestions = await generateQuestionsWithAI();
    if (generatedQuestions) {
      const randomName = generateRandomName();
      setPlayerName(randomName);
      
      setPlayers([
        {
          id: 1,
          name: randomName,
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

  const startClassroomSinglePlayer = async () => {
    if (!selectedTopic || !currentClassroom) {
      alert("Bitte wähle ein Thema!");
      return;
    }
    
    const generatedQuestions = await generateQuestionsWithAI();
    if (generatedQuestions) {
      setPlayers([
        {
          id: 1,
          name: playerName,
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
    if (!selectedTopic) {
      alert("Bitte fülle alle Felder aus!");
      return;
    }
    
    setIsGenerating(true); // Zeige einen Ladezustand an
    const code = generateRoomCode();
    const newPlayerId = Date.now().toString();
    const randomName = generateRandomName();
    
    try {
      // Schritt 1: Raum SOFORT erstellen, aber ohne Fragen
      const roomRef = await addDoc(collection(db, 'rooms'), {
        code: code,
        topic: selectedTopic,
        difficulty: difficulty,
        questionCount: questionCount,
        questions: [], // Fragen sind anfangs leer
        players: [{
          id: newPlayerId,
          name: randomName,
          position: 0,
          score: 0,
          robot: robots[0],
          color: colors[0]
        }],
        status: 'generating_questions', // NEUER Status
        currentQuestion: 0,
        currentQuestionAnswers: {},
        gameStarted: false,
        createdAt: new Date().toISOString(),
        hostId: newPlayerId,
        isClassroom: false
      });

      // Schritt 2: Spieler SOFORT in den Warteraum schicken
      setPlayerName(randomName);
      setRoomCode(code);
      setRoomId(roomRef.id);
      setPlayerId(newPlayerId);
      setUserRole('host');
      setGameMode('room');
      setView('player-wait');
      setIsGenerating(false); // Ladezustand beenden

      // Schritt 3 & 4: Fragen im Hintergrund generieren und den Raum aktualisieren
      const generatedQuestions = await generateQuestionsWithAI();
      if (generatedQuestions) {
        await updateDoc(doc(db, 'rooms', roomRef.id), {
          questions: generatedQuestions,
          status: 'waiting' // Jetzt ist der Raum bereit zum Starten
        });
      } else {
        // Fehlerbehandlung: Was passiert, wenn die KI versagt?
        await updateDoc(doc(db, 'rooms', roomRef.id), { status: 'error' });
        alert("Fehler: Die Fragen konnten nicht erstellt werden. Bitte versuche es erneut.");
        // Optional: Den Raum wieder löschen
        // await deleteDoc(doc(db, 'rooms', roomRef.id));
        resetGame();
      }

    } catch (error) {
      console.error("Fehler beim Erstellen des Raums:", error);
      alert("Fehler beim Erstellen des Raums!");
      setIsGenerating(false);
    }
  };

  const joinMultiplayerRoom = async () => {
    if (!roomCode.trim()) {
      alert("Bitte gib einen Raumcode ein!");
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
      const randomName = generateRandomName();
      const newPlayer = {
        id: newPlayerId,
        name: randomName,
        position: 0,
        score: 0,
        robot: robots[roomData.players.length % robots.length],
        color: colors[roomData.players.length % colors.length]
      };

      await updateDoc(doc(db, 'rooms', roomDoc.id), {
        players: [...roomData.players, newPlayer]
      });

      setPlayerName(randomName);
      setRoomId(roomDoc.id);
      setPlayerId(newPlayerId);
      setRoomCode(roomCode.toUpperCase());
      setQuestions(roomData.questions);
      setUserRole('player');
      setGameMode(roomData.isClassroom ? 'classroom-multi' : 'room');
      setView('player-wait');
    } catch (error) {
      console.error("Fehler beim Beitreten:", error);
      alert("Fehler beim Beitreten des Raums!");
    }
  };

  const startMultiplayerGame = async () => {
    if (userRole !== 'host') return;
    
    try {
      await updateDoc(doc(db, 'rooms', roomId), {
        gameStarted: true,
        status: 'playing',
        currentQuestion: 0,
        // NEU: Antworten zurücksetzen beim Spielstart
        currentQuestionAnswers: {}
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
    
    if (!organizerId) {
      alert("Fehler: Kein Organisator angemeldet!");
      return;
    }
    
    const studentNames = generateMultipleRandomNames(25);
    
    try {
      await addDoc(collection(db, 'classrooms'), {
        name: classroomName,
        code: generateRoomCode(),
        organizerId: organizerId,
        studentNames: studentNames,
        assignedStudents: {},
        questions: [],
        results: [],
        createdAt: new Date().toISOString()
      });
      
      alert(`Klassenraum erstellt mit ${studentNames.length} Schülernamen!`);
      setClassroomName('');
      loadClassrooms();
    } catch (error) {
      console.error("Fehler beim Erstellen:", error);
      alert("Fehler beim Erstellen des Klassenraums: " + error.message);
    }
  };

  const loadClassrooms = async () => {
    if (!organizerId) {
      console.log("Kein Organisator angemeldet");
      return;
    }
    
    try {
      const classroomsRef = collection(db, 'classrooms');
      const q = query(classroomsRef, where('organizerId', '==', organizerId));
      const snapshot = await getDocs(q);
      const classroomList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClassrooms(classroomList);
    } catch (error) {
      console.error("Fehler beim Laden der Klassenräume:", error);
      alert("Fehler beim Laden: " + error.message);
    }
  };

  const joinClassroomAsSinglePlayer = async () => {
    if (!roomCode.trim()) {
      alert("Bitte gib den Klassenraum-Code ein!");
      return;
    }

    try {
      const classroomsRef = collection(db, 'classrooms');
      const q = query(classroomsRef, where('code', '==', roomCode.toUpperCase()));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        alert("Klassenraum nicht gefunden!");
        return;
      }

      const classroomDoc = snapshot.docs[0];
      const classroomData = classroomDoc.data();
      
      const availableNames = classroomData.studentNames.filter(
        name => !Object.values(classroomData.assignedStudents || {}).includes(name)
      );
      
      if (availableNames.length === 0) {
        alert("Alle Namen sind bereits vergeben!");
        return;
      }
      
      const assignedName = availableNames[0];
      const studentId = Date.now().toString();
      
      await updateDoc(doc(db, 'classrooms', classroomDoc.id), {
        [`assignedStudents.${studentId}`]: assignedName
      });
      
      setPlayerName(assignedName);
      setPlayerId(studentId);
      setCurrentClassroom({
        id: classroomDoc.id,
        ...classroomData
      });
      setGameMode('classroom-single');
      setView('single-setup');
    } catch (error) {
      console.error("Fehler beim Beitreten:", error);
      alert("Fehler beim Beitreten des Klassenraums!");
    }
  };

  const loadDashboardData = async () => {
    try {
      const activitiesRef = collection(db, 'activities');
      const q = query(activitiesRef, orderBy('timestamp', 'desc'), limit(50));
      const snapshot = await getDocs(q);
      
      const activities = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setDashboardData(activities);
    } catch (error) {
      console.error("Fehler beim Laden der Dashboard-Daten:", error);
    }
  };

  useEffect(() => {
    if (view === 'organizer' && isOrganizerLoggedIn && organizerId) {
      loadClassrooms();
    }
  }, [view, isOrganizerLoggedIn, organizerId]);

  useEffect(() => {
    if (view === 'dashboard') {
      loadDashboardData();
    }
  }, [view]);

  // GEÄNDERT: Komplette Neugestaltung des Listeners für Multiplayer
// GEÄNDERT: Komplette Neugestaltung des Listeners für Multiplayer
useEffect(() => {
    if (!roomId) return;

    const unsubscribe = onSnapshot(doc(db, 'rooms', roomId), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        setPlayers(data.players || []);
        if (data.questions && data.questions.length > 0 && questions.length === 0) {
            setQuestions(data.questions);
        }

        if (data.gameStarted && !gameStarted) {
          setGameStarted(true);
          setCurrentQuestion(data.currentQuestion || 0);
          setView('game');
        }
        
        if (data.gameFinished && !gameFinished) {
          setGameFinished(true);
          setPlayers(data.players);
          setView('results');
        }
        
        if (data.currentQuestion !== currentQuestion) {
          setCurrentQuestion(data.currentQuestion);
          setSelectedAnswer(null);
          setShowFeedback(false);
          setPlayerHasAnswered(false);
          setIsEvaluating(false); // WICHTIG: Schloss für die neue Runde öffnen
        }
        
        // HOST-Logik: Nur ausführen, wenn das Schloss offen ist (!isEvaluating)
        if (userRole === 'host' && data.gameStarted && !data.gameFinished && !isEvaluating) {
          const totalPlayers = data.players.length;
          const currentAnswers = data.currentQuestionAnswers || {};
          const answeredPlayersCount = Object.keys(currentAnswers).length;

          if (totalPlayers > 0 && answeredPlayersCount === totalPlayers) {
            
            setIsEvaluating(true); // WICHTIG: Schloss für diese Runde schliessen!

            const answers = Object.entries(currentAnswers);
            const correctAnswers = answers.filter(([, answerData]) => answerData.isCorrect);
            correctAnswers.sort((a, b) => a[1].timestamp.toMillis() - b[1].timestamp.toMillis());
            
            let updatedPlayers = [...data.players];
            if (correctAnswers.length > 0) {
                const winnerId = correctAnswers[0][0];
                updatedPlayers = updatedPlayers.map(p => {
                    if (p.id === winnerId) {
                        return { ...p, score: p.score + 100, position: p.position + 1 };
                    }
                    return p;
                });
            }

            const nextQuestionIndex = data.currentQuestion + 1;
            
            setTimeout(() => {
              if (nextQuestionIndex < data.questions.length) {
                updateDoc(doc(db, 'rooms', roomId), {
                  players: updatedPlayers,
                  currentQuestion: nextQuestionIndex,
                  currentQuestionAnswers: {}
                });
                // Das Schloss wird durch den Wechsel der currentQuestion oben wieder geöffnet.
              } else {
                updateDoc(doc(db, 'rooms', roomId), {
                  players: updatedPlayers,
                  status: 'finished',
                  gameFinished: true
                });
              }
            }, 1500);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [roomId, gameStarted, gameFinished, userRole, currentQuestion, isEvaluating, questions.length]); // isEvaluating und questions.length hinzugefügt

  // GEÄNDERT: HandleAnswer Logik
  const handleAnswer = async (answerIndex) => {
    // Verhindert doppeltes Antworten
    if (showFeedback || selectedAnswer !== null || playerHasAnswered) {
      return;
    }
    
    setSelectedAnswer(answerIndex);
    setShowFeedback(true);

    const isCorrect = answerIndex === questions[currentQuestion].correct;
    
    const answerRecord = {
      question: questions[currentQuestion].question,
      answers: questions[currentQuestion].answers,
      correctIndex: questions[currentQuestion].correct,
      selectedIndex: answerIndex,
      isCorrect: isCorrect
    };
    setAnswerHistory([...answerHistory, answerRecord]);
    
    // Multiplayer-Logik
    if (roomId && playerId) {
      setPlayerHasAnswered(true); // Spieler hat geantwortet, UI blockieren
      try {
        const roomRef = doc(db, 'rooms', roomId);
        // Die Antwort des Spielers in der Datenbank speichern
        await updateDoc(roomRef, {
          [`currentQuestionAnswers.${playerId}`]: {
            answerIndex: answerIndex,
            isCorrect: isCorrect,
            timestamp: serverTimestamp() // Wichtig für die Geschwindigkeitsmessung
          }
        });
      } catch (error) {
        console.error("Fehler beim Senden der Antwort:", error);
      }
    } else { // Singleplayer-Logik (bleibt größtenteils gleich)
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
        
        // Nächste Frage im Singleplayer
        setTimeout(async () => {
          setShowFeedback(false);
          setSelectedAnswer(null);
          
          if (currentQuestion < questions.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
          } else {
            setGameFinished(true);
            const finalPlayer = players.find(p => !p.isComputer);
            await saveActivityToFirebase({
                type: gameMode || 'free',
                playerName: playerName,
                score: finalPlayer?.score || 0,
                topic: selectedTopic,
                difficulty: difficulty,
                questionCount: questions.length,
                classroomCode: currentClassroom?.code || null
            });
            setView('results');
          }
        }, 1500);
    }
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
    setAnswerHistory([]);
    setGameMode(null);
    setCurrentClassroom(null);
    // NEU: State zurücksetzen
    setPlayerHasAnswered(false);
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

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <button
              onClick={() => setView('single-choice')}
              className="bg-white rounded-2xl p-8 shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300"
            >
              <User className="w-16 h-16 mx-auto mb-4 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Einzelspieler</h2>
              <p className="text-gray-600">Alleine spielen</p>
            </button>

            <button
              onClick={() => setView('multi-choice')}
              className="bg-white rounded-2xl p-8 shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300"
            >
              <Users className="w-16 h-16 mx-auto mb-4 text-green-600" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Mehrspieler</h2>
              <p className="text-gray-600">Online spielen</p>
            </button>

            <button
              onClick={() => setView('dashboard')}
              className="bg-white rounded-2xl p-8 shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300"
            >
              <BarChart3 className="w-16 h-16 mx-auto mb-4 text-orange-600" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Dashboard</h2>
              <p className="text-gray-600">Alle Aktivitäten</p>
            </button>

            <button
              onClick={() => setView('organizer-login')}
              className="bg-white rounded-2xl p-8 shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300"
            >
              <Settings className="w-16 h-16 mx-auto mb-4 text-purple-600" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Lernorganisator</h2>
              <p className="text-gray-600">Verwalten</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'organizer-login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
          <button onClick={() => setView('home')} className="mb-6 text-gray-600 hover:text-gray-800 flex items-center">
            <ArrowLeft className="mr-2" size={20} />
            Zurück
          </button>
          
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">👨‍🏫</div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Lernorganisator</h2>
            <p className="text-gray-600">Login oder neues Konto erstellen</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-3">Organisator-Code (optional):</label>
              <input
                type="text"
                value={inputOrganizerCode}
                onChange={(e) => setInputOrganizerCode(e.target.value.toUpperCase())}
                placeholder="ORG-XXXXXXXX"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-center text-lg font-mono focus:border-purple-500 focus:outline-none"
              />
              <p className="text-sm text-gray-500 mt-2">Wenn du bereits einen Code hast, gib ihn hier ein</p>
            </div>

            <button
              onClick={async () => {
                const success = await createOrLoginOrganizer(inputOrganizerCode || null);
                if (success) {
                  setView('organizer');
                  setInputOrganizerCode('');
                }
              }}
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-4 rounded-xl font-bold text-xl hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg"
            >
              <LogIn className="inline mr-2" size={24} />
              {inputOrganizerCode ? 'Mit Code anmelden' : 'Neues Konto erstellen'}
            </button>

            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>💡 Hinweis:</strong> Beim ersten Mal erhältst du einen persönlichen Code. Bewahre diesen sicher auf, um später wieder auf deine Klassenräume zugreifen zu können!
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'dashboard') {
    // Statistiken berechnen
    const totalGames = dashboardData.length;
    const totalScore = dashboardData.reduce((sum, activity) => sum + (activity.score || 0), 0);
    const avgScore = totalGames > 0 ? Math.round(totalScore / totalGames) : 0;
    
    // Aktivitäten nach Typ
    const gamesByType = dashboardData.reduce((acc, activity) => {
      const type = activity.type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    
    // Beliebte Themen
    const topicCounts = dashboardData.reduce((acc, activity) => {
      const topic = activity.topic || 'Unbekannt';
      acc[topic] = (acc[topic] || 0) + 1;
      return acc;
    }, {});
    const topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    // Schwierigkeitsverteilung
    const difficultyStats = dashboardData.reduce((acc, activity) => {
      const diff = activity.difficulty || 'unbekannt';
      acc[diff] = (acc[diff] || 0) + 1;
      return acc;
    }, {});
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-100 to-pink-100 p-6">
        <div className="max-w-6xl mx-auto">
          <button onClick={() => setView('home')} className="mb-6 text-gray-600 hover:text-gray-800 flex items-center">
            <ArrowLeft className="mr-2" size={20} />
            Zurück
          </button>

          <div className="bg-white rounded-2xl shadow-2xl p-8 mb-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-4xl font-bold text-gray-800 mb-2">Aktivitäts-Dashboard</h1>
                <p className="text-gray-600">Alle Spielaktivitäten im Überblick</p>
              </div>
              <BarChart3 className="w-16 h-16 text-orange-600" />
            </div>

            {totalGames === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <BarChart3 className="w-20 h-20 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Noch keine Aktivitäten aufgezeichnet</p>
              </div>
            ) : (
              <>
                {/* Statistik-Übersicht */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200">
                    <div className="text-4xl font-bold text-blue-600 mb-2">{totalGames}</div>
                    <div className="text-sm text-gray-600">Gesamt Spiele</div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border-2 border-green-200">
                    <div className="text-4xl font-bold text-green-600 mb-2">{avgScore}</div>
                    <div className="text-sm text-gray-600">Ø Punktzahl</div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border-2 border-purple-200">
                    <div className="text-4xl font-bold text-purple-600 mb-2">
                      {gamesByType['classroom-single'] || 0}
                    </div>
                    <div className="text-sm text-gray-600">Klassenraum-Spiele</div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border-2 border-orange-200">
                    <div className="text-4xl font-bold text-orange-600 mb-2">
                      {(gamesByType['room'] || 0) + (gamesByType['classroom-multi'] || 0)}
                    </div>
                    <div className="text-sm text-gray-600">Mehrspieler-Spiele</div>
                  </div>
                </div>

                {/* Aktivitätsorte (Spielmodi) */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 mb-8">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">📍 Aktivität nach Spielort</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg p-4 text-center">
                      <div className="text-3xl mb-2">🎮</div>
                      <div className="text-2xl font-bold text-blue-600">{gamesByType['free'] || 0}</div>
                      <div className="text-sm text-gray-600">Freies Spiel</div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4 text-center">
                      <div className="text-3xl mb-2">📚</div>
                      <div className="text-2xl font-bold text-purple-600">{gamesByType['classroom-single'] || 0}</div>
                      <div className="text-sm text-gray-600">Klassenraum Einzel</div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4 text-center">
                      <div className="text-3xl mb-2">👥</div>
                      <div className="text-2xl font-bold text-green-600">{gamesByType['room'] || 0}</div>
                      <div className="text-sm text-gray-600">Online-Rooms</div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4 text-center">
                      <div className="text-3xl mb-2">🏫</div>
                      <div className="text-2xl font-bold text-orange-600">{gamesByType['classroom-multi'] || 0}</div>
                      <div className="text-sm text-gray-600">Klassenraum Multi</div>
                    </div>
                  </div>
                </div>

                {/* Top Themen */}
                {topTopics.length > 0 && (
                  <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-6 mb-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">🔥 Beliebteste Themen</h2>
                    <div className="space-y-3">
                      {topTopics.map(([topic, count], index) => (
                        <div key={topic} className="bg-white rounded-lg p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl font-bold text-orange-600 w-8">#{index + 1}</div>
                            <div className="text-lg font-semibold text-gray-800">{topic}</div>
                          </div>
                          <div className="text-xl font-bold text-gray-600">{count} Spiele</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Schwierigkeitsverteilung */}
                <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-6 mb-8">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">⚡ Schwierigkeitsgrad</h2>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg p-4 text-center">
                      <div className="text-3xl mb-2">😊</div>
                      <div className="text-2xl font-bold text-green-600">{difficultyStats['leicht'] || 0}</div>
                      <div className="text-sm text-gray-600">Leicht</div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4 text-center">
                      <div className="text-3xl mb-2">😐</div>
                      <div className="text-2xl font-bold text-yellow-600">{difficultyStats['mittel'] || 0}</div>
                      <div className="text-sm text-gray-600">Mittel</div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4 text-center">
                      <div className="text-3xl mb-2">😤</div>
                      <div className="text-2xl font-bold text-red-600">{difficultyStats['schwer'] || 0}</div>
                      <div className="text-sm text-gray-600">Schwer</div>
                    </div>
                  </div>
                </div>

                {/* Aktivitätenliste */}
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">📋 Letzte Aktivitäten</h2>
                  <div className="space-y-4">
                    {dashboardData.slice(0, 10).map((activity) => {
                      const date = new Date(activity.timestamp);
                      const typeLabel = {
                        'free': '🎮 Freies Spiel',
                        'classroom-single': '📚 Klassenraum',
                        'room': '👥 Mehrspieler',
                        'classroom-multi': '🏫 Klassenraum (Multi)'
                      }[activity.type] || '🎮 Spiel';
                      
                      return (
                        <div key={activity.id} className="bg-gradient-to-r from-orange-50 to-pink-50 rounded-xl p-6 border-2 border-orange-200">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-2xl">{typeLabel}</span>
                                <span className="font-bold text-lg text-gray-800">{activity.playerName}</span>
                              </div>
                              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                                <span>📝 {activity.topic}</span>
                                <span>⚡ {activity.difficulty}</span>
                                <span>❓ {activity.questionCount} Fragen</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-3xl font-bold text-orange-600">{activity.score}</div>
                              <div className="text-sm text-gray-500">Punkte</div>
                              <div className="text-xs text-gray-400 mt-1">
                                {date.toLocaleDateString('de-DE')} {date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'single-choice') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <button onClick={() => setView('home')} className="mb-6 text-white hover:text-gray-200 flex items-center">
            <ArrowLeft className="mr-2" size={20} />
            Zurück
          </button>
          
          <div className="text-center mb-12">
            <div className="text-8xl mb-4">🤖</div>
            <h1 className="text-5xl font-bold text-white mb-4">Einzelspieler</h1>
            <p className="text-xl text-white/90">Wähle deinen Spielmodus</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={() => {
                setGameMode('free');
                setView('single-setup');
              }}
              className="bg-white rounded-2xl p-8 shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300"
            >
              <Play className="w-16 h-16 mx-auto mb-4 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Freies Spiel</h2>
              <p className="text-gray-600">Einfach losspielen ohne Anmeldung</p>
            </button>

            <button
              onClick={() => setView('single-classroom-join')}
              className="bg-white rounded-2xl p-8 shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300"
            >
              <BookOpen className="w-16 h-16 mx-auto mb-4 text-purple-600" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Im Klassenraum</h2>
              <p className="text-gray-600">Ergebnisse werden gespeichert</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'single-classroom-join') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
          <button onClick={() => setView('single-choice')} className="mb-6 text-gray-600 hover:text-gray-800 flex items-center">
            <ArrowLeft className="mr-2" size={20} />
            Zurück
          </button>
          
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">📚</div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Klassenraum beitreten</h2>
            <p className="text-gray-600">Gib den Code deiner Lehrperson ein</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-3">Klassenraum-Code:</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="6-stelliger Code"
                maxLength={6}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-center text-2xl font-mono focus:border-purple-500 focus:outline-none"
              />
            </div>

            <button
              onClick={joinClassroomAsSinglePlayer}
              disabled={!roomCode}
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-4 rounded-xl font-bold text-xl hover:from-purple-600 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              <LogIn className="inline mr-2" size={24} />
              Weiter zum Spiel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'multi-choice') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center p-4">
        <div className="max-w-3xl w-full">
          <button onClick={() => setView('home')} className="mb-6 text-white hover:text-gray-200 flex items-center">
            <ArrowLeft className="mr-2" size={20} />
            Zurück
          </button>
          
          <div className="text-center mb-12">
            <div className="text-8xl mb-4">👥</div>
            <h1 className="text-5xl font-bold text-white mb-4">Mehrspieler</h1>
            <p className="text-xl text-white/90">Online mit anderen spielen</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <button
              onClick={() => setView('multi-create')}
              className="bg-white rounded-2xl p-8 shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300"
            >
              <Plus className="w-16 h-16 mx-auto mb-4 text-green-600" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Room erstellen</h2>
              <p className="text-gray-600">Schnelles Spiel starten</p>
            </button>

            <button
              onClick={() => setView('multi-join')}
              className="bg-white rounded-2xl p-8 shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300"
            >
              <LogIn className="w-16 h-16 mx-auto mb-4 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Room beitreten</h2>
              <p className="text-gray-600">Mit Code beitreten</p>
            </button>

            <button
              onClick={() => setView('multi-classroom-join')}
              className="bg-white rounded-2xl p-8 shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300"
            >
              <BookOpen className="w-16 h-16 mx-auto mb-4 text-purple-600" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Classroom beitreten</h2>
              <p className="text-gray-600">Organisiertes Lernen</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'multi-classroom-join') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
          <button onClick={() => setView('multi-choice')} className="mb-6 text-gray-600 hover:text-gray-800 flex items-center">
            <ArrowLeft className="mr-2" size={20} />
            Zurück
          </button>
          
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🏫</div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Classroom beitreten</h2>
            <p className="text-gray-600">Mehrspieler im Klassenraum</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-3">Classroom-Code:</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="6-stelliger Code"
                maxLength={6}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-center text-2xl font-mono focus:border-purple-500 focus:outline-none"
              />
            </div>

            <button
              onClick={() => {
                if (!roomCode) {
                  alert("Bitte gib den Classroom-Code ein!");
                  return;
                }
                joinMultiplayerRoom();
              }}
              disabled={!roomCode}
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-4 rounded-xl font-bold text-xl hover:from-purple-600 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              <LogIn className="inline mr-2" size={24} />
              Beitreten
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
          <button onClick={() => setView('single-choice')} className="mb-6 text-gray-600 hover:text-gray-800 flex items-center">
            <ArrowLeft className="mr-2" size={20} />
            Zurück
          </button>
          
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🤖</div>
            <h2 className="text-4xl font-bold text-gray-800 mb-2">Einzelspieler</h2>
            <p className="text-gray-600">Wähle ein Thema und die KI erstellt Fragen für dich!</p>
            {gameMode === 'classroom-single' && playerName && (
              <div className="mt-4 bg-purple-100 rounded-lg p-3">
                <p className="text-purple-800 font-semibold">Dein Name: {playerName}</p>
              </div>
            )}
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
              onClick={gameMode === 'classroom-single' ? startClassroomSinglePlayer : startSinglePlayer}
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
          <button onClick={() => setView('multi-choice')} className="mb-6 text-gray-600 hover:text-gray-800 flex items-center">
            <ArrowLeft className="mr-2" size={20} />
            Zurück
          </button>
          
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">👥</div>
            <h2 className="text-4xl font-bold text-gray-800 mb-2">Room erstellen</h2>
            <p className="text-gray-600">Erstelle ein schnelles Online-Spiel!</p>
          </div>

          <div className="space-y-6">
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

            <button
              onClick={createMultiplayerRoom}
              disabled={!selectedTopic || isGenerating}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-bold text-xl hover:from-green-600 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              {isGenerating ? "Wird erstellt..." : "Room erstellen"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'multi-join') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
          <button onClick={() => setView('multi-choice')} className="mb-6 text-gray-600 hover:text-gray-800 flex items-center">
            <ArrowLeft className="mr-2" size={20} />
            Zurück
          </button>
          
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🔗</div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Room beitreten</h2>
            <p className="text-gray-600">Gib den Raumcode ein</p>
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

            <button
              onClick={joinMultiplayerRoom}
              disabled={!roomCode}
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
              <p className="text-sm opacity-90 mb-2">Code zum Teilen:</p>
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

          {/* FÜR DEN HOST */}
          {userRole === 'host' && (() => {
            const enoughPlayers = players.length >= 2;
            const questionsLoaded = questions.length > 0;
            const roomIsReady = enoughPlayers && questionsLoaded;
            
            let buttonText = 'Spiel starten';
            if (!enoughPlayers) {
                buttonText = `Warte auf ${2 - players.length} weitere/n Spieler...`;
            } else if (!questionsLoaded) {
                buttonText = '🤖 Fragen werden erstellt...';
            }

            return (
              <>
                {!questionsLoaded && (
                  <p className="text-center text-purple-700 font-semibold animate-pulse mb-4">
                    KI generiert die Fragen... Spieler können bereits beitreten!
                  </p>
                )}
                <button
                  onClick={startMultiplayerGame}
                  disabled={!roomIsReady}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-bold text-xl hover:from-green-600 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg"
                >
                  <Play className="inline mr-2" size={24} />
                  {buttonText} 
                </button>
              </>
            );
          })()}
          
          {/* FÜR DIE ANDEREN SPIELER */}
          {userRole !== 'host' && (
            <div className="text-center text-gray-600">
              {questions.length === 0 ? (
                <p className="text-purple-700 font-semibold animate-pulse">
                  Der Host bereitet das Spiel vor, gleich geht's los!
                </p>
              ) : (
                <p>Warte bis der Host das Spiel startet...</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  } // <--- DIESE KLAMMER HAT WAHRSCHEINLICH GEFEHLT

  if (view === 'organizer') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <button onClick={() => setView('home')} className="text-gray-600 hover:text-gray-800 flex items-center">
              <ArrowLeft className="mr-2" size={20} />
              Zurück
            </button>
            <button 
              onClick={() => {
                setIsOrganizerLoggedIn(false);
                setOrganizerId(null);
                setOrganizerCode('');
                setClassrooms([]);
                setView('home');
              }}
              className="text-red-600 hover:text-red-800 flex items-center"
            >
              <X className="mr-2" size={20} />
              Abmelden
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8 mb-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-4xl font-bold text-gray-800 mb-2">Lernorganisator</h1>
                <p className="text-gray-600">Verwalte Klassenräume</p>
              </div>
              <BookOpen className="w-16 h-16 text-purple-600" />
            </div>

            <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Dein Organisator-Code:</p>
                  <p className="text-2xl font-bold font-mono text-purple-800">{organizerCode}</p>
                  <p className="text-xs text-gray-500 mt-1">Bewahre diesen Code sicher auf!</p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(organizerCode);
                    alert("Code kopiert!");
                  }}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  📋 Kopieren
                </button>
              </div>
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
              <p className="text-sm text-gray-600 mt-2">💡 Es werden automatisch 25 Schülernamen generiert</p>
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
                          <p className="text-sm text-gray-600">Code: <span className="font-mono font-bold">{classroom.code}</span></p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">👥 {classroom.studentNames?.length || 0} Namen</p>
                          <p className="text-sm text-gray-600">✅ {Object.keys(classroom.assignedStudents || {}).length} aktiv</p>
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
            
            {/* NEU: Warte-Anzeige für Multiplayer */}
            {roomId && playerHasAnswered && !showFeedback && (
              <div className="text-center p-8">
                <div className="text-2xl font-bold text-purple-700">Antwort gespeichert!</div>
                <p className="text-gray-600 mt-2">Warte auf die anderen Spieler...</p>
              </div>
            )}
            
            {/* Antwort-Buttons nur anzeigen, wenn noch nicht geantwortet wurde */}
            {(!roomId || !playerHasAnswered || showFeedback) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {questions[currentQuestion]?.answers.map((answer, index) => {
                  const isSelected = selectedAnswer === index;
                  const isCorrect = index === questions[currentQuestion].correct;
                  const showAsCorrect = showFeedback && isCorrect;
                  const showAsWrong = showFeedback && isSelected && !isCorrect;

                  return (
                    <button
                      key={index}
                      onClick={() => handleAnswer(index)}
                      // GEÄNDERT: Button wird auch blockiert, wenn Spieler bereits geantwortet hat
                      disabled={showFeedback || (roomId && playerHasAnswered)}
                      className={`p-6 rounded-xl text-lg font-semibold transition-all transform hover:scale-105 ${
                        showAsCorrect
                          ? 'bg-green-500 text-white ring-4 ring-green-300'
                          : showAsWrong
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-100 hover:bg-purple-100 text-gray-800'
                      } ${(showFeedback || (roomId && playerHasAnswered)) ? 'cursor-not-allowed opacity-70' : ''}`}
                    >
                      {answer}
                      {showAsCorrect && <span className="ml-2">✓</span>}
                      {showAsWrong && <span className="ml-2">✗</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'results') {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    // NEU: Finde den aktuellen Spieler und seinen Platz in der Rangliste
    const currentPlayerRank = sortedPlayers.findIndex(p => p.id === playerId) + 1;
    const isComputerGame = players.some(p => p.isComputer);

    // NEU: Wenn es ein Einzelspieler-Spiel ist, finde den menschlichen Spieler
    const singlePlayerRank = isComputerGame ? sortedPlayers.findIndex(p => !p.isComputer) + 1 : 0;
    
    // NEU: Bestimme den finalen Rang, egal ob Single- oder Multiplayer
    const finalRank = isComputerGame ? singlePlayerRank : currentPlayerRank;

    // NEU: Eine nette Nachricht je nach Platzierung
    const getRankMessage = (rank) => {
      if (!rank || rank <= 0) return "Hier ist das Endergebnis!";
      if (rank === 1) return "🎉 Herzlichen Glückwunsch, du hast gewonnen! 🎉";
      if (rank === 2) return "Super gemacht, du hast den 2. Platz belegt!🥈";
      if (rank === 3) return "Starke Leistung, du bist auf dem Treppchen! 🥉";
      return `Gut gespielt! Du hast den ${rank}. Platz erreicht!`;
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <Trophy className="w-24 h-24 mx-auto mb-4 text-yellow-500" />
            <h1 className="text-5xl font-bold text-gray-800 mb-2">Spiel beendet!</h1>
            {/* NEU: Persönliche Rang-Nachricht */}
            <h2 className="text-2xl text-gray-700 mt-4">{getRankMessage(finalRank)}</h2>
          </div>

          <div className="space-y-4 mb-8">
            {sortedPlayers.map((player, index) => {
              // NEU: Prüfen, ob dieser Eintrag der aktuelle Spieler ist
              const isCurrentUser = isComputerGame ? !player.isComputer : player.id === playerId;

              return (
              <div
                key={player.id || index}
                // GEÄNDERT: Fügt eine Hervorhebung für den aktuellen Spieler hinzu
                className={`flex items-center gap-4 p-6 rounded-xl transition-all ${
                  isCurrentUser ? 'ring-4 ring-purple-500 shadow-lg' : ''
                } ${
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
            )})}
          </div>

          {/* Die Sektion für die Antwort-Historie bleibt unverändert */}
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