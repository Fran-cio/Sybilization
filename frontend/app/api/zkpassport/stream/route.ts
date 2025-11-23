import { NextRequest } from 'next/server';
import { ZKPassport } from '@zkpassport/sdk';

// Server-Sent Events endpoint to maintain connection and receive ZKPassport callbacks
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const devMode = searchParams.get('devMode') === 'true';

  // Create SSE stream
  const encoder = new TextEncoder();
  
  const customReadable = new ReadableStream({
    async start(controller) {
      try {
        // Get the host from headers
        const host = req.headers.get('host') || 'localhost:3000';
        const domain = host.split(':')[0];
        
        console.log('[ZKPassport SSE] Initializing SDK with domain:', domain);
        
        // Initialize ZKPassport SDK
        const zkPassport = new ZKPassport(domain);

        const queryBuilder = await zkPassport.request({
          name: "Aztec Voting",
          logo: "https://aztec.network/logo.png",
          purpose: "Prove you are a unique human to vote",
          scope: "voting_v1",
          devMode: devMode,
        });

        const { url, requestId, onRequestReceived, onGeneratingProof, onResult, onReject, onError } = queryBuilder.done();
        
        console.log('[ZKPassport SSE] Session started:', requestId);
        console.log('[ZKPassport SSE] QR URL:', url);

        // Send initial data with QR URL
        const initialData = {
          type: 'init',
          qrUrl: url,
          requestId: requestId
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialData)}\n\n`));

        // Set up callbacks
        onRequestReceived(() => {
          console.log('[ZKPassport SSE] Request received by user');
          const data = { type: 'request_received' };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        });

        onGeneratingProof(() => {
          console.log('[ZKPassport SSE] Generating proof...');
          const data = { type: 'generating_proof' };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        });

        onResult(async (result: any) => {
          console.log('[ZKPassport SSE] Verification result:', {
            verified: result.verified,
            uniqueIdentifier: result.uniqueIdentifier
          });
          
          const data = {
            type: 'result',
            verified: result.verified,
            uniqueIdentifier: result.uniqueIdentifier,
            result: result.result
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          
          // Close stream after sending result
          setTimeout(() => {
            controller.close();
          }, 1000);
        });

        onReject(() => {
          console.log('[ZKPassport SSE] User rejected verification');
          const data = { type: 'rejected' };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          controller.close();
        });

        onError((error: any) => {
          console.error('[ZKPassport SSE] Error:', error);
          const data = { 
            type: 'error',
            error: error.message || 'Unknown error'
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          controller.close();
        });

        // Keep connection alive with heartbeat
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'));
          } catch (e) {
            clearInterval(heartbeatInterval);
          }
        }, 30000); // Every 30 seconds

        // Cleanup on disconnect
        req.signal.addEventListener('abort', () => {
          console.log('[ZKPassport SSE] Client disconnected');
          clearInterval(heartbeatInterval);
          controller.close();
        });

      } catch (error: any) {
        console.error('[ZKPassport SSE Error]:', error);
        const data = { 
          type: 'error',
          error: error.message || 'Failed to initialize ZKPassport'
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        controller.close();
      }
    }
  });

  return new Response(customReadable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering in nginx
    },
  });
}
