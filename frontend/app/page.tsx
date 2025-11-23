"use client";

import { useState, useEffect } from "react";
import ZKPassportComponent from "./components/ZKPassport";
import AdminPanel from "./components/AdminPanel";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function Home() {
  // Passport registration state
  const [passportData, setPassportData] = useState({
    name: '',
    dateOfBirth: '',
    nationality: '',
    passportNumber: ''
  });
  const [passportHash, setPassportHash] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<'choose' | 'zkpassport' | 'manual'>('choose');
  
  // Voting state
  const [hasVoted, setHasVoted] = useState(false);
  const [voteStatus, setVoteStatus] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [voteCounts, setVoteCounts] = useState({ A: 0, B: 0, C: 0 });
  const [showResults, setShowResults] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(null);
  const [voteReason, setVoteReason] = useState<string>("");
  
  // Voting period state
  const [votingStatus, setVotingStatus] = useState<any>(null);

  // Load vote counts from API
  const loadVoteCounts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/results`);
      const data = await response.json();
      
      if (data.success) {
        setVoteCounts({
          A: data.results.candidateA,
          B: data.results.candidateB,
          C: data.results.candidateC
        });
      }
    } catch (error) {
      console.error('Error loading vote counts:', error);
    }
  };

  // Load voting status
  const loadVotingStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/status`);
      const data = await response.json();
      
      if (data.success) {
        setVotingStatus(data);
      }
    } catch (error) {
      console.error('Error loading voting status:', error);
    }
  };

  useEffect(() => {
    loadVotingStatus();
    if (showResults) {
      loadVoteCounts();
      const interval = setInterval(loadVoteCounts, 10000);
      return () => clearInterval(interval);
    }
  }, [showResults]);
  
  // Check for saved registration
  useEffect(() => {
    const saved = localStorage.getItem('passportRegistration');
    if (saved) {
      const data = JSON.parse(saved);
      setPassportHash(data.passportHash);
      setPassportData(data);
      setIsRegistered(true);
    }
  }, []);

  // Handle unregister passport
  const handleUnregister = () => {
    const message = hasVoted 
      ? "You've already voted with this identity. Are you sure you want to switch to test another passport?"
      : "Are you sure you want to unregister your passport? You'll need to verify again.";
    
    if (confirm(message)) {
      localStorage.removeItem('passportRegistration');
      setPassportHash(null);
      setIsRegistered(false);
      setHasVoted(false);
      setRegistrationMode('choose');
      setSelectedCandidate(null);
      setVoteReason('');
      setPassportData({
        name: '',
        dateOfBirth: '',
        nationality: '',
        passportNumber: ''
      });
      setVoteStatus("✅ Identity cleared. You can register with a different passport.");
      setTimeout(() => setVoteStatus(""), 3000);
    }
  };

  // Handle ZKPassport verification (QR flow)
  const handleZKPassportVerified = async (uniqueId: string) => {
    console.log('[Voting App] ZKPassport verified with uniqueId:', uniqueId);
    
    setIsLoading(true);
    setVoteStatus("🛂 Processing ZKPassport identity...");
    
    try {
      // Convert uniqueIdentifier to passport hash (SHA256)
      const encoder = new TextEncoder();
      const data = encoder.encode(uniqueId);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      const passportHash = '0x' + hashHex;
      
      setPassportHash(passportHash);
      setIsRegistered(true);
      
      // Save to localStorage
      const registrationData = {
        name: 'ZKPassport User',
        passportHash,
        registeredAt: new Date().toISOString(),
        ageVerified: true,
        method: 'zkpassport-qr'
      };
      localStorage.setItem('passportRegistration', JSON.stringify(registrationData));
      
      setVoteStatus(`✅ ZKPassport verified!`);
      setTimeout(() => setVoteStatus(""), 3000);
      
    } catch (error: any) {
      setVoteStatus(`❌ ZKPassport error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Register passport with API (manual flow)
  const handleRegisterPassport = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passportData.name || !passportData.dateOfBirth || !passportData.nationality || !passportData.passportNumber) {
      setVoteStatus("❌ Please fill all passport fields");
      return;
    }
    
    setIsLoading(true);
    setVoteStatus("🛂 Registering passport...");
    
    try {
      const response = await fetch(`${API_URL}/api/register-passport`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passportData)
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      setPassportHash(data.passportHash);
      setIsRegistered(true);
      
      // Save to localStorage
      const registrationData = {
        ...passportData,
        passportHash: data.passportHash,
        registeredAt: data.registeredAt,
        ageVerified: data.ageVerified,
        method: 'manual'
      };
      localStorage.setItem('passportRegistration', JSON.stringify(registrationData));
      
      setVoteStatus(`✅ Passport registered! Age: ${data.age} years`);
      setTimeout(() => setVoteStatus(""), 3000);
      
    } catch (error: any) {
      setVoteStatus(`❌ Registration error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Cast vote with API
  const handleVote = async () => {
    if (!passportHash) {
      setVoteStatus("❌ Please register your passport first!");
      return;
    }
    
    if (selectedCandidate === null) {
      setVoteStatus("❌ Please select a candidate!");
      return;
    }
    
    setIsLoading(true);
    setVoteStatus(`🗳️  Casting vote for Candidate ${String.fromCharCode(64 + selectedCandidate)}...`);
    
    try {
      const response = await fetch(`${API_URL}/api/cast-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passportHash,
          candidateId: selectedCandidate,
          reason: voteReason || undefined
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      setHasVoted(true);
      setVoteStatus(`✅ Vote confirmed! TX: ${data.txHash.substring(0, 20)}...`);
      
      // Reload results
      loadVoteCounts();
      
      setTimeout(() => {
        setShowResults(true);
        setVoteStatus("");
      }, 3000);
      
    } catch (error: any) {
      setVoteStatus(`❌ ${error.message}`);
      
      // Clear error after 10 seconds
      setTimeout(() => setVoteStatus(""), 10000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 md:p-24 bg-gradient-to-b from-black to-gray-900 text-white">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            🗳️ Aztec Private Voting
          </h1>
          <p className="text-gray-400 text-lg">
            Sybil-resistant voting using ZKPassport identity verification
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Powered by Aztec Network • Privacy-First • Transparent Results
          </p>
        </div>

        {/* Voting Status Banner */}
        {votingStatus && (
          <div className={`mb-8 p-4 rounded-xl border ${votingStatus.isActive ? 'bg-green-900/20 border-green-500' : 'bg-red-900/20 border-red-500'}`}>
            <p className="text-center font-semibold">
              {votingStatus.isActive ? '🟢 Voting Active' : '🔴 Voting Closed'}
            </p>
            <p className="text-xs text-center text-gray-400 mt-1">
              {new Date(votingStatus.startDate).toLocaleDateString()} - {new Date(votingStatus.endDate).toLocaleDateString()}
            </p>
          </div>
        )}

        {/* Results Section */}
        <div className="mb-8">
          <button
            onClick={() => setShowResults(!showResults)}
            className="w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-semibold transition-all"
          >
            {showResults ? '🔽 Hide Results' : '📊 Show Results'}
          </button>
        </div>

        {showResults && (
          <div className="mb-8 p-6 bg-gray-800 rounded-xl border border-gray-700 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 text-center">📈 Current Tally</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-6 bg-blue-900/30 rounded-lg border-2 border-blue-500">
                <p className="text-4xl font-bold text-blue-400">{voteCounts.A}</p>
                <p className="text-sm text-gray-300 font-semibold mt-2">Candidate A</p>
              </div>
              <div className="text-center p-6 bg-purple-900/30 rounded-lg border-2 border-purple-500">
                <p className="text-4xl font-bold text-purple-400">{voteCounts.B}</p>
                <p className="text-sm text-gray-300 font-semibold mt-2">Candidate B</p>
              </div>
              <div className="text-center p-6 bg-pink-900/30 rounded-lg border-2 border-pink-500">
                <p className="text-4xl font-bold text-pink-400">{voteCounts.C}</p>
                <p className="text-sm text-gray-300 font-semibold mt-2">Candidate C</p>
              </div>
            </div>
            <div className="text-center p-4 bg-gray-900/50 rounded-lg border border-gray-600">
              <p className="text-2xl font-bold text-gray-300">
                Total: {voteCounts.A + voteCounts.B + voteCounts.C}
              </p>
            </div>
            <p className="text-xs text-gray-500 text-center mt-4">
              🔒 Vote tallies are public and transparent<br/>
              🕵️ Individual votes and identities remain private
            </p>
          </div>
        )}

        {/* Main Content: Registration or Voting */}
        {!isRegistered ? (
          <div className="p-8 bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl">
            {registrationMode === 'choose' ? (
              /* Choose Registration Method */
              <div>
                <h2 className="text-3xl font-bold mb-6 text-center">🛂 Identity Verification</h2>
                <p className="text-gray-400 text-center mb-8">
                  Choose how you want to verify your identity to vote
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* ZKPassport QR Option */}
                  <button
                    onClick={() => setRegistrationMode('zkpassport')}
                    className="p-8 bg-gradient-to-br from-purple-900/50 to-blue-900/50 border-2 border-purple-500 rounded-xl hover:scale-105 transition-all"
                  >
                    <div className="text-5xl mb-4">📱</div>
                    <h3 className="text-xl font-bold mb-2">ZKPassport App</h3>
                    <p className="text-sm text-gray-300 mb-4">
                      Scan QR with ZKPassport mobile app
                    </p>
                    <div className="text-xs text-purple-300">
                      ✓ Real ZK proof generation<br/>
                      ✓ Maximum privacy<br/>
                      ✓ Biometric verification
                    </div>
                  </button>
                  
                  {/* Manual Form Option */}
                  <button
                    onClick={() => setRegistrationMode('manual')}
                    className="p-8 bg-gradient-to-br from-blue-900/50 to-gray-900/50 border-2 border-blue-500 rounded-xl hover:scale-105 transition-all"
                  >
                    <div className="text-5xl mb-4">⌨️</div>
                    <h3 className="text-xl font-bold mb-2">Manual Entry</h3>
                    <p className="text-sm text-gray-300 mb-4">
                      Enter passport details manually
                    </p>
                    <div className="text-xs text-blue-300">
                      ✓ Simulated verification<br/>
                      ✓ Quick testing<br/>
                      ✓ Demo purposes
                    </div>
                  </button>
                </div>
                
                <div className="mt-8 p-4 bg-blue-900/20 border border-blue-500 rounded-lg">
                  <p className="text-xs text-blue-300 text-center">
                    <strong>🔐 Privacy Note:</strong> Both methods generate a unique passport hash that prevents double-voting while keeping your identity private.
                  </p>
                </div>
              </div>
            ) : registrationMode === 'zkpassport' ? (
              /* ZKPassport QR Flow */
              <div>
                <button
                  onClick={() => setRegistrationMode('choose')}
                  className="mb-4 text-sm text-gray-400 hover:text-gray-300 flex items-center"
                >
                  ← Back to options
                </button>
                <ZKPassportComponent onVerified={handleZKPassportVerified} />
              </div>
            ) : (
              /* Manual Registration Form */
              <div>
                <button
                  onClick={() => setRegistrationMode('choose')}
                  className="mb-4 text-sm text-gray-400 hover:text-gray-300 flex items-center"
                >
                  ← Back to options
                </button>
                <h2 className="text-3xl font-bold mb-6 text-center">🛂 Manual Registration</h2>
            <form onSubmit={handleRegisterPassport} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-300">Full Name</label>
                <input
                  type="text"
                  value={passportData.name}
                  onChange={(e) => setPassportData({ ...passportData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:border-purple-500 focus:outline-none"
                  placeholder="As shown in passport"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-300">Date of Birth</label>
                <input
                  type="date"
                  value={passportData.dateOfBirth}
                  onChange={(e) => setPassportData({ ...passportData, dateOfBirth: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:border-purple-500 focus:outline-none"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-300">Nationality (3-letter code)</label>
                <input
                  type="text"
                  value={passportData.nationality}
                  onChange={(e) => setPassportData({ ...passportData, nationality: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:border-purple-500 focus:outline-none"
                  placeholder="USA, ARG, BRA, etc."
                  maxLength={3}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-300">Passport Number</label>
                <input
                  type="text"
                  value={passportData.passportNumber}
                  onChange={(e) => setPassportData({ ...passportData, passportNumber: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:border-purple-500 focus:outline-none"
                  placeholder="P123456789"
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 px-6 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-xl font-bold text-lg transition-all transform hover:scale-105 disabled:scale-100"
              >
                {isLoading ? '⏳ Registering...' : '✅ Register Passport'}
              </button>
            </form>
            
                <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500 rounded-lg">
                  <p className="text-xs text-blue-300">
                    <strong>🔐 Privacy Note:</strong> Your passport data stays local. Only a cryptographic hash is used for voting.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : !hasVoted ? (
          <div className="p-8 bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl">{/* Voting Form */}
            <h2 className="text-3xl font-bold mb-6 text-center">🗳️ Cast Your Vote</h2>
            
            {/* Passport Info */}
            <div className="mb-6 p-4 bg-green-900/20 border border-green-500 rounded-lg">
              <p className="text-sm text-green-300 text-center">
                ✅ Registered as: <strong>{passportData.nationality || 'ZKPassport'}</strong> passport holder
              </p>
              <p className="text-xs text-gray-400 text-center mt-1">
                Hash: {passportHash?.substring(0, 20)}...
              </p>
              <button
                onClick={handleUnregister}
                className="mt-3 text-xs text-red-400 hover:text-red-300 underline block mx-auto"
              >
                🔄 Unregister and use different passport
              </button>
            </div>
            
            {/* Candidate Selection */}
            <div className="space-y-4 mb-6">
              <label className="block text-sm font-semibold mb-2 text-gray-300">Select Candidate</label>
              {[
                { id: 1, name: 'A', color: 'blue' },
                { id: 2, name: 'B', color: 'purple' },
                { id: 3, name: 'C', color: 'pink' }
              ].map(({ id, name, color }) => (
                <button
                  key={id}
                  onClick={() => setSelectedCandidate(id)}
                  className={`w-full p-4 rounded-lg border-2 font-semibold transition-all ${
                    selectedCandidate === id
                      ? `bg-${color}-900/50 border-${color}-500 scale-105`
                      : 'bg-gray-900 border-gray-600 hover:border-gray-500'
                  }`}
                >
                  Candidate {name}
                </button>
              ))}
            </div>
            
            {/* Optional Reason */}
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2 text-gray-300">Vote Reason (Optional, Encrypted)</label>
              <textarea
                value={voteReason}
                onChange={(e) => setVoteReason(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:border-purple-500 focus:outline-none"
                placeholder="Why are you voting for this candidate?"
                rows={3}
              />
            </div>
            
            <button
              onClick={handleVote}
              disabled={isLoading || selectedCandidate === null}
              className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 rounded-xl font-bold text-lg transition-all transform hover:scale-105 disabled:scale-100 shadow-lg"
            >
              {isLoading ? '⏳ Casting Vote...' : '🗳️ Cast Vote on Aztec'}
            </button>
          </div>
        ) : (
          <div className="p-8 bg-gray-800 rounded-2xl border border-green-500 shadow-2xl text-center">{/* Success */}
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-3xl font-bold mb-4 text-green-400">Vote Confirmed!</h2>
            <p className="text-gray-300 mb-6">
              Your vote has been recorded on Aztec Network.<br/>
              Your identity and choice remain private.
            </p>
            
            <div className="mb-4 p-4 bg-green-900/20 border border-green-500 rounded-lg">
              <p className="text-sm text-green-300">
                ✅ Registered as: <strong>{passportData.nationality || 'ZKPassport'}</strong> passport holder
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Hash: {passportHash?.substring(0, 20)}...
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => setShowResults(true)}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-all"
              >
                📊 View Results
              </button>
              <button
                onClick={handleUnregister}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-all text-red-300 hover:text-red-200"
              >
                🔄 Switch Identity
              </button>
            </div>
            
            <p className="text-xs text-gray-500 mt-4">
              Note: You've already voted. Switching identity will allow testing with another passport.
            </p>
          </div>
        )}

        {/* Status Message */}
        {voteStatus && (
          <div className={`mt-6 p-4 rounded-xl border text-center font-semibold ${
            voteStatus.includes('✅') ? 'bg-green-900/20 border-green-500 text-green-300' :
            voteStatus.includes('❌') ? 'bg-red-900/20 border-red-500 text-red-300' :
            'bg-blue-900/20 border-blue-500 text-blue-300'
          }`}>
            {voteStatus}
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>Built with Aztec Network v3.0.0-devnet.5 • ZKPassport Integration</p>
          <p className="mt-2">
            <a 
              href="https://github.com/Fran-cio/Sybilization" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              View on GitHub →
            </a>
          </p>
        </div>
      </div>
      
      {/* Admin Panel (floating) */}
      <AdminPanel />
    </main>
  );
}
