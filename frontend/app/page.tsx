"use client";

import { useState, useEffect } from "react";
import ZKPassportComponent from "./components/ZKPassport";

export default function Home() {
  const [hasVoted, setHasVoted] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [nullifier, setNullifier] = useState<string | null>(null);
  const [voteStatus, setVoteStatus] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [voteCounts, setVoteCounts] = useState({ A: 0, B: 0 });
  const [showResults, setShowResults] = useState(false);

  const loadVoteCounts = async () => {
    try {
      const response = await fetch('/contract-address.json');
      const { address } = await response.json();
      
      const { getVoteCount } = await import('../lib/aztec');
      
      const countA = await getVoteCount(address, "Candidate A");
      const countB = await getVoteCount(address, "Candidate B");
      
      setVoteCounts({ A: countA, B: countB });
    } catch (error) {
      console.error('Error loading vote counts:', error);
    }
  };

  useEffect(() => {
    if (showResults) {
      loadVoteCounts();
      const interval = setInterval(loadVoteCounts, 5000);
      return () => clearInterval(interval);
    }
  }, [showResults]);

  const handleVote = async (candidate: string) => {
    if (!nullifier) {
      setVoteStatus("❌ Please verify your identity first!");
      return;
    }
    
    setIsLoading(true);
    setVoteStatus(`Casting vote for ${candidate}...`);
    
    try {
      // Load contract address
      setVoteStatus('Loading contract...');
      const response = await fetch('/contract-address.json');
      
      if (!response.ok) {
        throw new Error('Contract not deployed. Please deploy the contract first.');
      }
      
      const { address } = await response.json();
      
      if (!address) {
        throw new Error('Contract address not found');
      }
      
      // Import the castVote function dynamically to avoid SSR issues
      const { castVote } = await import('../lib/aztec');
      
      setVoteStatus('⚡ Generating proof...');
      setVoteStatus('📡 Sending transaction to Aztec Network...');
      
      // Call Aztec Contract
      await castVote(address, candidate, nullifier);
      
      setHasVoted(true);
      setVoteStatus("✅ Vote Confirmed on Aztec!");
      
      // Update local count (in production, this would refetch from contract)
      const candidateKey = candidate === "Candidate A" ? "A" : "B";
      setVoteCounts(prev => ({ ...prev, [candidateKey]: prev[candidateKey] + 1 }));
      
      // Clear status after success
      setTimeout(() => setVoteStatus(""), 5000);
    } catch (error) {
      console.error('Error casting vote:', error);
      let errorMessage = 'Failed to cast vote';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Handle specific error cases
        if (errorMessage.includes('already exists')) {
          errorMessage = 'You have already voted! (Duplicate nullifier detected)';
        } else if (errorMessage.includes('simulation')) {
          errorMessage = 'Transaction simulation failed. Please try again.';
        } else if (errorMessage.includes('timeout')) {
          errorMessage = 'Transaction timed out. Please check your connection.';
        } else if (errorMessage.includes('Fee')) {
          errorMessage = 'Insufficient fees. Transaction cannot be processed.';
        }
      }
      
      setVoteStatus(`❌ Error: ${errorMessage}`);
      
      // Clear error after 10 seconds
      setTimeout(() => setVoteStatus(""), 10000);
    } finally {
      setIsLoading(false);
    }
  };

  const onVerified = async (uniqueId: string) => {
    console.log('[Voting App] Identity verified with uniqueId:', uniqueId);
    // Convert uniqueIdentifier to deterministic nullifier via SHA256 (Web Crypto API)
    const encoder = new TextEncoder();
    const data = encoder.encode(uniqueId);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const nullifier = hashHex.substring(0, 62); // 248 bits for Field element
    console.log('[Voting App] Derived nullifier:', nullifier);
    setNullifier(nullifier);
    setIsVerifying(false);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 md:p-24 bg-gradient-to-b from-black to-gray-900 text-white">
      <div className="w-full max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-center bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
          Aztec Private Voting
        </h1>
        <p className="text-center text-gray-400 mb-8">
          Sybil-resistant voting using ZK-Passport identity verification
        </p>

        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={() => setShowResults(!showResults)}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
          >
            {showResults ? 'Hide' : 'Show'} Results
          </button>
        </div>

        {showResults && (
          <div className="mb-8 p-6 bg-gray-800 rounded-xl border border-gray-700">
            <h2 className="text-2xl font-bold mb-4 text-center">Current Results</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-900/30 rounded-lg border border-blue-500">
                <p className="text-3xl font-bold text-blue-400">{voteCounts.A}</p>
                <p className="text-sm text-gray-400">Candidate A</p>
              </div>
              <div className="text-center p-4 bg-red-900/30 rounded-lg border border-red-500">
                <p className="text-3xl font-bold text-red-400">{voteCounts.B}</p>
                <p className="text-sm text-gray-400">Candidate B</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 text-center mt-4">
              Note: Counts are publicly visible on Aztec, but individual votes remain private
            </p>
          </div>
        )}

      {!nullifier ? (
        <div className="w-full max-w-md">
          {!isVerifying ? (
            <button
              onClick={() => setIsVerifying(true)}
              className="w-full py-4 px-6 bg-purple-600 hover:bg-purple-700 rounded-xl font-bold text-xl transition-all transform hover:scale-105"
            >
              Connect ZKPassport
            </button>
          ) : (
            <ZKPassportComponent onVerified={onVerified} />
          )}
        </div>
      ) : (
        <div className="w-full max-w-2xl text-center">
          <div className="mb-8 p-4 bg-green-900/30 border border-green-500 rounded-lg">
            <p className="text-green-400 font-mono">Identity Verified</p>
            <p className="text-xs text-gray-500 break-all">{nullifier}</p>
          </div>

          {!hasVoted ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                <button
                  onClick={() => handleVote("Candidate A")}
                  disabled={isLoading}
                  className="p-6 md:p-8 bg-gray-800 hover:bg-gray-700 border-2 border-blue-500 rounded-2xl transition-all hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <h3 className="text-xl md:text-2xl font-bold mb-2">Candidate A</h3>
                  <p className="text-gray-400 text-sm md:text-base">The Visionary</p>
                </button>

                <button
                  onClick={() => handleVote("Candidate B")}
                  disabled={isLoading}
                  className="p-6 md:p-8 bg-gray-800 hover:bg-gray-700 border-2 border-red-500 rounded-2xl transition-all hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <h3 className="text-xl md:text-2xl font-bold mb-2">Candidate B</h3>
                  <p className="text-gray-400 text-sm md:text-base">The Pragmatist</p>
                </button>
              </div>
              
              {voteStatus && (
                <div className="mt-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
                  <p className="text-center">{voteStatus}</p>
                  {isLoading && (
                    <div className="mt-2 flex justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="p-6 md:p-8 bg-gray-800 rounded-2xl border-2 border-green-500">
              <h2 className="text-2xl md:text-3xl font-bold text-green-400 mb-4 text-center">✅ Vote Cast!</h2>
              <p className="text-gray-300 text-center mb-2">Your vote has been privately recorded on Aztec.</p>
              <p className="text-sm text-gray-500 text-center">Nullifier consumed - you cannot vote again.</p>
              
              <div className="mt-6 p-4 bg-gray-900 rounded-lg">
                <p className="text-xs text-gray-400 mb-2 text-center">Transaction Details:</p>
                <p className="text-xs text-gray-600 break-all text-center">{voteStatus}</p>
              </div>
              
              <button
                onClick={() => setShowResults(true)}
                className="w-full mt-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
              >
                View Results
              </button>
            </div>
          )}
        </div>
      )}
      
      <footer className="mt-12 text-center text-xs text-gray-600">
        <p>Powered by Aztec Network • Private by Default</p>
        <p className="mt-1">Using Sponsored Fee Payment Contract</p>
      </footer>
      </div>
    </main>
  );
}
