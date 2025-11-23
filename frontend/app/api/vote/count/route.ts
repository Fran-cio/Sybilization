import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractAddress = searchParams.get('contractAddress');
    const candidate = searchParams.get('candidate');

    if (!contractAddress || !candidate) {
      return NextResponse.json(
        { error: 'Missing contractAddress or candidate' },
        { status: 400 }
      );
    }

    console.log(`[Vote Count API] Fetching count for ${candidate} at ${contractAddress}`);

    // Import Aztec modules dynamically
    const { createAztecNodeClient } = await import('@aztec/aztec.js/node');
    const { Contract } = await import('@aztec/aztec.js/contracts');
    const { Fr } = await import('@aztec/aztec.js/fields');
    const { AztecAddress } = await import('@aztec/aztec.js/addresses');
    const { readFileSync } = await import('fs');
    const { join } = await import('path');

    const NODE_URL = process.env.NODE_URL || 'http://localhost:8080';

    // Load artifact
    const artifactPath = join(process.cwd(), '../contracts/target/private_voting-PrivateVoting.json');
    const PrivateVotingArtifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));

    const node = createAztecNodeClient(NODE_URL);
    
    // We don't need a wallet for view functions, just a node connection
    // But Contract.at requires a wallet or pxe. 
    // For view functions, we can use a read-only contract instance if supported, 
    // or just use a dummy wallet/pxe.
    // Actually, Contract.at requires a Wallet interface.
    // Let's use TestWallet for simplicity, even if overhead.
    const { TestWallet } = await import('@aztec/test-wallet/server');
    const wallet = await TestWallet.create(node);

    const contract = await Contract.at(
      AztecAddress.fromString(contractAddress),
      PrivateVotingArtifact as any,
      wallet
    );

    // Convert candidate name to numeric ID (matching the vote logic)
    const candidateId = candidate === "Candidate A" ? 1 : 2;
    const candidateField = new Fr(candidateId);

    const count = await contract.methods.get_vote(candidateField).simulate();

    console.log(`[Vote Count API] Count for ${candidate}:`, count);

    return NextResponse.json({
      candidate,
      count: Number(count)
    });

  } catch (error: any) {
    console.error('[Vote Count API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get vote count',
        message: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
