"use client";

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface AdminInfo {
  creator: string;
  walletAddress: string;
  isAdmin: boolean;
  isSnapshotTaken: boolean;
}

interface VotingStatus {
  isActive: boolean;
  startTime: number;
  endTime: number;
  currentTime: number;
  startDate: string;
  endDate: string;
}

export default function AdminPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);
  const [votingStatus, setVotingStatus] = useState<VotingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [deployStartTime, setDeployStartTime] = useState("");
  const [deployEndTime, setDeployEndTime] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadAdminInfo();
      loadVotingStatus();
    }
  }, [isOpen]);

  const loadAdminInfo = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/info`);
      const data = await response.json();
      if (data.success) {
        setAdminInfo(data);
      }
    } catch (error) {
      console.error('Error loading admin info:', error);
    }
  };

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

  const handleExtendVoting = async () => {
    if (!newEndTime) {
      setStatusMessage("❌ Please enter a new end time");
      return;
    }

    const timestamp = Math.floor(new Date(newEndTime).getTime() / 1000);
    
    if (timestamp <= (votingStatus?.endTime || 0)) {
      setStatusMessage("❌ New end time must be later than current end time");
      return;
    }

    setIsLoading(true);
    setStatusMessage("⏳ Extending voting period...");

    try {
      const response = await fetch(`${API_URL}/api/admin/extend-voting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEndTime: timestamp })
      });

      const data = await response.json();

      if (data.success) {
        setStatusMessage(`✅ Voting extended until ${data.newEndDate}`);
        loadVotingStatus();
        setTimeout(() => setStatusMessage(""), 5000);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      setStatusMessage(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndVoting = async () => {
    if (!confirm("Are you sure you want to end voting early? This action cannot be undone.")) {
      return;
    }

    setIsLoading(true);
    setStatusMessage("⏳ Ending voting...");

    try {
      const response = await fetch(`${API_URL}/api/admin/end-voting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        setStatusMessage(`✅ Voting ended! TX: ${data.txHash.substring(0, 20)}...`);
        loadVotingStatus();
        setTimeout(() => setStatusMessage(""), 5000);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      setStatusMessage(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTakeSnapshot = async () => {
    if (!confirm("Take an immutable snapshot of current results?")) {
      return;
    }

    setIsLoading(true);
    setStatusMessage("⏳ Taking snapshot...");

    try {
      const response = await fetch(`${API_URL}/api/admin/take-snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        const { snapshot } = data;
        setStatusMessage(
          `✅ Snapshot taken! Results: A:${snapshot.candidateA} B:${snapshot.candidateB} C:${snapshot.candidateC}`
        );
        loadAdminInfo();
        setTimeout(() => setStatusMessage(""), 8000);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      setStatusMessage(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeployNewVoting = async () => {
    if (!deployStartTime || !deployEndTime) {
      setStatusMessage("❌ Please enter both start and end times");
      return;
    }

    const startTimestamp = Math.floor(new Date(deployStartTime).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(deployEndTime).getTime() / 1000);
    
    if (endTimestamp <= startTimestamp) {
      setStatusMessage("❌ End time must be later than start time");
      return;
    }

    if (!confirm(`Deploy new voting contract?\n\nStart: ${new Date(startTimestamp * 1000).toLocaleString()}\nEnd: ${new Date(endTimestamp * 1000).toLocaleString()}\n\nThis will take ~36 seconds.`)) {
      return;
    }

    setIsLoading(true);
    setStatusMessage("⏳ Deploying new voting contract... (~36s)");

    try {
      const response = await fetch(`${API_URL}/api/admin/deploy-new-voting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          startTime: startTimestamp,
          endTime: endTimestamp
        })
      });

      const data = await response.json();

      if (data.success) {
        setStatusMessage(
          `✅ New contract deployed!\n\nAddress: ${data.contractAddress}\n\n🔄 Reloading page in 3 seconds...`
        );
        // Reload page after 3 seconds to use new contract
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      setStatusMessage(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 rounded-lg font-semibold shadow-lg transition-all transform hover:scale-105 text-sm"
      >
        👑 Admin Panel
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-gray-900 border-2 border-orange-500 rounded-xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-orange-400">👑 Admin Panel</h2>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white text-xl"
        >
          ×
        </button>
      </div>

      {/* Admin Info */}
      {adminInfo && (
        <div className="mb-4 p-3 bg-gray-800 rounded-lg border border-gray-700">
          <p className="text-xs text-gray-400 mb-1">Wallet Address:</p>
          <p className="text-xs font-mono text-gray-300 mb-2 truncate">
            {adminInfo.walletAddress}
          </p>
          <p className="text-xs text-gray-400 mb-1">Contract Creator:</p>
          <p className="text-xs font-mono text-gray-300 mb-2 truncate">
            {adminInfo.creator}
          </p>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs font-semibold ${
              adminInfo.isAdmin 
                ? 'bg-green-900/50 text-green-300' 
                : 'bg-red-900/50 text-red-300'
            }`}>
              {adminInfo.isAdmin ? '✓ Admin Access' : '✗ Not Admin'}
            </span>
            {adminInfo.isSnapshotTaken && (
              <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-900/50 text-blue-300">
                📸 Snapshot Taken
              </span>
            )}
          </div>
        </div>
      )}

      {/* Voting Status */}
      {votingStatus && (
        <div className="mb-4 p-3 bg-gray-800 rounded-lg border border-gray-700">
          <p className="text-xs font-semibold text-gray-400 mb-2">Voting Period:</p>
          <div className="space-y-1 text-xs">
            <p className="text-gray-300">
              <span className="text-gray-500">Start:</span> {new Date(votingStatus.startDate).toLocaleString()}
            </p>
            <p className="text-gray-300">
              <span className="text-gray-500">End:</span> {new Date(votingStatus.endDate).toLocaleString()}
            </p>
            <p className={`font-semibold ${votingStatus.isActive ? 'text-green-400' : 'text-red-400'}`}>
              Status: {votingStatus.isActive ? '🟢 Active' : '🔴 Ended'}
            </p>
          </div>
        </div>
      )}

      {/* Admin Actions */}
      <div className="space-y-3">
        {/* Extend Voting */}
        <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="text-sm font-semibold text-orange-400 mb-2">⏰ Extend Voting</h3>
          <input
            type="datetime-local"
            value={newEndTime}
            onChange={(e) => setNewEndTime(e.target.value)}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-sm mb-2 focus:border-orange-500 focus:outline-none"
          />
          <button
            onClick={handleExtendVoting}
            disabled={isLoading || !adminInfo?.isAdmin}
            className="w-full px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 rounded font-semibold text-sm transition-all"
          >
            Extend Voting Period
          </button>
        </div>

        {/* End Voting */}
        <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="text-sm font-semibold text-red-400 mb-2">🛑 End Voting Early</h3>
          <p className="text-xs text-gray-400 mb-2">
            Immediately end the voting period. This action cannot be undone.
          </p>
          <button
            onClick={handleEndVoting}
            disabled={isLoading || !adminInfo?.isAdmin || !votingStatus?.isActive}
            className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded font-semibold text-sm transition-all"
          >
            End Voting Now
          </button>
        </div>

        {/* Take Snapshot */}
        <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="text-sm font-semibold text-blue-400 mb-2">📸 Take Snapshot</h3>
          <p className="text-xs text-gray-400 mb-2">
            Create an immutable record of final results. Can only be done once.
          </p>
          <button
            onClick={handleTakeSnapshot}
            disabled={isLoading || adminInfo?.isSnapshotTaken}
            className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded font-semibold text-sm transition-all"
          >
            {adminInfo?.isSnapshotTaken ? 'Snapshot Already Taken' : 'Take Snapshot'}
          </button>
        </div>

        {/* Deploy New Voting */}
        <div className="p-3 bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-lg border-2 border-purple-500">
          <h3 className="text-sm font-semibold text-purple-400 mb-2">🚀 Deploy New Voting</h3>
          <p className="text-xs text-gray-400 mb-2">
            Deploy a new voting contract with custom time period (~36 seconds).
          </p>
          <div className="space-y-2 mb-2">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Start Time</label>
              <input
                type="datetime-local"
                value={deployStartTime}
                onChange={(e) => setDeployStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-sm focus:border-purple-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">End Time</label>
              <input
                type="datetime-local"
                value={deployEndTime}
                onChange={(e) => setDeployEndTime(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-sm focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>
          <button
            onClick={handleDeployNewVoting}
            disabled={isLoading || !adminInfo?.isAdmin}
            className="w-full px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:bg-gray-600 rounded font-semibold text-sm transition-all"
          >
            🚀 Deploy New Contract
          </button>
        </div>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div className={`mt-4 p-3 rounded-lg border text-xs ${
          statusMessage.includes('✅') ? 'bg-green-900/20 border-green-500 text-green-300' :
          statusMessage.includes('❌') ? 'bg-red-900/20 border-red-500 text-red-300' :
          'bg-blue-900/20 border-blue-500 text-blue-300'
        }`}>
          {statusMessage}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-gray-700">
        <p className="text-xs text-gray-500 text-center">
          Admin actions require contract creator privileges
        </p>
      </div>
    </div>
  );
}
