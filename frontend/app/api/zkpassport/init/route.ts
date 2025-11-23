import { NextRequest, NextResponse } from 'next/server';
import { ZKPassport } from '@zkpassport/sdk';

// Store active sessions to handle onResult callbacks
const activeSessions = new Map<string, any>();

// Initialize ZKPassport on server-side where Node.js APIs are available
export async function POST(req: NextRequest) {
  try {
    const { devMode = true } = await req.json();
    
    // Get the host from headers
    const host = req.headers.get('host') || 'localhost:3000';
    const domain = host.split(':')[0]; // Remove port if present
    
    console.log('[ZKPassport] Initializing SDK with domain:', domain);
    
    // Initialize ZKPassport SDK with domain string (not an object)
    const zkPassport = new ZKPassport(domain);

    const queryBuilder = await zkPassport.request({
      name: "Aztec Voting",
      purpose: "Prove you are a unique human to vote",
      scope: "voting_v1",
      devMode: devMode,
    });

    const { url, requestId, onResult } = queryBuilder.done();
    
    console.log('[ZKPassport] Generated QR URL:', url);
    console.log('[ZKPassport] Request ID:', requestId);

    // Set up result handler and store in session map
    onResult((result: any) => {
      console.log('[ZKPassport] Verification result received:', result);
      activeSessions.set(requestId, {
        verified: result.verified,
        uniqueIdentifier: result.uniqueIdentifier,
        result: result.result,
        timestamp: Date.now()
      });
    });

    return NextResponse.json({ 
      success: true, 
      qrUrl: url,
      requestId: requestId
    });
  } catch (error: any) {
    console.error('[ZKPassport Init Error]:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to initialize ZKPassport',
        details: error.stack
      },
      { status: 500 }
    );
  }
}

// GET endpoint to poll for verification results
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get('requestId');
  
  if (!requestId) {
    return NextResponse.json(
      { success: false, error: 'Request ID required' },
      { status: 400 }
    );
  }

  const session = activeSessions.get(requestId);
  
  if (session) {
    // Clean up old session
    activeSessions.delete(requestId);
    
    return NextResponse.json({
      success: true,
      verified: session.verified,
      uniqueIdentifier: session.uniqueIdentifier,
      result: session.result
    });
  }

  return NextResponse.json({
    success: true,
    pending: true
  });
}
