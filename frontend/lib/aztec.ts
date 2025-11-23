// Client-side API wrapper for Aztec contract interactions
// All actual Aztec logic runs on the server via API routes

export async function castVote(contractAddress: string, candidate: string, nullifier: string) {
  console.log(`Casting vote for ${candidate} with nullifier`);
  
  try {
    const response = await fetch('/api/vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contractAddress,
        candidate,
        nullifier,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Failed to cast vote');
    }

    console.log('✅ Vote cast successfully!', data);
    return data;
  } catch (error: any) {
    console.error('Error casting vote:', error);
    throw error;
  }
}

export async function getVoteCount(contractAddress: string, candidate: string): Promise<number> {
  try {
    const response = await fetch(`/api/vote/count?contractAddress=${contractAddress}&candidate=${encodeURIComponent(candidate)}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || data.error || 'Failed to get vote count');
    }
    
    return data.count;
  } catch (error) {
    console.error('Error getting vote count:', error);
    return 0;
  }
}
