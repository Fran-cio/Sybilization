"use client";

import { useEffect, useState } from "react";

interface ZKPassportProps {
  onVerified: (nullifier: string) => void;
}

// Predefined mock wallets for testing
const MOCK_WALLETS = [
  {
    id: 1,
    name: "Alice 🦄",
    nullifier: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    description: "First test wallet"
  },
  {
    id: 2,
    name: "Bob 🐉",
    nullifier: "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
    description: "Second test wallet"
  },
  {
    id: 3,
    name: "Charlie 🦊",
    nullifier: "0xaaaaaabbbbbbccccccddddddeeeeeeffffffaaaaaabbbbbbccccccddddddeeeeee",
    description: "Third test wallet"
  }
];

export default function ZKPassportComponent({ onVerified }: ZKPassportProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Initializing ZKPassport...");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [useMockMode, setUseMockMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedWallet, setSelectedWallet] = useState<number | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let isActive = true;

    const initZKPassport = async () => {
      if (!isActive) return;

      try {
        setIsLoading(true);
        setStatus("Connecting to ZKPassport...");
        
        // Connect to SSE endpoint
        const sseUrl = `/api/zkpassport/stream?devMode=true`;
        eventSource = new EventSource(sseUrl);

        eventSource.onopen = () => {
          console.log('[ZKPassport SSE] Connected');
        };

        eventSource.onmessage = (event) => {
          if (!isActive) return;

          try {
            const data = JSON.parse(event.data);
            console.log('[ZKPassport SSE] Message:', data);

            switch (data.type) {
              case 'init':
                setQrCodeUrl(data.qrUrl);
                setSessionId(data.requestId);
                setStatus("📱 Scan QR with ZKPassport App");
                setIsLoading(false);
                console.log('[ZKPassport Client] Session started:', data.requestId);
                break;

              case 'request_received':
                setStatus("📲 Request received! Opening on your phone...");
                break;

              case 'generating_proof':
                setStatus("⚡ Generating proof... This may take a moment");
                break;

              case 'result':
                if (data.verified) {
                  setStatus("✅ Verified Successfully!");
                  setTimeout(() => {
                    if (isActive) {
                      onVerified(data.uniqueIdentifier);
                    }
                  }, 500);
                } else {
                  setStatus("❌ Verification Failed");
                  setTimeout(() => {
                    if (isActive) {
                      setUseMockMode(true);
                    }
                  }, 2000);
                }
                if (eventSource) eventSource.close();
                break;

              case 'rejected':
                setStatus("❌ Verification Rejected");
                setTimeout(() => {
                  if (isActive) {
                    setUseMockMode(true);
                  }
                }, 2000);
                if (eventSource) eventSource.close();
                break;

              case 'error':
                console.error('[ZKPassport SSE] Error:', data.error);
                setStatus("Error - Using Mock Mode");
                setUseMockMode(true);
                setIsLoading(false);
                if (eventSource) eventSource.close();
                break;
            }
          } catch (error) {
            console.error('[ZKPassport SSE] Parse error:', error);
          }
        };

        eventSource.onerror = (error) => {
          console.error('[ZKPassport SSE] Connection error:', error);
          if (isActive) {
            setStatus("Connection error - Using Mock Mode");
            setUseMockMode(true);
            setIsLoading(false);
          }
          if (eventSource) eventSource.close();
        };

      } catch (error: any) {
        console.error('[ZKPassport Client Error]:', error);
        if (isActive) {
          setStatus("Error connecting to ZKPassport - Using Mock Mode");
          setUseMockMode(true);
          setIsLoading(false);
        }
      }
    };

    initZKPassport();

    // Cleanup function when component unmounts
    return () => {
      isActive = false;
      if (eventSource) {
        console.log('[ZKPassport Client] Closing SSE connection');
        eventSource.close();
      }
    };
  }, [onVerified]);

  const handleMockWalletSelection = (walletId: number) => {
    const wallet = MOCK_WALLETS.find(w => w.id === walletId);
    if (wallet) {
      setSelectedWallet(walletId);
      setStatus(`Mock Verified! (${wallet.name})`);
      setTimeout(() => {
        onVerified(wallet.nullifier);
      }, 500);
    }
  };

  const handleRandomMockWallet = () => {
    // Generate a random nullifier for demo purposes
    const mockNullifier = "0x" + Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
    
    setStatus("Mock Verified! (Random Wallet)");
    setTimeout(() => {
      onVerified(mockNullifier);
    }, 500);
  };

  if (useMockMode) {
    return (
      <div className="flex flex-col items-center p-6 bg-yellow-50 border-2 border-yellow-400 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Mock Identity Verification</h2>
        <p className="mb-4 text-gray-600 text-center text-sm">
          ZKPassport service is currently unavailable.
        </p>
        
        <div className="w-full max-w-md space-y-4">
          <p className="text-sm font-semibold text-gray-700 mb-2">Select a Mock Wallet:</p>
          
          {MOCK_WALLETS.map((wallet) => (
            <button
              key={wallet.id}
              onClick={() => handleMockWalletSelection(wallet.id)}
              className="w-full p-4 bg-white hover:bg-yellow-100 border-2 border-yellow-300 rounded-lg transition-colors text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-800">{wallet.name}</p>
                  <p className="text-xs text-gray-600">{wallet.description}</p>
                  <p className="text-xs text-gray-500 mt-1 font-mono truncate">{wallet.nullifier.slice(0, 20)}...</p>
                </div>
                <span className="text-2xl">→</span>
              </div>
            </button>
          ))}

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-yellow-50 text-gray-500">or</span>
            </div>
          </div>
          
          <button
            onClick={handleRandomMockWallet}
            className="w-full px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg transition-colors"
          >
            🎲 Generate Random Wallet
          </button>
        </div>
        
        <div className="mt-4 text-xs text-gray-500 text-center">
          <p>⚠️ This is a demo fallback</p>
          <p>In production, this would use real ZKPassport verification</p>
          <p className="mt-2">The nullifier ensures one vote per passport</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-6 bg-white rounded-xl shadow-lg border-2 border-blue-400">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">🛂 Verify Identity with ZKPassport</h2>
      <p className="mb-4 text-gray-600 text-center font-medium">{status}</p>
      
      {isLoading && (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}
      
      {qrCodeUrl && !isLoading && (
        <div className="flex flex-col items-center">
          <div className="bg-white p-4 rounded-lg border-2 border-gray-200 shadow-sm">
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrCodeUrl)}`} 
              alt="ZKPassport QR Code" 
              className="w-64 h-64"
            />
          </div>
          
          <div className="mt-6 text-center space-y-2">
            <p className="text-sm font-semibold text-gray-700">📱 Instructions:</p>
            <ol className="text-sm text-gray-600 text-left list-decimal list-inside space-y-1">
              <li>Open the ZKPassport mobile app</li>
              <li>Enable Dev Mode (long press bottom of screen)</li>
              <li>Scan this QR code with your device</li>
              <li>Complete verification on your phone</li>
            </ol>
          </div>

          <div className="mt-6 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800">
              ✨ Dev Mode enabled - You can use test passports
            </p>
          </div>
        </div>
      )}
      
      <button
        onClick={() => setUseMockMode(true)}
        className="mt-6 text-sm text-gray-600 hover:text-gray-800 underline"
      >
        Having trouble? Use mock mode instead
      </button>
    </div>
  );
}
