import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { contractAddress, candidate, nullifier } = await request.json();
    
    console.log('[Vote API] Received:', { contractAddress, candidate, nullifier: nullifier?.substring(0, 20) + '...' });
    
    if (!contractAddress || !candidate || !nullifier) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Forward request to the API server
    const API_SERVER_URL = process.env.API_SERVER_URL || 'http://localhost:3001';
    
    console.log('[Vote API] Forwarding to API server:', `${API_SERVER_URL}/vote`);
    const response = await fetch(`${API_SERVER_URL}/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contractAddress, candidate, nullifier }),
    });

    console.log('[Vote API] Response status:', response.status);
    const data = await response.json();
    console.log('[Vote API] Response data:', data);
    
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Failed to cast vote');
    }

    console.log('[Vote API] Success from API server');
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error('[Vote API] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to cast vote',
        message: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
